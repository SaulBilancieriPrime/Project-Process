import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { graphDocumentSchema, graphLinkSchema, graphNodeSchema } from "../../schema/graph";
import {
  createRateLimiter,
  PayloadTooLargeError,
  principalName,
  readJsonBody,
  requestActor,
  serverError,
} from "../../server/http";
import { applyMapTx, loadMapDelta, loadSharedMap, MapConflictError } from "../../server/mapStore";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

const idSchema = z.string().min(1).max(160);
const versionMapSchema = z.record(z.string(), z.number().int().nonnegative());

const txSchema = z.object({
  actor: z.string().max(200).optional(),
  clientId: z.string().max(64).optional(),
  label: z.string().max(200).optional(),
  upsertNodes: z.array(graphNodeSchema).max(MAX_ROWS).optional(),
  deleteNodeIds: z.array(idSchema).max(MAX_ROWS).optional(),
  upsertLinks: z.array(graphLinkSchema).max(MAX_ROWS).optional(),
  deleteLinkIds: z.array(idSchema).max(MAX_ROWS).optional(),
  positions: z
    .array(z.object({ id: idSchema, x: z.number(), y: z.number() }))
    .max(MAX_ROWS)
    .optional(),
  baseVersions: z.object({ nodes: versionMapSchema.optional(), links: versionMapSchema.optional() }).optional(),
  replace: graphDocumentSchema.optional(),
});

const allowWrite = createRateLimiter(40, 10);

export const Route = createFileRoute("/api/map")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const you = principalName(request);
          const since = Number(new URL(request.url).searchParams.get("since") ?? "");
          if (Number.isFinite(since) && since > 0) {
            const delta = await loadMapDelta(since);
            if (delta) {
              const unchanged = delta.revision === since;
              return Response.json({ ok: true, full: false, unchanged, you, ...delta });
            }
          }
          const map = await loadSharedMap();
          return Response.json({ ok: true, full: true, unchanged: false, you, ...map });
        } catch (err) {
          return serverError("api/map GET", err);
        }
      },
      POST: async ({ request }) => {
        try {
          const raw = await readJsonBody(request, MAX_BODY_BYTES);
          const parsed = txSchema.safeParse(raw);
          if (!parsed.success) return Response.json({ ok: false, error: "Invalid map transaction" }, { status: 400 });
          const tx = parsed.data;
          const actor = requestActor(request, tx.actor);
          if (!allowWrite(actor ?? tx.clientId ?? "anonymous")) {
            return Response.json({ ok: false, error: "Too many writes, slow down" }, { status: 429 });
          }
          const empty =
            !tx.replace &&
            !tx.upsertNodes?.length &&
            !tx.deleteNodeIds?.length &&
            !tx.upsertLinks?.length &&
            !tx.deleteLinkIds?.length &&
            !tx.positions?.length;
          if (empty) return Response.json({ ok: false, error: "Empty transaction" }, { status: 400 });
          const result = await applyMapTx({ ...tx, actor });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          if (err instanceof PayloadTooLargeError) {
            return Response.json({ ok: false, error: "Map transaction too large" }, { status: 413 });
          }
          if (err instanceof SyntaxError) {
            return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
          }
          if (err instanceof MapConflictError) {
            return Response.json(
              {
                ok: false,
                conflict: true,
                error: "Someone else changed this first",
                nodeIds: err.nodeIds,
                linkIds: err.linkIds,
              },
              { status: 409 },
            );
          }
          return serverError("api/map POST", err);
        }
      },
    },
  },
});
