import { Store } from "@tanstack/store";
import {
  ACTION_COALESCE_MS,
  HISTORY_LIMIT,
  actionKindFromChanges,
  applyPatch,
  diffPatch,
  diffSnapshots,
  documentGroup,
  documentLink,
  documentNode,
  isEmptyPatch,
  sameGroup,
  mergePatch,
  sameLink,
  sameNodeContent,
  type ChangeItem,
  type GraphPatch,
  type GraphSnapshot,
  type HistoryAction,
} from "../graph/history";
import { mapClientId, type EntityVersions, type FullMap, type MapDelta, type MapTx, type NodePosition } from "../lib/mapSync";
import { loadDocument, newId } from "../storage";
import type { GraphDocument, GraphGroup, GraphLink, GraphNode } from "../types";
import { enqueueTx } from "./outbox";

export type GraphState = {
  nodes: GraphNode[];
  links: GraphLink[];
  groups: GraphGroup[];
  versions: EntityVersions;
  revision: number;
  hydrated: boolean;
  /** Increments on every full load so the view can refit. */
  hydration: number;
  you: string | null;
  actions: HistoryAction[];
  future: HistoryAction[];
};

function initialState(): GraphState {
  const doc = typeof window === "undefined" ? { nodes: [], links: [], groups: [] } : loadDocument();
  return {
    nodes: doc.nodes,
    links: doc.links,
    groups: doc.groups ?? [],
    versions: { nodes: {}, links: {}, groups: {} },
    revision: 0,
    hydrated: false,
    hydration: 0,
    you: null,
    actions: [],
    future: [],
  };
}

export const graphStore = new Store<GraphState>(initialState());

const POSITION_EPSILON = 0.5;

function snapshot(state: GraphState): GraphSnapshot {
  return { nodes: state.nodes, links: state.links, groups: state.groups ?? [] };
}

function baseVersionsFor(patch: GraphPatch, positions: NodePosition[] = []): EntityVersions {
  const { versions } = graphStore.state;
  const nodes: Record<string, number> = {};
  const links: Record<string, number> = {};
  const groups: Record<string, number> = {};
  for (const c of patch.nodes) nodes[c.id] = versions.nodes[c.id] ?? 0;
  for (const c of patch.links) links[c.id] = versions.links[c.id] ?? 0;
  for (const c of patch.groups) groups[c.id] = versions.groups[c.id] ?? 0;
  for (const p of positions) delete nodes[p.id];
  return { nodes, links, groups };
}

function txFromPatch(patch: GraphPatch, label: string): MapTx {
  return {
    label,
    upsertNodes: patch.nodes.flatMap((c) => (c.after ? [c.after] : [])),
    deleteNodeIds: patch.nodes.filter((c) => !c.after).map((c) => c.id),
    upsertLinks: patch.links.flatMap((c) => (c.after ? [c.after] : [])),
    deleteLinkIds: patch.links.filter((c) => !c.after).map((c) => c.id),
    upsertGroups: patch.groups.flatMap((c) => (c.after ? [c.after] : [])),
    deleteGroupIds: patch.groups.filter((c) => !c.after).map((c) => c.id),
    baseVersions: baseVersionsFor(patch),
  };
}

function trimHistory(actions: HistoryAction[]) {
  return actions.length > HISTORY_LIMIT ? actions.slice(-HISTORY_LIMIT) : actions;
}

/** Applies a local edit: updates the document, records undo history, and queues the server write. */
export function commitGraph(
  label: string,
  next: { nodes?: GraphNode[]; links?: GraphLink[]; groups?: GraphGroup[] },
  coalesceKey?: string,
) {
  const state = graphStore.state;
  const before = snapshot(state);
  const after: GraphSnapshot = {
    nodes: next.nodes ?? state.nodes,
    links: next.links ?? state.links,
    groups: next.groups ?? state.groups,
  };
  const patch = diffPatch(before, after);
  const now = Date.now();

  graphStore.setState((s) => {
    if (isEmptyPatch(patch)) return { ...s, nodes: after.nodes, links: after.links, groups: after.groups };
    const last = s.actions[s.actions.length - 1];
    let actions: HistoryAction[];
    if (coalesceKey && last?.coalesceKey === coalesceKey && now - last.at < ACTION_COALESCE_MS) {
      const merged = mergePatch(last.patch, patch);
      if (isEmptyPatch(merged)) {
        actions = s.actions.slice(0, -1);
      } else {
        const changes = diffSnapshots(applyPatch(after, merged, "back"), after);
        actions = [
          ...s.actions.slice(0, -1),
          { ...last, label, at: now, patch: merged, changes, kind: actionKindFromChanges(changes) },
        ];
      }
    } else {
      const changes = diffSnapshots(before, after);
      actions = trimHistory([
        ...s.actions,
        { id: newId(), label, kind: actionKindFromChanges(changes), at: now, coalesceKey, patch, changes },
      ]);
    }
    return { ...s, nodes: after.nodes, links: after.links, groups: after.groups, actions, future: [] };
  });

  if (!isEmptyPatch(patch) && graphStore.state.hydrated) enqueueTx(txFromPatch(patch, label));
}

function restoreTo(target: GraphSnapshot, label: string, history: Pick<GraphState, "actions" | "future">) {
  const current = snapshot(graphStore.state);
  const patch = diffPatch(current, target);
  graphStore.setState((s) => ({ ...s, nodes: target.nodes, links: target.links, groups: target.groups, ...history }));
  if (!isEmptyPatch(patch) && graphStore.state.hydrated) enqueueTx(txFromPatch(patch, label));
}

/** Undoes the given action and every action after it. */
export function undoTo(actionId: string) {
  const { actions, future } = graphStore.state;
  const idx = actions.findIndex((a) => a.id === actionId);
  if (idx < 0) return false;
  const undone = actions.slice(idx);
  let target = snapshot(graphStore.state);
  for (const action of [...undone].reverse()) target = applyPatch(target, action.patch, "back");
  restoreTo(target, "Undid action", { actions: actions.slice(0, idx), future: [...undone, ...future] });
  return true;
}

export function undoLast() {
  const { actions } = graphStore.state;
  const last = actions[actions.length - 1];
  return last ? undoTo(last.id) : false;
}

export function redoNext() {
  const { actions, future } = graphStore.state;
  const next = future[0];
  if (!next) return false;
  const target = applyPatch(snapshot(graphStore.state), next.patch, "forward");
  restoreTo(target, "Redid action", { actions: [...actions, next], future: future.slice(1) });
  return true;
}

/** Saves positions without version checks or undo history. */
export function persistPositions(positions: NodePosition[], label = "Moved nodes") {
  const valid = positions.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length || !graphStore.state.hydrated) return;
  enqueueTx({ label, positions: valid });
}

/** Replaces the whole shared map (import). */
export function replaceGraph(doc: GraphDocument, label: string) {
  graphStore.setState((s) => ({
    ...s,
    nodes: doc.nodes,
    links: doc.links,
    groups: doc.groups ?? [],
    actions: [],
    future: [],
  }));
  enqueueTx({
    label,
    replace: {
      ...doc,
      nodes: doc.nodes.map(documentNode),
      links: doc.links.map(documentLink),
      groups: (doc.groups ?? []).map(documentGroup),
    },
  });
}

export function noteVersions(tx: MapTx, versions: EntityVersions) {
  graphStore.setState((s) => {
    const base = tx.replace ? { nodes: {}, links: {}, groups: {} } : s.versions;
    const merge = (current: Record<string, number>, incoming: Record<string, number> = {}) => {
      const out = { ...current };
      for (const [id, v] of Object.entries(incoming)) out[id] = Math.max(out[id] ?? 0, v);
      return out;
    };
    return {
      ...s,
      versions: {
        nodes: merge(base.nodes, versions.nodes),
        links: merge(base.links, versions.links),
        groups: merge(base.groups, versions.groups),
      },
    };
  });
}

export function applyFullMap(map: FullMap): ChangeItem[] {
  const before = snapshot(graphStore.state);
  const wasHydrated = graphStore.state.hydrated;
  graphStore.setState((s) => ({
    ...s,
    nodes: map.nodes,
    links: map.links,
    groups: map.groups ?? [],
    versions: map.versions,
    revision: map.revision,
    you: map.you,
    hydrated: true,
    hydration: s.hydration + 1,
    actions: wasHydrated ? s.actions : [],
    future: wasHydrated ? s.future : [],
  }));
  return wasHydrated ? diffSnapshots(before, { nodes: map.nodes, links: map.links, groups: map.groups ?? [] }) : [];
}

function near(a: number | undefined, b: number | undefined) {
  if (a == null || b == null) return a == b;
  return Math.abs(a - b) < POSITION_EPSILON;
}

/** Applies other people's changes from a delta and returns what changed for the sync feed. */
export function applyDelta(delta: MapDelta): ChangeItem[] {
  const me = mapClientId();
  const state = graphStore.state;
  const nodes = new Map(state.nodes.map((n) => [n.id, n]));
  const links = new Map(state.links.map((l) => [l.id, l]));
  const groups = new Map((state.groups ?? []).map((g) => [g.id, g]));
  const versions = {
    nodes: { ...state.versions.nodes },
    links: { ...state.versions.links },
    groups: { ...state.versions.groups },
  };
  let changed = false;

  for (const row of delta.nodes) {
    const id = row.item.id;
    versions.nodes[id] = Math.max(versions.nodes[id] ?? 0, row.version);
    if (row.client === me) continue;
    const current = nodes.get(id);
    if (row.deleted) {
      if (current) {
        nodes.delete(id);
        changed = true;
      }
      continue;
    }
    if (current && sameNodeContent(current, row.item) && near(current.x, row.item.x) && near(current.y, row.item.y)) {
      continue;
    }
    nodes.set(id, current ? { ...row.item, x: row.item.x ?? current.x, y: row.item.y ?? current.y } : row.item);
    changed = true;
  }

  for (const row of delta.links) {
    const id = row.item.id;
    versions.links[id] = Math.max(versions.links[id] ?? 0, row.version);
    if (row.client === me) continue;
    const current = links.get(id);
    if (row.deleted) {
      if (current) {
        links.delete(id);
        changed = true;
      }
      continue;
    }
    if (current && sameLink(current, row.item)) continue;
    links.set(id, row.item);
    changed = true;
  }

  for (const row of delta.groups ?? []) {
    const id = row.item.id;
    versions.groups[id] = Math.max(versions.groups[id] ?? 0, row.version);
    if (row.client === me) continue;
    const current = groups.get(id);
    if (row.deleted) {
      if (current) {
        groups.delete(id);
        changed = true;
      }
      continue;
    }
    if (current && sameGroup(current, row.item)) continue;
    groups.set(id, row.item);
    changed = true;
  }

  const before = snapshot(state);
  const after: GraphSnapshot = changed
    ? { nodes: [...nodes.values()], links: [...links.values()], groups: [...groups.values()] }
    : before;
  graphStore.setState((s) => ({
    ...s,
    nodes: after.nodes,
    links: after.links,
    groups: after.groups,
    versions,
    revision: Math.max(s.revision, delta.revision),
    you: delta.you ?? s.you,
  }));
  return changed ? diffSnapshots(before, after) : [];
}

export function graphNodeById(id: string) {
  return graphStore.state.nodes.find((n) => n.id === id) ?? null;
}
