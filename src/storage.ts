import { normalizeDeg } from "./graph/viewRotation";
import { markAllNodesIncomplete } from "./graph/workflowStatus";
import { createSampleDocument } from "./sampleData";
import {
  graphDocumentSchema,
  parseGraphDocument,
  themeSchema,
  type GraphDocument,
  type Theme,
} from "./schema";

const KEY = "project-process.graph.v8";
const LEGACY_GRAPH_KEYS = ["project-process.graph.v7", "project-process.graph.v6"];
const THEME_KEY = "project-process.theme";
const VIEW_ROTATION_KEY = "project-process.view-rotation";

export function newId() {
  return crypto.randomUUID();
}

export function serializeDocument(doc: GraphDocument): GraphDocument {
  return graphDocumentSchema.parse(doc);
}

export function loadDocument(): GraphDocument {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      for (const legacyKey of LEGACY_GRAPH_KEYS) {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (!legacyRaw) continue;
        const legacyDoc = parseGraphDocument(JSON.parse(legacyRaw));
        if (!legacyDoc.nodes.length) break;
        const migrated = markAllNodesIncomplete(legacyDoc);
        saveDocument(migrated);
        return migrated;
      }
      return createSampleDocument();
    }
    const doc = parseGraphDocument(JSON.parse(raw));
    if (!doc.nodes.length) return createSampleDocument();
    return serializeDocument(doc);
  } catch {
    return createSampleDocument();
  }
}

export function saveDocument(doc: GraphDocument) {
  localStorage.setItem(KEY, JSON.stringify(serializeDocument(doc)));
}

export function loadTheme(): Theme {
  try {
    return themeSchema.catch("dark").parse(localStorage.getItem(THEME_KEY));
  } catch {
    return "dark";
  }
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, themeSchema.parse(theme));
}

export function loadViewRotation() {
  try {
    const n = Number(localStorage.getItem(VIEW_ROTATION_KEY));
    return Number.isFinite(n) ? normalizeDeg(n) : 0;
  } catch {
    return 0;
  }
}

export function saveViewRotation(degrees: number) {
  try {
    localStorage.setItem(VIEW_ROTATION_KEY, String(normalizeDeg(degrees)));
  } catch {
    /* ignore quota / private mode */
  }
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
  const doc = parseGraphDocument(JSON.parse(await file.text()));
  if (!doc.nodes.length) throw new Error("No nodes in file");
  return doc;
}
