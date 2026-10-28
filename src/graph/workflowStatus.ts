import { graphDocumentSchema } from "../schema/graph";
import { normalizeHex } from "./colors";
import type { ColorBy, GraphDocument, GraphNode } from "../types";

export type WorkflowStatus = "done" | "in_progress" | "incomplete";

/** Canonical node colors — every node renders as one of these three. */
export const STATUS_COLORS: Record<WorkflowStatus, string> = {
  done: "#4ade80",
  in_progress: "#fb923c",
  incomplete: "#f87171",
};

export const WORKFLOW_STATUS_META: {
  id: WorkflowStatus;
  label: string;
  /** Compact label for filter pills in the left rail. */
  filterLabel: string;
  pillBg: string;
  pillText: string;
}[] = [
  { id: "done", label: "Done", filterLabel: "Done", pillBg: "#86efac", pillText: "#14532d" },
  { id: "in_progress", label: "In progress", filterLabel: "WIP", pillBg: "#fdba74", pillText: "#7c2d12" },
  { id: "incomplete", label: "Incomplete", filterLabel: "I", pillBg: "#fca5a5", pillText: "#7f1d1d" },
];

/** Stored export colors → workflow state (legacy JSON and edits). */
const PAINT_TO_STATUS: Record<string, WorkflowStatus> = {
  "#34d399": "done",
  "#4ade80": "done",
  "#86efac": "done",
  "#e67e22": "in_progress",
  "#fb923c": "in_progress",
  "#fdba74": "in_progress",
  "#f59e0b": "in_progress",
  "#5b9bd5": "incomplete",
  "#8b5cf6": "incomplete",
  "#f87171": "incomplete",
  "#fca5a5": "incomplete",
  "#93c5fd": "incomplete",
  "#f43f5e": "incomplete",
  "#38bdf8": "incomplete",
};

export function isEmptyStub(node: GraphNode) {
  const title = node.title.trim();
  const desc = node.description.trim();
  return !desc || desc === title;
}

export function chapterNodes(nodes: GraphNode[]) {
  return nodes.filter((n) => n.level > 0);
}

export function nodeWorkflowStatus(node: GraphNode, _colorBy?: ColorBy): WorkflowStatus {
  if (node.color) {
    const mapped = PAINT_TO_STATUS[normalizeHex(node.color)];
    if (mapped) return mapped;
  }
  if (isEmptyStub(node)) return "incomplete";
  return "incomplete";
}

export function workflowStatusColor(status: WorkflowStatus) {
  return STATUS_COLORS[status];
}

/** Set every node's paint color to incomplete (red) — used for default graph and migrations. */
export function markAllNodesIncomplete(doc: GraphDocument): GraphDocument {
  const color = STATUS_COLORS.incomplete;
  return graphDocumentSchema.parse({
    ...doc,
    nodes: doc.nodes.map((node) => ({ ...node, color })),
  });
}

export function workflowStats(nodes: GraphNode[], colorBy: ColorBy) {
  const chapters = chapterNodes(nodes);
  const total = chapters.length;
  const counts: Record<WorkflowStatus, number> = {
    done: 0,
    in_progress: 0,
    incomplete: 0,
  };
  for (const node of chapters) {
    counts[nodeWorkflowStatus(node, colorBy)] += 1;
  }
  return {
    total,
    counts,
    done: counts.done,
    inProgress: counts.in_progress,
    incomplete: counts.incomplete,
  };
}

export function statusPercent(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

export function personAssignmentStats(nodes: GraphNode[], colorBy: ColorBy, email: string) {
  const assigned = chapterNodes(nodes).filter(
    (n) => n.employeeEmail.trim().toLowerCase() === email.trim().toLowerCase(),
  );
  const done = assigned.filter((n) => nodeWorkflowStatus(n, colorBy) === "done").length;
  return { total: assigned.length, done, pct: statusPercent(done, assigned.length) };
}
