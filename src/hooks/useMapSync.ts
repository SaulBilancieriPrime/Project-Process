import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import { fetchMap, mapClientId, type ChangeLogEntry } from "../lib/mapSync";
import { applyDelta, applyFullMap, graphStore, noteVersions } from "../store/graph";
import { configureOutbox, outboxStore } from "../store/outbox";
import { appendSyncFeed } from "../store/syncFeed";
import { showToast } from "../store/ui";

const FULL_KEY = ["map", "full"] as const;
const DELTA_KEY = ["map", "delta"] as const;

const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 10_000;
const DORMANT_POLL_MS = 30_000;
const ACTIVE_WINDOW_MS = 60_000;
const DORMANT_AFTER_MS = 10 * 60_000;
const OFFLINE_RETRY_MS = 10_000;

let lastActivity = Date.now();

function pollInterval() {
  const idle = Date.now() - lastActivity;
  if (idle < ACTIVE_WINDOW_MS) return ACTIVE_POLL_MS;
  if (idle < DORMANT_AFTER_MS) return IDLE_POLL_MS;
  return DORMANT_POLL_MS;
}

function actorsOf(log: ChangeLogEntry[]) {
  const me = mapClientId();
  const names = [...new Set(log.filter((e) => e.client !== me && e.by).map((e) => e.by))];
  return names.length ? names.join(", ") : undefined;
}

function nodeTitles(ids: string[]) {
  const byId = new Map(graphStore.state.nodes.map((n) => [n.id, n.title.trim() || "Untitled"]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as string[];
}

export type ConnectionStatus = "live" | "syncing" | "offline";

export function useMapSync(): ConnectionStatus {
  const queryClient = useQueryClient();
  const hydrated = useStore(graphStore, (s) => s.hydrated);
  const pending = useStore(outboxStore, (s) => s.entries.length);
  const stuck = useStore(outboxStore, (s) => s.entries.some((e) => e.status === "held" || e.status === "retrying"));

  const full = useQuery({
    queryKey: FULL_KEY,
    queryFn: () => fetchMap(),
    staleTime: Infinity,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (query.state.status === "error" ? OFFLINE_RETRY_MS : false),
    structuralSharing: false,
  });

  const delta = useQuery({
    queryKey: DELTA_KEY,
    queryFn: () => fetchMap(graphStore.state.revision),
    enabled: hydrated,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    retry: false,
    gcTime: 0,
    structuralSharing: false,
  });

  useEffect(() => {
    if (full.data?.kind === "full") applyFullMap(full.data);
  }, [full.data]);

  useEffect(() => {
    const data = delta.data;
    if (!data) return;
    if (data.kind === "full") {
      applyFullMap(data);
      return;
    }
    const changes = applyDelta(data);
    if (!changes.length) return;
    lastActivity = Date.now();
    appendSyncFeed(changes, { by: actorsOf(data.log) });
  }, [delta.data]);

  useEffect(() => {
    const reloadFull = () =>
      queryClient.fetchQuery({ queryKey: FULL_KEY, queryFn: () => fetchMap(), staleTime: 0 }).catch(() => undefined);

    configureOutbox({
      onApplied: noteVersions,
      onConflict: (result, dropped) => {
        const titles = nodeTitles(result.nodeIds);
        const what = titles.length ? `"${titles.slice(0, 3).join('", "')}"` : "the same item";
        const extra = dropped.length > 1 ? ` ${dropped.length - 1} other queued edit${dropped.length === 2 ? "" : "s"} were dropped.` : "";
        appendSyncFeed(
          [
            {
              id: "conflict",
              kind: "update",
              target: result.nodeIds.length || !result.linkIds.length ? "node" : "link",
              targetId: result.nodeIds[0] ?? result.linkIds[0],
              title: "Your change wasn't saved",
              detail: `Someone else changed ${what} first. The latest map was reloaded.${extra}`,
            },
          ],
          { alert: "conflict" },
        );
        showToast("Someone else changed this first — reloaded the latest map");
        void reloadFull();
      },
      onRejected: (entry, error) => {
        appendSyncFeed(
          [{ id: "rejected", kind: "update", target: "node", title: `Couldn't save "${entry.label}"`, detail: error }],
          { alert: "error" },
        );
        void reloadFull();
      },
      onDiscarded: () => {
        showToast("Discarded unsaved changes");
        void reloadFull();
      },
    });
  }, [queryClient]);

  useEffect(() => {
    const onActivity = () => {
      const wasSlow = pollInterval() > ACTIVE_POLL_MS;
      lastActivity = Date.now();
      if (wasSlow && graphStore.state.hydrated) void queryClient.refetchQueries({ queryKey: DELTA_KEY });
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!outboxStore.state.entries.length) return;
      e.preventDefault();
    };
    window.addEventListener("pointerdown", onActivity, true);
    window.addEventListener("keydown", onActivity, true);
    window.addEventListener("wheel", onActivity, { capture: true, passive: true });
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pointerdown", onActivity, true);
      window.removeEventListener("keydown", onActivity, true);
      window.removeEventListener("wheel", onActivity, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [queryClient]);

  if (!hydrated) return full.isError ? "offline" : "syncing";
  if (stuck || delta.isError) return "offline";
  return pending ? "syncing" : "live";
}
