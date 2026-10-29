import { STATUS_COLORS, nodeWorkflowStatus } from "./workflowStatus";
import type { ColorBy, GraphGroup, GraphNode } from "../types";

export const DEFAULT_GROUP_TITLE = "Untitled group";
export const UNGROUPED_FILTER = "__ungrouped__";

export function groupTitle(title: string | undefined) {
  const next = (title ?? "").trim();
  return next || DEFAULT_GROUP_TITLE;
}

export function pruneEmptyGroups(nodes: GraphNode[], groups: GraphGroup[]): GraphGroup[] {
  const used = new Set(nodes.map((n) => n.groupId).filter((id): id is string => Boolean(id)));
  return groups.filter((group) => used.has(group.id));
}

/** Hull color: all done = green, all incomplete = red, anything else = orange. */
export function groupStatusColor(members: GraphNode[], colorBy: ColorBy) {
  const statuses = new Set(members.map((n) => nodeWorkflowStatus(n, colorBy)));
  if (statuses.size === 1 && statuses.has("done")) return STATUS_COLORS.done;
  if (statuses.size === 1 && statuses.has("incomplete")) return STATUS_COLORS.incomplete;
  return STATUS_COLORS.in_progress;
}
