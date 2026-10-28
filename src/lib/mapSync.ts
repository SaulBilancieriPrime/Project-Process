import { parseGraphDocument, type GraphDocument, type GraphLink, type GraphNode, type GraphSettings } from "../schema/graph";

export type SharedMap = GraphDocument & { revision: number };

export type MapTx = {
  actor?: string;
  label?: string;
  settings?: GraphSettings;
  upsertNodes?: GraphNode[];
  deleteNodeIds?: string[];
  upsertLinks?: GraphLink[];
  deleteLinkIds?: string[];
  replace?: GraphDocument;
};

export type MapPoll =
  | { ok: true; unchanged: true; revision: number }
  | { ok: true; unchanged: false; revision: number; nodes: GraphNode[]; links: GraphLink[]; settings: GraphSettings }
  | { ok: false; error: string };

const ACTOR_KEY = "project-process.actor";

export function mapActor() {
  try {
    const existing = localStorage.getItem(ACTOR_KEY)?.trim();
    if (existing) return existing;
    const next = `editor-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(ACTOR_KEY, next);
    return next;
  } catch {
    return "editor";
  }
}

export async function fetchSharedMap(since?: number): Promise<MapPoll> {
  try {
    const query = since && since > 0 ? `?since=${since}` : "";
    const res = await fetch(`/api/map${query}`);
    const body = (await res.json().catch(() => null)) as MapPoll | null;
    if (!body || typeof body !== "object") return { ok: false, error: `Map request failed (${res.status})` };
    if (!body.ok) return { ok: false, error: "error" in body ? body.error : `Map request failed (${res.status})` };
    if (body.unchanged) return body;
    const doc = parseGraphDocument(body);
    return { ok: true, unchanged: false, revision: Number(body.revision) || 1, ...doc };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Map request failed" };
  }
}

export async function postMapTx(tx: MapTx): Promise<{ ok: true; revision: number } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tx, actor: tx.actor ?? mapActor() }),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; revision?: number; error?: string } | null;
    if (!res.ok || !body?.ok) {
      return { ok: false, error: body?.error || `Map write failed (${res.status})` };
    }
    return { ok: true, revision: Number(body.revision) || 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Map write failed" };
  }
}

export function txFromSnapshots(
  before: GraphDocument,
  after: GraphDocument,
  label: string,
): MapTx | null {
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));
  const beforeLinks = new Map(before.links.map((l) => [l.id, l]));
  const afterLinks = new Map(after.links.map((l) => [l.id, l]));

  const upsertNodes = after.nodes.filter((node) => {
    const prev = beforeNodes.get(node.id);
    return !prev || JSON.stringify(stripVel(prev)) !== JSON.stringify(stripVel(node));
  });
  const deleteNodeIds = before.nodes.filter((n) => !afterNodes.has(n.id)).map((n) => n.id);
  const upsertLinks = after.links.filter((link) => {
    const prev = beforeLinks.get(link.id);
    return !prev || JSON.stringify(prev) !== JSON.stringify(link);
  });
  const deleteLinkIds = before.links.filter((l) => !afterLinks.has(l.id)).map((l) => l.id);
  const settingsChanged = JSON.stringify(before.settings) !== JSON.stringify(after.settings);

  if (!upsertNodes.length && !deleteNodeIds.length && !upsertLinks.length && !deleteLinkIds.length && !settingsChanged) {
    return null;
  }
  return {
    label,
    settings: settingsChanged ? after.settings : undefined,
    upsertNodes,
    deleteNodeIds,
    upsertLinks,
    deleteLinkIds,
  };
}

function stripVel(node: GraphNode) {
  return { ...node, vx: undefined, vy: undefined };
}
