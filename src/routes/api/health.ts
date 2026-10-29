import { createFileRoute } from "@tanstack/react-router";
import { mapRevision } from "../../server/mapStore";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const checkDb = new URL(request.url).searchParams.get("db") === "1";
        if (!checkDb) return Response.json({ ok: true });
        try {
          await mapRevision();
          return Response.json({ ok: true, db: "ok" });
        } catch (err) {
          console.error("[api/health] database check failed", err);
          return Response.json({ ok: false, db: "unavailable" }, { status: 503 });
        }
      },
    },
  },
});
