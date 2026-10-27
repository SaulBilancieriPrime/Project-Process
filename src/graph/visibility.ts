import { nodeColor, normalizeHex } from "./colors";
import type { ColorBy, GraphLink, GraphNode, NodeKind } from "../types";

export function childrenOf(nodes: GraphNode[], id: string) {
  return nodes.filter((n) => n.parentId === id);
}

export function descendantsOf(nodes: GraphNode[], id: string) {
  const out: string[] = [];
  const walk = (parentId: string) => {
    for (const child of childrenOf(nodes, parentId)) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

export function hiddenByCollapse(nodes: GraphNode[]) {
  const hidden = new Set<string>();
  for (const node of nodes) {
    if (!node.collapsed) continue;
    for (const id of descendantsOf(nodes, node.id)) hidden.add(id);
  }
  return hidden;
}

export function linkEnds(link: GraphLink | { source: unknown; target: unknown }) {
  const src = typeof link.source === "object" && link.source && "id" in link.source
    ? String((link.source as { id: string }).id)
    : String(link.source);
  const tgt = typeof link.target === "object" && link.target && "id" in link.target
    ? String((link.target as { id: string }).id)
    : String(link.target);
  return { source: src, target: tgt };
}

export function matchesQuery(node: GraphNode, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return node.title.toLowerCase().includes(q) || node.description.toLowerCase().includes(q);
}

export function isFiltered(
  node: GraphNode,
  query: string,
  levels: number[],
  types: NodeKind[],
  colors: string[],
  colorBy: ColorBy,
) {
  if (!matchesQuery(node, query)) return false;
  if (levels.length && !levels.includes(node.level)) return false;
  if (types.length && !types.includes(node.type)) return false;
  if (colors.length) {
    const paint = normalizeHex(nodeColor(node, colorBy));
    const allowed = new Set(colors.map(normalizeHex));
    if (!allowed.has(paint)) return false;
  }
  return true;
}

export function collapsedChildCount(nodes: GraphNode[], id: string) {
  return descendantsOf(nodes, id).length;
}
