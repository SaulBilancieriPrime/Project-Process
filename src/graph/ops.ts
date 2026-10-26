import { sizeForLevel } from "./colors";
import { descendantsOf, linkEnds } from "./visibility";
import { newId } from "../storage";
import type { GraphLink, GraphNode, NodeKind } from "../types";

export function blankNode(partial: Partial<GraphNode> & { title?: string }): GraphNode {
  const level = partial.level ?? 0;
  return {
    id: partial.id ?? newId(),
    title: partial.title ?? "New idea",
    description: partial.description ?? "",
    level,
    parentId: partial.parentId ?? null,
    type: partial.type ?? "concept",
    color: partial.color,
    size: partial.size ?? sizeForLevel(level),
    pinned: Boolean(partial.pinned),
    collapsed: false,
    x: partial.x,
    y: partial.y,
    fx: partial.pinned ? partial.x : undefined,
    fy: partial.pinned ? partial.y : undefined,
  };
}

export function addChild(nodes: GraphNode[], links: GraphLink[], parent: GraphNode): { nodes: GraphNode[]; links: GraphLink[]; id: string } {
  const siblings = nodes.filter((n) => n.parentId === parent.id);
  const angle = (siblings.length * 0.85) - 0.4;
  const dist = 48 + parent.size * 18;
  const child = blankNode({
    title: "New child",
    level: parent.level + 1,
    parentId: parent.id,
    type: parent.type === "category" ? "concept" : parent.type,
    x: (parent.x ?? 0) + Math.cos(angle) * dist,
    y: (parent.y ?? 0) + Math.sin(angle) * dist,
  });
  return {
    nodes: [...nodes, child],
    links: [...links, { id: newId(), source: parent.id, target: child.id, kind: "parent", arrows: "none" }],
    id: child.id,
  };
}

export function addLink(
  links: GraphLink[],
  source: string,
  target: string,
  kind: GraphLink["kind"] = "cross",
  arrows: GraphLink["arrows"] = "none",
) {
  if (source === target) return links;
  const exists = links.some((l) => {
    const e = linkEnds(l);
    return (e.source === source && e.target === target) || (e.source === target && e.target === source);
  });
  if (exists) return links;
  return [...links, { id: newId(), source, target, kind, arrows }];
}

export function deleteNode(nodes: GraphNode[], links: GraphLink[], id: string, branch: boolean) {
  const remove = new Set<string>([id]);
  if (branch) for (const d of descendantsOf(nodes, id)) remove.add(d);
  const nextNodes = nodes
    .filter((n) => !remove.has(n.id))
    .map((n) => (n.parentId && remove.has(n.parentId) ? { ...n, parentId: null } : n));
  const nextLinks = links.filter((l) => {
    const e = linkEnds(l);
    return !remove.has(e.source) && !remove.has(e.target);
  });
  return { nodes: nextNodes, links: nextLinks };
}

export function setPinned(node: GraphNode, pinned: boolean): GraphNode {
  return {
    ...node,
    pinned,
    fx: pinned ? node.x ?? node.fx : undefined,
    fy: pinned ? node.y ?? node.fy : undefined,
  };
}

export function applyPhysicsPins(nodes: GraphNode[], physics: boolean): GraphNode[] {
  return nodes.map((n) => {
    if (!physics) {
      return { ...n, fx: n.x ?? n.fx ?? 0, fy: n.y ?? n.fy ?? 0 };
    }
    if (n.pinned) {
      return { ...n, fx: n.x ?? n.fx ?? 0, fy: n.y ?? n.fy ?? 0 };
    }
    return { ...n, fx: undefined, fy: undefined };
  });
}

export const KIND_LABEL: Record<NodeKind, string> = {
  concept: "Concept",
  category: "Category",
  task: "Task",
  info: "Info",
};
