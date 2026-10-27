import { KIND_LABEL } from "./ops";
import { linkEnds } from "./visibility";
import type { GraphLink, GraphNode, GraphSettings } from "../types";

export type ChangeKind = "add" | "remove" | "update";
export type ChangeTarget = "node" | "link" | "settings";

export type ChangeItem = {
  id: string;
  kind: ChangeKind;
  target: ChangeTarget;
  title: string;
  detail: string;
};

export type GraphSnapshot = {
  nodes: GraphNode[];
  links: GraphLink[];
  settings: GraphSettings;
};

export type HistoryAction = {
  id: string;
  label: string;
  kind: ChangeKind;
  at: number;
  coalesceKey?: string;
  before: GraphSnapshot;
  after: GraphSnapshot;
  changes: ChangeItem[];
};

export const ACTION_COALESCE_MS = 900;

export function actionKindFromChanges(changes: ChangeItem[]): ChangeKind {
  if (changes.length && changes.every((c) => c.kind === "add")) return "add";
  if (changes.length && changes.every((c) => c.kind === "remove")) return "remove";
  return "update";
}

export function mergeAction(prev: HistoryAction, after: GraphSnapshot, label?: string): HistoryAction {
  const changes = diffSnapshots(prev.before, after);
  return {
    ...prev,
    label: label ?? prev.label,
    kind: actionKindFromChanges(changes),
    at: Date.now(),
    after,
    changes,
  };
}

export function cloneSnapshot(nodes: GraphNode[], links: GraphLink[], settings: GraphSettings): GraphSnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n })),
    links: links.map((l) => ({ ...l })),
    settings: { ...settings },
  };
}

function nodeLabel(node: GraphNode) {
  return node.title.trim() || "Untitled node";
}

function linkLabel(link: GraphLink, nodes: GraphNode[]) {
  const e = linkEnds(link);
  const src = nodes.find((n) => n.id === e.source);
  const tgt = nodes.find((n) => n.id === e.target);
  const a = src ? nodeLabel(src) : "Unknown";
  const b = tgt ? nodeLabel(tgt) : "Unknown";
  return `${a} → ${b}`;
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
        title: `Added ${nodeLabel(node)}`,
        detail: `${KIND_LABEL[node.type]} · L${node.level}`,
      });
      continue;
    }
    const details: string[] = [];
    if (prev.title !== node.title) details.push(fieldChange("Title", prev.title || "Untitled", node.title || "Untitled"));
    if (prev.description !== node.description) details.push("Description updated");
    if (prev.type !== node.type) details.push(fieldChange("Type", KIND_LABEL[prev.type], KIND_LABEL[node.type]));
    if (prev.level !== node.level) details.push(fieldChange("Level", `L${prev.level}`, `L${node.level}`));
    if ((prev.color ?? "") !== (node.color ?? "")) details.push("Color changed");
    if ((prev.employee ?? "") !== (node.employee ?? "")) details.push("Employee changed");
    if (Math.abs((prev.size ?? 1) - (node.size ?? 1)) > 0.04) details.push("Size changed");
    if (details.length) {
      changes.push({
        id: `node-upd-${node.id}`,
        kind: "update",
        target: "node",
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
      title: `Removed ${nodeLabel(node)}`,
      detail: `${KIND_LABEL[node.type]} · L${node.level}`,
    });
  }

  const savedLinks = new Map(saved.links.map((l) => [l.id, l]));
  const currentLinks = new Map(current.links.map((l) => [l.id, l]));

  for (const link of current.links) {
    const prev = savedLinks.get(link.id);
    if (!prev) {
      changes.push({
        id: `link-add-${link.id}`,
        kind: "add",
        target: "link",
        title: "Added connection",
        detail: linkLabel(link, current.nodes),
      });
      continue;
    }
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
        title: "Updated connection",
        detail: `${linkLabel(link, current.nodes)} · ${details.join(" · ")}`,
      });
    }
  }

  for (const link of saved.links) {
    if (currentLinks.has(link.id)) continue;
    changes.push({
      id: `link-del-${link.id}`,
      kind: "remove",
      target: "link",
      title: "Removed connection",
      detail: linkLabel(link, saved.nodes),
    });
  }

  const settingLabels: [keyof GraphSettings, string][] = [
    ["physics", "Force layout"],
    ["radial", "Radial branch"],
    ["colorBy", "Color grouping"],
    ["cardInfo", "Cards"],
    ["enlarge", "Enlarge"],
    ["charge", "Charge"],
    ["linkDistance", "Link distance"],
    ["collide", "Collision"],
  ];
  const settingDetails = settingLabels
    .filter(([key]) => saved.settings[key] !== current.settings[key])
    .map(([key, label]) => `${label}: ${String(saved.settings[key])} → ${String(current.settings[key])}`);
  if (settingDetails.length) {
    changes.push({
      id: "settings",
      kind: "update",
      target: "settings",
      title: "Updated map settings",
      detail: settingDetails.join(" · "),
    });
  }

  return changes;
}
