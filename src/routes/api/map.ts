import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { graphDocumentSchema, graphLinkSchema, graphNodeSchema, graphSettingsSchema } from "../../schema/graph";
import { applyMapTx, loadSharedMap, mapRevision } from "../../server/mapStore";

const txSchema = z.object({
  actor: z.string().optional(),
  label: z.string().optional(),
  settings: graphSettingsSchema.optional(),
  upsertNodes: z.array(graphNodeSchema).optional(),
  deleteNodeIds: z.array(z.string().min(1)).optional(),
  upsertLinks: z.array(graphLinkSchema).optional(),
  deleteLinkIds: z.array(z.string().min(1)).optional(),
  replace: graphDocumentSchema.optional(),
});

function errorResponse(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : "Azure SQL error";
  return Response.json({ ok: false, error: message }, { status });
}

export const Route = createFileRoute("/api/map")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const since = Number(new URL(request.url).searchParams.get("since") ?? "");
          if (Number.isFinite(since) && since > 0) {
            const revision = await mapRevision();
            if (revision === since) return Response.json({ ok: true, unchanged: true, revision });
          }
          const map = await loadSharedMap();
          return Response.json({ ok: true, unchanged: false, ...map });
        } catch (err) {
          return errorResponse(err);
        }
      },
      POST: async ({ request }) => {
        try {
          const parsed = txSchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ ok: false, error: "Invalid map transaction" }, { status: 400 });
          const tx = parsed.data;
          const empty =
            !tx.replace &&
            !tx.settings &&
            !(tx.upsertNodes?.length) &&
            !(tx.deleteNodeIds?.length) &&
            !(tx.upsertLinks?.length) &&
            !(tx.deleteLinkIds?.length);
          if (empty) return Response.json({ ok: false, error: "Empty transaction" }, { status: 400 });
          const result = await applyMapTx(tx);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
