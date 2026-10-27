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
    employee: partial.employee ?? "",
    employeeEmail: partial.employeeEmail ?? "",
    size: partial.size ?? sizeForLevel(level),
    x: partial.x,
    y: partial.y,
    fx: partial.fx,
    fy: partial.fy,
  };
}

export function addChild(
  nodes: GraphNode[],
  links: GraphLink[],
  parent: GraphNode,
  at?: { x: number; y: number },
  size?: number,
): { nodes: GraphNode[]; links: GraphLink[]; id: string } {
  const siblings = nodes.filter((n) => n.parentId === parent.id);
  const angle = (siblings.length * 0.85) - 0.4;
  const dist = 48 + parent.size * 18;
  const child = blankNode({
    title: "New idea",
    level: parent.level + 1,
    parentId: parent.id,
    type: parent.type === "category" ? "concept" : parent.type,
    color: parent.color,
    size,
    x: at?.x ?? (parent.x ?? 0) + Math.cos(angle) * dist,
    y: at?.y ?? (parent.y ?? 0) + Math.sin(angle) * dist,
  });
  return {
    nodes: [...nodes, child],
    links: [...links, { id: newId(), source: parent.id, target: child.id, kind: "parent", arrows: "none" }],
    id: child.id,
  };
}

export function insertNodeBetween(
  nodes: GraphNode[],
  links: GraphLink[],
  linkId: string,
): { nodes: GraphNode[]; links: GraphLink[]; id: string } | null {
  const link = links.find((l) => l.id === linkId);
  if (!link) return null;
  const e = linkEnds(link);
  const src = nodes.find((n) => n.id === e.source);
  const tgt = nodes.find((n) => n.id === e.target);
  if (!src || !tgt) return null;

  const x = ((src.x ?? 0) + (tgt.x ?? 0)) / 2;
  const y = ((src.y ?? 0) + (tgt.y ?? 0)) / 2;
  const mid = blankNode({
    title: "New step",
    level: Math.min(src.level, tgt.level) + 1,
    type: src.type === tgt.type ? src.type : "concept",
    x,
    y,
  });

  const rest = links.filter((l) => l.id !== linkId);
  const split: GraphLink[] = [
    { id: newId(), source: e.source, target: mid.id, kind: link.kind, arrows: link.arrows },
    { id: newId(), source: mid.id, target: e.target, kind: link.kind, arrows: link.arrows },
  ];

  return { nodes: [...nodes, mid], links: [...rest, ...split], id: mid.id };
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

function mergeLinkThroughNode(links: GraphLink[], nodeId: string) {
  const incident = links.filter((l) => {
    const e = linkEnds(l);
    return e.source === nodeId || e.target === nodeId;
  });
  if (incident.length !== 2) return null;

  let upstream: string | null = null;
  let downstream: string | null = null;
  let incoming: GraphLink | null = null;

  for (const l of incident) {
    const e = linkEnds(l);
    if (e.target === nodeId) {
      upstream = e.source;
      incoming = l;
    }
    if (e.source === nodeId) downstream = e.target;
  }

  if (!upstream || !downstream || upstream === downstream || !incoming) return null;

  return {
    upstream,
    downstream,
    kind: incoming.kind,
    arrows: incoming.arrows,
    dropIds: new Set(incident.map((l) => l.id)),
  };
}

export function deleteNode(nodes: GraphNode[], links: GraphLink[], id: string, branch: boolean) {
  const remove = new Set<string>([id]);
  if (branch) for (const d of descendantsOf(nodes, id)) remove.add(d);

  const nextNodes = nodes
    .filter((n) => !remove.has(n.id))
    .map((n) => (n.parentId && remove.has(n.parentId) ? { ...n, parentId: null } : n));

  let nextLinks: GraphLink[];
  const merge = !branch ? mergeLinkThroughNode(links, id) : null;
  if (merge) {
    nextLinks = links.filter((l) => !merge.dropIds.has(l.id));
    nextLinks = addLink(nextLinks, merge.upstream, merge.downstream, merge.kind, merge.arrows);
  } else {
    nextLinks = links.filter((l) => {
      const e = linkEnds(l);
      return !remove.has(e.source) && !remove.has(e.target);
    });
  }

  return { nodes: nextNodes, links: nextLinks };
}

export const KIND_LABEL: Record<NodeKind, string> = {
  concept: "Concept",
  category: "Category",
  task: "Task",
  info: "Info",
};
