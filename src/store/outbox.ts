import { onlineManager } from "@tanstack/react-query";
import { Store } from "@tanstack/store";
import { postMapTx, type EntityVersions, type MapTx, type TxResult } from "../lib/mapSync";
import { newId } from "../storage";

export type OutboxStatus = "queued" | "sending" | "retrying" | "held";

export type OutboxEntry = {
  id: string;
  label: string;
  tx: MapTx;
  attempts: number;
  status: OutboxStatus;
  error?: string;
  retryAt?: number;
};

export const outboxStore = new Store<{ entries: OutboxEntry[] }>({ entries: [] });

const MAX_AUTO_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 30_000;

type Kind = keyof EntityVersions;

/** Maps `${id}@${baseVersion}` to the version our own write produced, so queued edits chain correctly. */
const ownBumps: Record<Kind, Map<string, number>> = { nodes: new Map(), links: new Map(), groups: new Map() };

type OutboxHandlers = {
  onApplied: (tx: MapTx, versions: EntityVersions) => void;
  onConflict: (result: Extract<TxResult, { kind: "conflict" }>, dropped: OutboxEntry[]) => void;
  onRejected: (entry: OutboxEntry, error: string) => void;
  onDiscarded: (dropped: OutboxEntry[]) => void;
};

let handlers: OutboxHandlers | null = null;
let pumping = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function configureOutbox(next: OutboxHandlers) {
  handlers = next;
}

function setEntries(update: (entries: OutboxEntry[]) => OutboxEntry[]) {
  outboxStore.setState((state) => ({ entries: update(state.entries) }));
}

function patchEntry(id: string, patch: Partial<OutboxEntry>) {
  setEntries((entries) => entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

function resolveBase(kind: Kind, id: string, base: number) {
  let version = base;
  for (let hops = 0; hops < 1000; hops += 1) {
    const next = ownBumps[kind].get(`${id}@${version}`);
    if (next == null) break;
    version = next;
  }
  return version;
}

function resolveTx(tx: MapTx): MapTx {
  if (!tx.baseVersions) return tx;
  const resolve = (kind: Kind) =>
    Object.fromEntries(
      Object.entries(tx.baseVersions![kind] ?? {}).map(([id, base]) => [id, resolveBase(kind, id, base)]),
    );
  return { ...tx, baseVersions: { nodes: resolve("nodes"), links: resolve("links"), groups: resolve("groups") } };
}

function recordBumps(sent: MapTx, versions: EntityVersions) {
  if (!sent.baseVersions) return;
  for (const kind of ["nodes", "links", "groups"] as const) {
    for (const [id, version] of Object.entries(versions[kind] ?? {})) {
      const base = sent.baseVersions[kind]?.[id] ?? 0;
      ownBumps[kind].set(`${id}@${base}`, version);
    }
  }
}

function retryDelay(attempts: number) {
  return Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** (attempts - 1));
}

function schedule(ms: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void pump();
  }, ms);
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const head = outboxStore.state.entries[0];
      if (!head || head.status === "held") return;
      if (!onlineManager.isOnline()) {
        patchEntry(head.id, { status: "retrying", error: "You're offline" });
        return;
      }
      if (head.retryAt && head.retryAt > Date.now()) {
        schedule(head.retryAt - Date.now());
        return;
      }

      patchEntry(head.id, { status: "sending" });
      const sent = resolveTx(head.tx);
      const result = await postMapTx(sent);

      if (result.ok) {
        recordBumps(sent, result.versions);
        setEntries((entries) => entries.filter((e) => e.id !== head.id));
        handlers?.onApplied(sent, result.versions);
        continue;
      }
      if (result.kind === "conflict") {
        const dropped = outboxStore.state.entries;
        setEntries(() => []);
        handlers?.onConflict(result, dropped);
        return;
      }
      if (result.kind === "rejected") {
        setEntries((entries) => entries.filter((e) => e.id !== head.id));
        handlers?.onRejected(head, result.error);
        continue;
      }

      const attempts = head.attempts + 1;
      if (attempts >= MAX_AUTO_ATTEMPTS) {
        patchEntry(head.id, { status: "held", attempts, error: result.error, retryAt: undefined });
        return;
      }
      const wait = retryDelay(attempts);
      patchEntry(head.id, { status: "retrying", attempts, error: result.error, retryAt: Date.now() + wait });
      schedule(wait);
      return;
    }
  } finally {
    pumping = false;
  }
}

export function enqueueTx(tx: MapTx) {
  setEntries((entries) => [
    ...entries,
    { id: newId(), label: tx.label || "Update", tx, attempts: 0, status: "queued" },
  ]);
  void pump();
}

export function retryOutbox() {
  setEntries((entries) =>
    entries.map((e) => (e.status === "held" || e.status === "retrying" ? { ...e, status: "queued", attempts: 0, retryAt: undefined } : e)),
  );
  void pump();
}

export function discardOutbox() {
  const dropped = outboxStore.state.entries.filter((e) => e.status !== "sending");
  if (!dropped.length) return;
  setEntries((entries) => entries.filter((e) => e.status === "sending"));
  handlers?.onDiscarded(dropped);
}

export function outboxBusy() {
  return outboxStore.state.entries.length > 0;
}

if (typeof window !== "undefined") {
  onlineManager.subscribe((online) => {
    if (online) retryOutbox();
  });
}
