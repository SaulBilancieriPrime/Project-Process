import { linkEnds } from "./graph/visibility";
import { createSampleDocument } from "./sampleData";
import { DEFAULT_SETTINGS, type GraphDocument, type GraphLink, type GraphNode, type GraphSettings } from "./types";

function normalizeSettings(raw: Partial<GraphSettings> = {}): GraphSettings {
  const enlarge = Number(raw.enlarge);
  const legacyCards = (raw as { nodeView?: string }).nodeView === "cards";
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    cardInfo: typeof raw.cardInfo === "boolean" ? raw.cardInfo : legacyCards,
    enlarge: Number.isFinite(enlarge) ? Math.min(1.8, Math.max(0.7, enlarge)) : 1,
  };
}

const KEY = "project-process.graph.v4";
const THEME_KEY = "project-process.theme";

function uid() {
  return crypto.randomUUID();
}

export function newId() {
  return uid();
}

export function normalizeNode(raw: Partial<GraphNode>, index = 0): GraphNode {
  return {
    id: String(raw.id ?? uid()),
    title: String(raw.title ?? `Node ${index + 1}`),
    description: String(raw.description ?? ""),
    level: Number.isFinite(raw.level) ? Number(raw.level) : 0,
    parentId: raw.parentId ?? null,
    type: raw.type === "category" || raw.type === "task" || raw.type === "info" ? raw.type : "concept",
    color: raw.color,
    employee: typeof raw.employee === "string" ? raw.employee : "",
    employeeEmail: typeof raw.employeeEmail === "string" ? raw.employeeEmail : "",
    size: Number.isFinite(raw.size) ? Math.min(6.5, Math.max(0.5, Number(raw.size))) : 1,
    x: typeof raw.x === "number" ? raw.x : undefined,
    y: typeof raw.y === "number" ? raw.y : undefined,
  };
}

export function normalizeLink(raw: Partial<GraphLink> & { source?: unknown; target?: unknown }): GraphLink | null {
  const ends = linkEnds({ source: raw.source ?? "", target: raw.target ?? "" });
  if (!ends.source || !ends.target || ends.source === ends.target) return null;
  return {
    id: String(raw.id ?? `${ends.source}->${ends.target}`),
    source: ends.source,
    target: ends.target,
    kind: raw.kind === "cross" ? "cross" : "parent",
    arrows: raw.arrows === "one" || raw.arrows === "both" ? raw.arrows : "none",
  };
}

export function serializeDocument(doc: GraphDocument): GraphDocument {
  return {
    settings: normalizeSettings(doc.settings),
    nodes: doc.nodes.map((n) => normalizeNode(n)),
    links: doc.links.map((l) => normalizeLink(l)).filter((l): l is GraphLink => Boolean(l)),
  };
}

export function loadDocument(): GraphDocument {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createSampleDocument();
    const parsed = JSON.parse(raw) as Partial<GraphDocument>;
    const nodes = Array.isArray(parsed.nodes) ? parsed.nodes.map((n, i) => normalizeNode(n, i)) : [];
    const links = Array.isArray(parsed.links)
      ? parsed.links.map((l) => normalizeLink(l)).filter((l): l is GraphLink => Boolean(l))
      : [];
    if (!nodes.length) return createSampleDocument();
    return {
      nodes,
      links,
      settings: normalizeSettings(parsed.settings),
    };
  } catch {
    return createSampleDocument();
  }
}

export function saveDocument(doc: GraphDocument) {
  localStorage.setItem(KEY, JSON.stringify(serializeDocument(doc)));
}

export function loadTheme(): "light" | "dark" {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(theme: "light" | "dark") {
  localStorage.setItem(THEME_KEY, theme);
}

export function downloadJson(doc: GraphDocument, filename = "project-process-graph.json") {
  const blob = new Blob([JSON.stringify(serializeDocument(doc), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<GraphDocument> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<GraphDocument>;
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes.map((n, i) => normalizeNode(n, i)) : [];
  const links = Array.isArray(parsed.links)
    ? parsed.links.map((l) => normalizeLink(l)).filter((l): l is GraphLink => Boolean(l))
    : [];
  if (!nodes.length) throw new Error("No nodes in file");
  return {
    nodes,
    links,
    settings: normalizeSettings(parsed.settings),
  };
}
