import { nodeWorkflowStatus, type WorkflowStatus } from "./workflowStatus";
import type { ColorBy, GraphLink, GraphNode } from "../types";

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
  colorBy: ColorBy,
  options?: {
    statusFilters?: WorkflowStatus[];
    employeeEmail?: string | null;
  },
) {
  if (!matchesQuery(node, query)) return false;
  const statusFilters = options?.statusFilters ?? [];
  if (statusFilters.length) {
    if (!statusFilters.includes(nodeWorkflowStatus(node, colorBy))) return false;
  }
  const employeeEmail = options?.employeeEmail;
  if (employeeEmail === "__unassigned__") {
    if (node.employeeEmail.trim()) return false;
  } else if (employeeEmail) {
    if (node.employeeEmail.trim().toLowerCase() !== employeeEmail.trim().toLowerCase()) return false;
  }
  return true;
}
