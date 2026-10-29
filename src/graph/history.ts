import { KIND_LABEL } from "./ops";
import { linkEnds } from "./visibility";
import type { GraphLink, GraphNode } from "../types";

export type ChangeKind = "add" | "remove" | "update";
export type ChangeTarget = "node" | "link";

export type ChangeItem = {
  id: string;
  kind: ChangeKind;
  target: ChangeTarget;
  targetId: string;
  title: string;
  detail: string;
};

export type GraphSnapshot = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export type EntityChange<T> = { id: string; before: T | null; after: T | null };

/** Only the entities an action touched, with their state before and after. */
export type GraphPatch = {
  nodes: EntityChange<GraphNode>[];
  links: EntityChange<GraphLink>[];
};

export type HistoryAction = {
  id: string;
  label: string;
  kind: ChangeKind;
  at: number;
  coalesceKey?: string;
  patch: GraphPatch;
  changes: ChangeItem[];
};

export const ACTION_COALESCE_MS = 900;
export const HISTORY_LIMIT = 200;

const NODE_CONTENT_KEYS = [
  "title",
  "description",
  "level",
  "parentId",
  "type",
  "color",
  "employee",
  "employeeEmail",
  "size",
] as const satisfies readonly (keyof GraphNode)[];

export function sameNodeContent(a: GraphNode, b: GraphNode) {
  return NODE_CONTENT_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

export function sameLink(a: GraphLink, b: GraphLink) {
  const ea = linkEnds(a);
  const eb = linkEnds(b);
  return ea.source === eb.source && ea.target === eb.target && a.kind === b.kind && a.arrows === b.arrows;
}

/** Copies a node without the force engine's transient fields. */
export function documentNode(node: GraphNode): GraphNode {
  const { vx: _vx, vy: _vy, fx: _fx, fy: _fy, ...rest } = node;
  return rest;
}

export function documentLink(link: GraphLink): GraphLink {
  const e = linkEnds(link);
  return { id: link.id, source: e.source, target: e.target, kind: link.kind, arrows: link.arrows };
}

export function actionKindFromChanges(changes: ChangeItem[]): ChangeKind {
  if (changes.length && changes.every((c) => c.kind === "add")) return "add";
  if (changes.length && changes.every((c) => c.kind === "remove")) return "remove";
  return "update";
}

export function diffPatch(before: GraphSnapshot, after: GraphSnapshot): GraphPatch {
  const patch: GraphPatch = { nodes: [], links: [] };
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodeIds = new Set<string>();
  for (const node of after.nodes) {
    afterNodeIds.add(node.id);
    const prev = beforeNodes.get(node.id);
    if (prev === node) continue;
    if (!prev) patch.nodes.push({ id: node.id, before: null, after: documentNode(node) });
    else if (!sameNodeContent(prev, node)) {
      patch.nodes.push({ id: node.id, before: documentNode(prev), after: documentNode(node) });
    }
  }
  for (const node of before.nodes) {
    if (!afterNodeIds.has(node.id)) patch.nodes.push({ id: node.id, before: documentNode(node), after: null });
  }

  const beforeLinks = new Map(before.links.map((l) => [l.id, l]));
  const afterLinkIds = new Set<string>();
  for (const link of after.links) {
    afterLinkIds.add(link.id);
    const prev = beforeLinks.get(link.id);
    if (prev === link) continue;
    if (!prev) patch.links.push({ id: link.id, before: null, after: documentLink(link) });
    else if (!sameLink(prev, link)) {
      patch.links.push({ id: link.id, before: documentLink(prev), after: documentLink(link) });
    }
  }
  for (const link of before.links) {
    if (!afterLinkIds.has(link.id)) patch.links.push({ id: link.id, before: documentLink(link), after: null });
  }
  return patch;
}

export function isEmptyPatch(patch: GraphPatch) {
  return !patch.nodes.length && !patch.links.length;
}

function mergeChanges<T>(older: EntityChange<T>[], newer: EntityChange<T>[]) {
  const merged = new Map(older.map((c) => [c.id, { ...c }]));
  for (const change of newer) {
    const prev = merged.get(change.id);
    merged.set(change.id, prev ? { id: change.id, before: prev.before, after: change.after } : { ...change });
  }
  return [...merged.values()].filter((c) => c.before || c.after);
}

export function mergePatch(older: GraphPatch, newer: GraphPatch): GraphPatch {
  return { nodes: mergeChanges(older.nodes, newer.nodes), links: mergeChanges(older.links, newer.links) };
}

/**
 * Applies a patch forward (redo) or backward (undo). Nodes that still exist keep their
 * current position so undoing a text edit does not snap the node back across the canvas.
 */
export function applyPatch(state: GraphSnapshot, patch: GraphPatch, direction: "forward" | "back"): GraphSnapshot {
  const pick = <T,>(c: EntityChange<T>) => (direction === "back" ? c.before : c.after);

  const nodes = new Map(state.nodes.map((n) => [n.id, n]));
  for (const change of patch.nodes) {
    const target = pick(change);
    const current = nodes.get(change.id);
    if (!target) nodes.delete(change.id);
    else nodes.set(change.id, current ? { ...target, x: current.x, y: current.y } : { ...target });
  }

  const links = new Map(state.links.map((l) => [l.id, l]));
  for (const change of patch.links) {
    const target = pick(change);
    if (!target) links.delete(change.id);
    else links.set(change.id, { ...target });
  }

  return { nodes: [...nodes.values()], links: [...links.values()] };
}

function nodeLabel(node: GraphNode) {
  return node.title.trim() || "Untitled node";
}

function linkLabel(link: GraphLink, nodes: Map<string, GraphNode>) {
  const e = linkEnds(link);
  const src = nodes.get(e.source);
  const tgt = nodes.get(e.target);
  return `${src ? nodeLabel(src) : "Unknown"} → ${tgt ? nodeLabel(tgt) : "Unknown"}`;
}

function fieldChange(label: string, before: string, after: string) {
  return `${label}: ${before} → ${after}`;
}

export function diffSnapshots(saved: GraphSnapshot, current: GraphSnapshot): ChangeItem[] {
  const changes: ChangeItem[] = [];
  const savedNodes = new Map(saved.nodes.map((n) => [n.id, n]));
  const currentNodes = new Map(current.nodes.map((n) => [n.id, n]));

  for (const node of current.nodes) {
    const prev = savedNodes.get(node.id);
    if (!prev) {
      changes.push({
        id: `node-add-${node.id}`,
        kind: "add",
        target: "node",
        targetId: node.id,
        title: `Added ${nodeLabel(node)}`,
        detail: `${KIND_LABEL[node.type]} · L${node.level}`,
      });
      continue;
    }
    if (prev === node) continue;
    const details: string[] = [];
    if (prev.title !== node.title) details.push(fieldChange("Title", prev.title || "Untitled", node.title || "Untitled"));
    if (prev.description !== node.description) details.push("Description updated");
    if (prev.type !== node.type) details.push(fieldChange("Type", KIND_LABEL[prev.type], KIND_LABEL[node.type]));
    if (prev.level !== node.level) details.push(fieldChange("Level", `L${prev.level}`, `L${node.level}`));
    if ((prev.color ?? "") !== (node.color ?? "")) details.push("Status changed");
    if ((prev.employee ?? "") !== (node.employee ?? "") || (prev.employeeEmail ?? "") !== (node.employeeEmail ?? "")) {
      details.push("Employee changed");
    }
    if (Math.abs((prev.size ?? 1) - (node.size ?? 1)) > 0.04) details.push("Size changed");
    if (details.length) {
      changes.push({
        id: `node-upd-${node.id}`,
        kind: "update",
        target: "node",
        targetId: node.id,
        title: `Updated ${nodeLabel(node)}`,
        detail: details.join(" · "),
      });
    }
  }

  for (const node of saved.nodes) {
    if (currentNodes.has(node.id)) continue;
    changes.push({
      id: `node-del-${node.id}`,
      kind: "remove",
      target: "node",
      targetId: node.id,
      title: `Removed ${nodeLabel(node)}`,
      detail: `${KIND_LABEL[node.type]} · L${node.level}`,
    });
  }

  const savedLinks = new Map(saved.links.map((l) => [l.id, l]));
  const currentLinkIds = new Set(current.links.map((l) => l.id));

  for (const link of current.links) {
    const prev = savedLinks.get(link.id);
    if (!prev) {
      changes.push({
        id: `link-add-${link.id}`,
        kind: "add",
        target: "link",
        targetId: link.id,
        title: "Added connection",
        detail: linkLabel(link, currentNodes),
      });
      continue;
    }
    if (prev === link) continue;
    const details: string[] = [];
    if (prev.arrows !== link.arrows) details.push(fieldChange("Arrows", prev.arrows, link.arrows));
    if (prev.kind !== link.kind) details.push(fieldChange("Type", prev.kind, link.kind));
    const prevEnds = linkEnds(prev);
    const nextEnds = linkEnds(link);
    if (prevEnds.source !== nextEnds.source || prevEnds.target !== nextEnds.target) {
      details.push("Endpoints changed");
    }
    if (details.length) {
      changes.push({
        id: `link-upd-${link.id}`,
        kind: "update",
        target: "link",
        targetId: link.id,
        title: "Updated connection",
        detail: `${linkLabel(link, currentNodes)} · ${details.join(" · ")}`,
      });
    }
  }

  for (const link of saved.links) {
    if (currentLinkIds.has(link.id)) continue;
    changes.push({
      id: `link-del-${link.id}`,
      kind: "remove",
      target: "link",
      targetId: link.id,
      title: "Removed connection",
      detail: linkLabel(link, savedNodes),
    });
  }

  return changes;
}
