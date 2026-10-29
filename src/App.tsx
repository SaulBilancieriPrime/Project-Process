import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import DraftPrompt from "./components/DraftPrompt";
import EditLinkPanel from "./components/EditLinkPanel";
import { type NodeEditPreview } from "./components/EditNodePanel";
import LeftSidePanel from "./components/LeftSidePanel";
import PlusMenu from "./components/PlusMenu";
import PlusMenuButton from "./components/PlusMenuButton";
import ViewCompass from "./components/ViewCompass";
import GraphCanvas, { type GraphHandle, type LassoMode } from "./components/GraphCanvas";
import Header from "./components/Header";
import HistoryPanel from "./components/HistoryPanel";
import InfoPanel from "./components/InfoPanel";
import LinkContextMenu from "./components/LinkContextMenu";
import NodeContextMenu from "./components/NodeContextMenu";
import NodePreviewPanel from "./components/NodePreviewPanel";
import SelectionPanel from "./components/SelectionPanel";
import SyncChangesFeed from "./components/SyncChangesFeed";
import { nodeColor } from "./graph/colors";
import type { WorkflowStatus } from "./graph/workflowStatus";
import { addChild, addLink, blankNode, deleteNode, insertNodeBetween } from "./graph/ops";
import { mergeViewSettings } from "./graph/viewSettings";
import { degToRad, rotatePoint, viewCoverOffset } from "./graph/viewRotation";
import { isFiltered, linkEnds } from "./graph/visibility";
import { useMapSync } from "./hooks/useMapSync";
import { selectionPanelPlacement } from "./lib/floatPanelPlacement";
import { DEFAULT_SETTINGS } from "./schema/graph";
import {
  downloadJson,
  loadViewRotation,
  loadViewSettings,
  readJsonFile,
  saveDocument,
  saveViewRotation,
  saveViewSettings,
} from "./storage";
import { discardDrafts, hasDrafts, saveDrafts } from "./store/drafts";
import {
  commitGraph,
  graphStore,
  persistPositions,
  redoNext,
  replaceGraph,
  undoLast,
  undoTo,
} from "./store/graph";
import { patchUi, showToast, toggleHistory, toggleInfo, uiStore } from "./store/ui";
import { ctxBox, cx } from "./styles";
import type { ArrowStyle, GraphLink, GraphNode, GraphSettings } from "./types";

type MenuState =
  | { kind: "node"; id: string; x: number; y: number }
  | { kind: "link"; id: string; x: number; y: number }
  | { kind: "canvas"; x: number; y: number };

type PickState = { kind: "node" | "link"; id: string };
type PlaceState = { parentId?: string; size?: number };
type PendingEdit = { kind: "node"; id: string } | { kind: "link"; id: string };

const POSITION_EPSILON = 0.5;

export default function App() {
  const nodes = useStore(graphStore, (s) => s.nodes);
  const links = useStore(graphStore, (s) => s.links);
  const actions = useStore(graphStore, (s) => s.actions);
  const future = useStore(graphStore, (s) => s.future);
  const hydration = useStore(graphStore, (s) => s.hydration);
  const liveStatus = useMapSync();
  const [settings, setSettings] = useState<GraphSettings>(() => loadViewSettings(DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS);
  const theme = useStore(uiStore, (s) => s.theme);
  const historyOpen = useStore(uiStore, (s) => s.historyOpen);
  const infoOpen = useStore(uiStore, (s) => s.infoOpen);
  const toast = useStore(uiStore, (s) => s.toast);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickState | null>(null);
  const [connect, setConnect] = useState<{ arrows: ArrowStyle; from?: string } | null>(null);
  const [placing, setPlacing] = useState<PlaceState | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<WorkflowStatus[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<{ proceed: () => void } | null>(null);
  const hideFiltered = Boolean(search.trim()) || statusFilters.length > 0 || employeeFilter != null;
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [zoom, setZoom] = useState(1);
  const [viewRotation, setViewRotation] = useState(loadViewRotation);
  const [viewSpinning, setViewSpinning] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphHandle | undefined>(undefined);
  const importRef = useRef<HTMLInputElement>(null);
  const persistTimer = useRef<number | null>(null);
  const persistedPositions = useRef(new Map<string, { x: number; y: number }>());
  const fittedOnce = useRef(false);
  const editSaveRef = useRef<(() => void) | null>(null);
  const [editLocked, setEditLocked] = useState(false);
  const [previewAnchorId, setPreviewAnchorId] = useState<string | null>(null);
  const previewOverRef = useRef(false);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [editVisual, setEditVisual] = useState<NodeEditPreview | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const editing = editingId ? nodeById.get(editingId) ?? null : null;
  const editingLink = links.find((l) => l.id === editingLinkId) ?? null;

  /** Runs `proceed` now, or after the user resolves unsaved Title/Description drafts. */
  const guardDraft = useCallback((proceed: () => void) => {
    if (!hasDrafts()) {
      proceed();
      return;
    }
    setDraftPrompt({ proceed });
  }, []);

  useEffect(() => {
    if (hoveredId) {
      setPreviewAnchorId(hoveredId);
      return;
    }
    if (previewOverRef.current) return;
    const timer = window.setTimeout(() => setPreviewAnchorId(null), 120);
    return () => window.clearTimeout(timer);
  }, [hoveredId]);

  const previewTargetId =
    !editingLink && !menu && !placing && !connect && !editLocked ? (hoveredId ?? previewAnchorId) : null;
  const preview = previewTargetId ? nodeById.get(previewTargetId) ?? null : null;
  const graphNodes = useMemo(() => {
    if (!editVisual || !editingId) return nodes;
    return nodes.map((n) => (n.id === editingId ? { ...n, size: editVisual.size, color: editVisual.color } : n));
  }, [nodes, editingId, editVisual]);
  const previewNode = preview && editVisual && preview.id === editingId ? { ...preview, ...editVisual } : preview;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    saveViewRotation(viewRotation);
  }, [viewRotation]);

  useEffect(() => {
    saveViewSettings(settings);
  }, [settings]);

  useEffect(() => {
    fittedOnce.current = false;
    persistedPositions.current = new Map(
      graphStore.state.nodes.flatMap((n) => (n.x != null && n.y != null ? [[n.id, { x: n.x, y: n.y }] as const] : [])),
    );
  }, [hydration]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      saveDocument({ nodes, links, settings });
    }, 450);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [nodes, links, settings]);

  useEffect(() => {
    if (!editing && !editingLink) setEditLocked(false);
  }, [editing, editingLink]);

  // Remote deletes or undo can remove what the UI is pointing at.
  useEffect(() => {
    const linkIds = new Set(links.map((l) => l.id));
    setEditingId((cur) => (cur && !nodeById.has(cur) ? null : cur));
    setEditingLinkId((cur) => (cur && !linkIds.has(cur) ? null : cur));
    setSelectedIds((prev) => (prev.every((id) => nodeById.has(id)) ? prev : prev.filter((id) => nodeById.has(id))));
    setPicked((cur) => {
      if (!cur) return null;
      if (cur.kind === "node" && !nodeById.has(cur.id)) return null;
      if (cur.kind === "link" && !linkIds.has(cur.id)) return null;
      return cur;
    });
    setMenu((cur) => {
      if (!cur || cur.kind === "canvas") return cur;
      if (cur.kind === "node" && !nodeById.has(cur.id)) return null;
      if (cur.kind === "link" && !linkIds.has(cur.id)) return null;
      return cur;
    });
  }, [nodeById, links]);

  const dismissEditPanel = useCallback(() => {
    setEditLocked(false);
    setEditingId(null);
    setEditingLinkId(null);
    setPreviewAnchorId(null);
    setPendingEdit(null);
    setEditVisual(null);
  }, []);

  useEffect(() => {
    if (!pendingEdit) return;
    if (editingId !== null || editingLinkId !== null) return;
    const next = pendingEdit;
    const timer = window.setTimeout(() => {
      setPendingEdit(null);
      if (next.kind === "node") {
        setSelectedIds([next.id]);
        setPicked({ kind: "node", id: next.id });
        setEditingLinkId(null);
        setEditingId(next.id);
      } else {
        setSelectedIds([]);
        setPicked({ kind: "link", id: next.id });
        setEditingId(null);
        setEditingLinkId(next.id);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingEdit, editingId, editingLinkId]);

  const dismissPreview = useCallback(() => {
    setPreviewAnchorId(null);
    setSelectedIds([]);
    setPicked(null);
    setEditingId(null);
    setEditVisual(null);
  }, []);

  useEffect(() => {
    const linkEditing = editingLinkId !== null;
    if (!menu && !linkEditing) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const onGraph = Boolean(target.closest(".graph-host"));
      if (menu && !target.closest(".ctx, .plus-menu-floating")) {
        setMenu(null);
      }
      if (linkEditing && !editLocked && !target.closest(".edit-float") && !onGraph) {
        dismissEditPanel();
        setSelectedIds([]);
        setPicked(null);
      }
    };
    const timer = window.setTimeout(() => window.addEventListener("pointerdown", onPointerDown, true), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [menu, editingLinkId, editLocked, dismissEditPanel]);

  function clearInteraction() {
    setMenu(null);
    setConnect(null);
    setPlacing(null);
    setPlusOpen(false);
    setEditingId(null);
    setEditingLinkId(null);
    setPicked(null);
    setSelectedIds([]);
    setPreviewAnchorId(null);
    setPendingEdit(null);
    setEditVisual(null);
    patchUi({ historyOpen: false, infoOpen: false });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape") {
        if (editLocked || draftPrompt) return;
        guardDraft(clearInteraction);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editLocked) editSaveRef.current?.();
        else if (hasDrafts()) saveDrafts();
        return;
      }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (!editLocked) undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        if (!editLocked) redo();
      }
      if (e.key === "Delete") {
        if (editLocked || editingLinkId) return;
        if (picked?.kind === "link") removeLink(picked.id);
        else if (selectedIds.length) removeNodes(selectedIds);
      }
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey) {
        startPlace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function undo() {
    if (undoLast()) showToast("Undid action");
  }

  function redo() {
    if (redoNext()) showToast("Redid action");
  }

  function openContextMenu(next: MenuState) {
    if (editLocked) return;
    setMenu(next);
    setPlusOpen(false);
  }

  function liveGraphNodes() {
    const fg = graphRef.current as (GraphHandle & { graphData?: unknown }) | undefined;
    const raw = fg?.graphData;
    try {
      const data = typeof raw === "function" ? (raw as () => { nodes?: GraphNode[] })() : raw as { nodes?: GraphNode[] } | undefined;
      return data?.nodes ?? [];
    } catch {
      return [];
    }
  }

  function liveNode(id: string) {
    return liveGraphNodes().find((n) => n.id === id) ?? nodeById.get(id);
  }

  function savePositions(positions: { id: string; x: number; y: number }[], label: string) {
    for (const p of positions) persistedPositions.current.set(p.id, { x: p.x, y: p.y });
    persistPositions(positions, label);
  }

  function patchSettings(patch: Partial<GraphSettings>) {
    setSettings(mergeViewSettings(settings, patch));
  }

  function updateNode(id: string, patch: Partial<GraphNode>) {
    const current = graphStore.state.nodes.find((n) => n.id === id);
    if (!current) return;
    const name = current.title.trim() || "node";
    let label = `Edited ${name}`;
    if (patch.color && Object.keys(patch).length === 1) {
      label = `Changed status of ${name}`;
    } else if (patch.size !== undefined && Object.keys(patch).length === 1) {
      label = `Resized ${name}`;
    } else if (patch.employee !== undefined && Object.keys(patch).length <= 2) {
      label = `Assigned ${name}`;
    }
    commitGraph(
      label,
      { nodes: graphStore.state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) },
      `node:${id}:edit`,
    );
  }

  function updateSelectedNodes(patch: Partial<GraphNode>, label: string) {
    const ids = new Set(selectedIds);
    commitGraph(
      label,
      { nodes: graphStore.state.nodes.map((n) => (ids.has(n.id) ? { ...n, ...patch } : n)) },
      `selection:${Object.keys(patch).sort().join(",")}`,
    );
  }

  function openNodeEditor(id: string) {
    setSelectedIds([id]);
    setPicked({ kind: "node", id });
    setEditingId(id);
    setEditVisual(null);
  }

  function addLooseNode(at: { x: number; y: number }) {
    const { nodes: current, links: currentLinks } = graphStore.state;
    const parentId = placing?.parentId;
    const parent = parentId ? (liveNode(parentId) ?? null) : null;
    if (parent) {
      const next = addChild(current, currentLinks, parent, at, placing?.size);
      commitGraph(`Added node under ${parent.title || "node"}`, { nodes: next.nodes, links: next.links });
      openNodeEditor(next.id);
      setPlacing(null);
      return;
    }
    const created = blankNode({
      title: "New idea",
      level: 2,
      type: "concept",
      size: placing?.size,
      x: at.x,
      y: at.y,
    });
    commitGraph(`Added ${created.title}`, { nodes: [...current, created] });
    openNodeEditor(created.id);
    setPlacing(null);
  }

  function startPlace(parentId?: string, size?: number) {
    if (editLocked) return;
    guardDraft(() => {
      setConnect(null);
      setMenu(null);
      setEditingId(null);
      setEditingLinkId(null);
      setPlacing({ parentId, size });
      if (parentId) {
        setSelectedIds([parentId]);
        setPicked({ kind: "node", id: parentId });
      }
    });
  }

  function startLink(arrows: ArrowStyle, from?: string) {
    if (editLocked) return;
    guardDraft(() => {
      setPlacing(null);
      setMenu(null);
      setEditingId(null);
      setEditingLinkId(null);
      setConnect({ arrows, from });
      if (from) setSelectedIds([from]);
    });
  }

  function removeNode(id: string, branch: boolean) {
    const { nodes: current, links: currentLinks } = graphStore.state;
    const target = current.find((n) => n.id === id);
    const next = deleteNode(current, currentLinks, id, branch);
    commitGraph(
      branch ? `Deleted branch of ${target?.title || "node"}` : `Deleted ${target?.title || "node"}`,
      { nodes: next.nodes, links: next.links },
    );
    setMenu(null);
  }

  function removeNodes(ids: string[]) {
    let { nodes: nextNodes, links: nextLinks } = graphStore.state;
    for (const id of ids) {
      const next = deleteNode(nextNodes, nextLinks, id, false);
      nextNodes = next.nodes;
      nextLinks = next.links;
    }
    commitGraph(`Deleted ${ids.length} nodes`, { nodes: nextNodes, links: nextLinks });
    setSelectedIds([]);
    setPicked(null);
    setMenu(null);
  }

  function removeLink(id: string) {
    commitGraph("Deleted connection", { links: graphStore.state.links.filter((l) => l.id !== id) });
    setMenu(null);
  }

  function insertNodeOnLink(linkId: string) {
    const { nodes: current, links: currentLinks } = graphStore.state;
    const next = insertNodeBetween(current, currentLinks, linkId);
    if (!next) return;
    commitGraph("Inserted node on connection", { nodes: next.nodes, links: next.links });
    openNodeEditor(next.id);
    setEditingLinkId(null);
    setMenu(null);
    showToast("Inserted node on connection");
  }

  function updateLink(id: string, patch: Partial<GraphLink>) {
    commitGraph(
      "Edited connection",
      { links: graphStore.state.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) },
      `link:${id}`,
    );
  }

  function flipLink(id: string) {
    commitGraph(
      "Flipped connection",
      {
        links: graphStore.state.links.map((l) => {
          if (l.id !== id) return l;
          const e = linkEnds(l);
          return { ...l, source: e.target, target: e.source };
        }),
      },
      `link:${id}`,
    );
  }

  function pickNode(id: string, additive = false) {
    if (editLocked) return;
    const leavesEditor = additive || (editingId !== null && editingId !== id);
    const apply = () => {
      setSelectedIds((prev) => {
        if (additive) return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        return [id];
      });
      setPicked({ kind: "node", id });
      setEditingLinkId(null);
      setMenu(null);
      setPlusOpen(false);
      if (additive) {
        setEditingId(null);
        setEditVisual(null);
        return;
      }
      if (editingId !== id) setEditVisual(null);
      setEditingId(id);
    };
    if (leavesEditor) guardDraft(apply);
    else apply();
  }

  function pickLink(id: string) {
    if (editLocked) return;
    guardDraft(() => {
      setSelectedIds([]);
      setPicked({ kind: "link", id });
      setEditingId(null);
      setEditVisual(null);
      setMenu(null);
      setPlusOpen(false);
    });
  }

  function requestLinkEdit(id: string) {
    if (editLocked) return;
    setMenu(null);
    setPlusOpen(false);
    if (editingLinkId === id && editingId === null) return;
    guardDraft(() => {
      if (editingId !== null || editingLinkId !== null) {
        setEditLocked(false);
        setPendingEdit({ kind: "link", id });
        setEditingId(null);
        setEditingLinkId(null);
        return;
      }
      setSelectedIds([]);
      setPicked({ kind: "link", id });
      setEditingId(null);
      setEditingLinkId(id);
    });
  }

  function centerOn(x: number, y: number) {
    const fg = graphRef.current as (GraphHandle & { centerAt?: (x: number, y: number, ms?: number) => void }) | undefined;
    fg?.centerAt?.(x, y, 400);
  }

  function focusNode(id: string) {
    if (editLocked) return;
    const live = liveNode(id);
    if (!live) {
      showToast("That node no longer exists");
      return;
    }
    guardDraft(() => {
      setMenu(null);
      setPlacing(null);
      setConnect(null);
      setEditingLinkId(null);
      openNodeEditor(id);
      if (live.x != null && live.y != null) centerOn(live.x, live.y);
    });
  }

  function focusLink(id: string) {
    const link = graphStore.state.links.find((l) => l.id === id);
    if (!link) {
      showToast("That connection no longer exists");
      return;
    }
    const e = linkEnds(link);
    const a = liveNode(e.source);
    const b = liveNode(e.target);
    pickLink(id);
    if (a?.x != null && a.y != null && b?.x != null && b.y != null) centerOn((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  const fitGraph = useCallback(() => {
    const fg = graphRef.current as
      | (GraphHandle & {
          centerAt?: (x: number, y: number, ms?: number) => void;
          zoom?: (k?: number, ms?: number) => number;
        })
      | undefined;
    if (!fg || !size.w || !size.h) return;

    const filterOptions = { statusFilters, employeeEmail: employeeFilter };
    const toFit = nodes.filter((n) => {
      if (typeof n.x !== "number" || typeof n.y !== "number") return false;
      if (hideFiltered && !isFiltered(n, search, settings.colorBy, filterOptions)) return false;
      return true;
    });

    if (!toFit.length) {
      showToast("Nothing to fit — clear search or filters");
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of toFit) {
      minX = Math.min(minX, n.x!);
      maxX = Math.max(maxX, n.x!);
      minY = Math.min(minY, n.y!);
      maxY = Math.max(maxY, n.y!);
    }

    const pad = 72;
    const bboxW = Math.max(maxX - minX, 48);
    const bboxH = Math.max(maxY - minY, 48);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const k = Math.min((size.w - pad * 2) / bboxW, (size.h - pad * 2) / bboxH, 8);
    const zoomK = Math.max(0.12, k);

    fg.centerAt?.(cx, cy, 400);
    window.setTimeout(() => fg.zoom?.(zoomK, 400), 0);
  }, [nodes, size.w, size.h, hideFiltered, search, settings.colorBy, statusFilters, employeeFilter]);

  useEffect(() => {
    if (!nodes.length || size.w < 200) return;
    if (fittedOnce.current) return;
    const timer = window.setTimeout(() => {
      fitGraph();
      fittedOnce.current = true;
    }, 120);
    return () => window.clearTimeout(timer);
  }, [nodes.length, size.w, size.h, fitGraph, hydration]);

  function reheat() {
    setSettings(mergeViewSettings(settings, { physics: true }));
    window.setTimeout(() => graphRef.current?.d3ReheatSimulation(), 20);
  }

  function screenOf(x: number, y: number) {
    const s = graphRef.current?.graph2ScreenCoords(x, y) ?? { x: 80, y: 80 };
    const { ox, oy } = viewCoverOffset(size.w, size.h);
    const rotated = rotatePoint(s.x + ox, s.y + oy, size.w / 2, size.h / 2, degToRad(viewRotation));
    const rect = stageRef.current?.getBoundingClientRect();
    return { left: (rect?.left ?? 0) + rotated.x, top: (rect?.top ?? 0) + rotated.y };
  }

  const previewPos = useMemo(() => {
    if (!previewNode) return { left: 80, top: 80 };
    const live = liveNode(previewNode.id);
    if (!live || live.x == null || live.y == null) return { left: 80, top: 80 };
    const s = screenOf(live.x, live.y);
    const k = zoom || 1;
    const enlarge = Number.isFinite(settings.enlarge) ? settings.enlarge : 1;
    const base = (2.7 + previewNode.size * 2 + Math.max(0, 2.1 - previewNode.level * 0.32)) * enlarge;
    const r = Math.min(base * k, 6.5 + previewNode.size * 4.5 * enlarge);
    const gap = 14;
    const cardW = 240;
    const cardH = 84;
    let left = s.left + r + gap;
    let top = s.top - r - gap - cardH * 0.45;
    if (left + cardW > window.innerWidth - 12) {
      left = s.left - r - gap - cardW;
    }
    if (top < 56) {
      top = s.top + r + gap;
    }
    if (top + cardH > window.innerHeight - 12) {
      top = Math.max(56, s.top - r - gap - cardH);
    }
    return {
      left: Math.min(window.innerWidth - cardW - 12, Math.max(12, left)),
      top: Math.min(window.innerHeight - cardH - 12, Math.max(56, top)),
    };
  }, [previewNode, size, zoom, settings.enlarge, viewRotation]);

  const editLinkPos = useMemo(() => {
    if (!editingLink) return { left: 80, top: 80 };
    const e = linkEnds(editingLink);
    const a = liveNode(e.source);
    const b = liveNode(e.target);
    if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) return { left: 80, top: 80 };
    const s = screenOf((a.x + b.x) / 2, (a.y + b.y) / 2);
    return {
      left: Math.min(window.innerWidth - 300, Math.max(12, s.left + 18)),
      top: Math.min(window.innerHeight - 260, Math.max(60, s.top - 20)),
    };
  }, [editingLink, links, size, zoom, viewRotation]);

  const actionPos = useMemo(() => {
    if (selectedIds.length > 1) {
      const lives = selectedIds.map((id) => liveNode(id)).filter((n): n is GraphNode => Boolean(n && n.x != null && n.y != null));
      if (!lives.length) return { left: 80, top: 80 };
      const k = zoom || 1;
      const enlarge = Number.isFinite(settings.enlarge) ? settings.enlarge : 1;
      const screens = lives.map((n) => {
        const s = screenOf(n.x!, n.y!);
        const base = (2.7 + n.size * 2 + Math.max(0, 2.1 - n.level * 0.32)) * enlarge;
        const r = Math.min(base * k, 6.5 + n.size * 4.5 * enlarge) + 8;
        return { left: s.left, top: s.top, r };
      });
      return selectionPanelPlacement(screens);
    }
    if (!picked) return { left: 80, top: 80 };
    if (picked.kind === "node") {
      const live = liveNode(picked.id);
      if (!live || live.x == null || live.y == null) return { left: 80, top: 80 };
      const s = screenOf(live.x, live.y);
      return {
        left: Math.min(window.innerWidth - 160, Math.max(12, s.left + 16)),
        top: Math.min(window.innerHeight - 56, Math.max(60, s.top - 18)),
      };
    }
    const link = links.find((l) => l.id === picked.id);
    if (!link) return { left: 80, top: 80 };
    const e = linkEnds(link);
    const a = liveNode(e.source);
    const b = liveNode(e.target);
    if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) return { left: 80, top: 80 };
    const s = screenOf((a.x + b.x) / 2, (a.y + b.y) / 2);
    return {
      left: Math.min(window.innerWidth - 160, Math.max(12, s.left + 12)),
      top: Math.min(window.innerHeight - 56, Math.max(60, s.top - 18)),
    };
  }, [picked, selectedIds, links, size, zoom, viewRotation, settings.enlarge]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header
        nodeCount={nodes.length}
        linkCount={links.length}
        liveStatus={liveStatus}
        historyCount={actions.length}
        historyOpen={historyOpen}
        infoOpen={infoOpen}
        theme={theme}
        onTheme={(next) => patchUi({ theme: next })}
        onExport={() => {
          downloadJson({ nodes, links, settings });
          showToast("Exported JSON");
        }}
        onImport={() => importRef.current?.click()}
        onHistory={toggleHistory}
        canUndo={actions.length > 0}
        canRedo={future.length > 0}
        onUndo={undo}
        onRedo={redo}
        onInfo={toggleInfo}
      />

      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex h-full shrink-0">
          <aside className="site-left-rail flex h-full w-[280px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--card)] px-2 py-2">
            <LeftSidePanel
              search={search}
              statusFilters={statusFilters}
              employeeFilter={employeeFilter}
              nodes={nodes}
              settings={settings}
              colorBy={settings.colorBy}
              editingNode={editing && !placing && !connect ? editing : null}
              onSearch={setSearch}
              onStatusFilters={setStatusFilters}
              onEmployeeFilter={setEmployeeFilter}
              onSettings={patchSettings}
              onResetSettings={() => setSettings(DEFAULT_SETTINGS)}
              onFit={fitGraph}
              onReorg={reheat}
              onTogglePhysics={() => {
                const next = !settings.physics;
                setSettings(mergeViewSettings(settings, { physics: next }));
                if (next) window.setTimeout(() => graphRef.current?.d3ReheatSimulation(), 40);
              }}
              onToggleCards={() => setSettings(mergeViewSettings(settings, { cardInfo: !settings.cardInfo }))}
              onNodeSave={(patch) => {
                if (editing) updateNode(editing.id, patch);
              }}
            />
          </aside>
          <div className="flex shrink-0 flex-col pt-2 pl-1.5">
            <PlusMenuButton
              open={plusOpen}
              armed={Boolean(placing) || Boolean(connect)}
              onOpen={(open) => {
                if (open) {
                  setMenu(null);
                  setPicked(null);
                }
                setPlusOpen(open);
              }}
              onAddNode={(size) => startPlace(undefined, size)}
              onLink={(arrows) => startLink(arrows)}
            />
          </div>
        </div>

        <div className="stage relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--graph-bg)]" ref={stageRef}>
        <div
          className="graph-wrap absolute inset-0 overflow-hidden"
          onContextMenu={(e) => e.preventDefault()}
        >
          <GraphCanvas
            nodes={graphNodes}
            links={links}
            settings={settings}
            selectedIds={selectedIds}
            selectedLinkId={picked?.kind === "link" ? picked.id : null}
            hoveredId={hoveredId}
            connectFrom={connect?.from ?? null}
            connectArmed={Boolean(connect)}
            placeArmed={Boolean(placing)}
            placeFrom={placing?.parentId ?? null}
            placeSize={placing?.size}
            linkArrows={connect?.arrows ?? "none"}
            search={search}
            statusFilters={statusFilters}
            employeeFilter={employeeFilter}
            hideFiltered={hideFiltered}
            theme={theme}
            rotation={degToRad(viewRotation)}
            uprightText={!viewSpinning}
            width={size.w}
            height={size.h}
            graphRef={graphRef}
            onSelect={(id, additive) => {
              if (editLocked) return;
              if (id) pickNode(id, additive);
              else guardDraft(dismissPreview);
            }}
            onMarquee={(ids, mode: LassoMode) => {
              if (editLocked) return;
              guardDraft(() => {
                const next =
                  mode === "add"
                    ? Array.from(new Set([...selectedIds, ...ids]))
                    : mode === "subtract"
                      ? selectedIds.filter((id) => !ids.includes(id))
                      : ids;
                setSelectedIds(next);
                if (next.length === 1) {
                  setPicked({ kind: "node", id: next[0] });
                  setEditingId(next[0]);
                } else {
                  setPicked(null);
                  setEditingId(null);
                }
                setEditVisual(null);
                setEditingLinkId(null);
                setMenu(null);
              });
            }}
            onGroupMoveEnd={(positions) => savePositions(positions, `Moved ${positions.length} nodes`)}
            onSelectLink={pickLink}
            onHover={setHoveredId}
            onEditLink={(id) => requestLinkEdit(id)}
            onNodeMenu={(id, x, y) => {
              if (editLocked) return;
              const open = () => {
                setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
                if (editingId !== id) setEditVisual(null);
                setEditingId(id);
                setPicked({ kind: "node", id });
                openContextMenu({ kind: "node", id, x, y });
              };
              if (editingId !== null && editingId !== id) guardDraft(open);
              else open();
            }}
            onLinkMenu={(id, x, y) => openContextMenu({ kind: "link", id, x, y })}
            onBackgroundMenu={(x, y) => openContextMenu({ kind: "canvas", x, y })}
            onBackground={(_x, _y, graph) => {
              if (editLocked) return;
              if (placing) {
                addLooseNode(graph);
                return;
              }
              if (connect) {
                setMenu(null);
                return;
              }
              setMenu(null);
              guardDraft(() => {
                dismissEditPanel();
                dismissPreview();
              });
            }}
            onPlace={addLooseNode}
            onDragEnd={(id, x, y) => savePositions([{ id, x, y }], "Moved node")}
            onConnectTarget={(id) => {
              if (!connect) return;
              const from = connect.from;
              if (!from) {
                setConnect({ ...connect, from: id });
                setSelectedIds([id]);
                return;
              }
              commitGraph("Linked nodes", { links: addLink(graphStore.state.links, from, id, "cross", connect.arrows) });
              setConnect(null);
              showToast("Linked");
            }}
            onZoom={setZoom}
            onSettle={() => {
              const moved = liveGraphNodes().flatMap((n) => {
                if (n.x == null || n.y == null) return [];
                const prev = persistedPositions.current.get(n.id);
                if (prev && Math.abs(prev.x - n.x) < POSITION_EPSILON && Math.abs(prev.y - n.y) < POSITION_EPSILON) return [];
                return [{ id: n.id, x: n.x, y: n.y }];
              });
              saveDocument({ nodes: graphStore.state.nodes, links: graphStore.state.links, settings });
              if (moved.length && graphStore.state.hydrated) savePositions(moved, "Updated positions");
              if (!fittedOnce.current) {
                fittedOnce.current = true;
                fitGraph();
              }
            }}
          />
        </div>

        <ViewCompass degrees={viewRotation} onChange={setViewRotation} onHoldChange={setViewSpinning} />

        {(placing || connect || selectedIds.length > 1) && (
          <div className="absolute top-3 left-1/2 z-[8] -translate-x-1/2 rounded-full bg-[rgba(27,58,107,0.92)] px-3 py-1.5 text-xs font-bold tracking-wide text-[#f3f2f1]">
            {placing
              ? "Click to place a node · Esc to cancel"
              : connect?.from
                ? "Click the next node · Esc to cancel"
                : connect
                  ? "Click the first node · Esc to cancel"
                  : `${selectedIds.length} selected · Drag a selected node to move · − removes one · Esc to clear`}
          </div>
        )}

      </div>
      </div>

      {selectedIds.length > 1 && !menu && !editingLink && !connect && !placing && (
        <SelectionPanel
          nodes={nodes.filter((n) => selectedIds.includes(n.id))}
          colorBy={settings.colorBy}
          style={actionPos}
          onStatus={(_status, color) =>
            updateSelectedNodes({ color }, `Changed status of ${selectedIds.length} nodes`)
          }
          onAssign={(next) =>
            updateSelectedNodes(
              { employee: next.name, employeeEmail: next.email },
              next.name ? `Assigned ${selectedIds.length} nodes` : `Cleared assignees on ${selectedIds.length} nodes`,
            )
          }
          onDelete={() => removeNodes(selectedIds)}
        />
      )}

      {menu?.kind === "node" && (() => {
        const ctxNode = nodeById.get(menu.id);
        if (!ctxNode) return null;
        return (
          <NodeContextMenu
            x={menu.x}
            y={menu.y}
            accent={nodeColor(ctxNode, settings.colorBy)}
            onAddNode={(size) => startPlace(menu.id, size)}
            onLink={(arrows) => startLink(arrows, menu.id)}
            onDelete={() => removeNode(menu.id, false)}
            onDeleteBranch={() => removeNode(menu.id, true)}
          />
        );
      })()}

      {menu?.kind === "link" && (() => {
        const ctxLink = links.find((l) => l.id === menu.id);
        if (!ctxLink) return null;
        return (
          <LinkContextMenu
            x={menu.x}
            y={menu.y}
            arrows={ctxLink.arrows}
            onArrows={(arrows) => {
              updateLink(menu.id, { arrows });
              setMenu(null);
            }}
            onFlip={() => flipLink(menu.id)}
            onInsert={() => insertNodeOnLink(menu.id)}
            onDelete={() => removeLink(menu.id)}
          />
        );
      })()}

      {menu?.kind === "canvas" && (
        <div className={cx("plus-menu plus-menu-floating ctx", ctxBox, "w-[196px] min-w-0 rounded-lg p-1")} style={{ left: menu.x, top: menu.y }}>
          <PlusMenu
            onAddNode={(size) => startPlace(undefined, size)}
            onLink={(arrows) => startLink(arrows)}
            onClose={() => setMenu(null)}
          />
        </div>
      )}

      {editLocked && (
        <div
          className="edit-lock fixed inset-0 z-[85] bg-[rgba(12,16,24,0.38)]"
          onClick={() => window.alert("Save or cancel your edits before leaving this panel.")}
          onContextMenu={(e) => {
            e.preventDefault();
            window.alert("Save or cancel your edits before leaving this panel.");
          }}
        />
      )}

      {previewNode && (
        <NodePreviewPanel
          node={previewNode}
          colorBy={settings.colorBy}
          style={previewPos}
          onPointerEnter={() => {
            previewOverRef.current = true;
          }}
          onPointerLeave={() => {
            previewOverRef.current = false;
            if (!hoveredId) setPreviewAnchorId(null);
          }}
        />
      )}

      {editingLink && (
        <EditLinkPanel
          key={editingLink.id}
          link={editingLink}
          style={editLinkPos}
          saveRef={editSaveRef}
          onDirty={setEditLocked}
          onSave={(patch) => {
            updateLink(editingLink.id, patch);
            dismissEditPanel();
          }}
          onClose={() => {
            dismissEditPanel();
          }}
          onDelete={() => removeLink(editingLink.id)}
        />
      )}

      <SyncChangesFeed onJumpNode={focusNode} onJumpLink={focusLink} />

      <HistoryPanel
        open={historyOpen}
        history={actions}
        onUndo={(id) => {
          if (undoTo(id)) showToast("Undid action");
        }}
        onClose={() => patchUi({ historyOpen: false })}
      />

      <InfoPanel open={infoOpen} onClose={() => patchUi({ infoOpen: false })} />

      {draftPrompt && (
        <DraftPrompt
          onSave={() => {
            saveDrafts();
            const { proceed } = draftPrompt;
            setDraftPrompt(null);
            proceed();
          }}
          onDiscard={() => {
            discardDrafts();
            const { proceed } = draftPrompt;
            setDraftPrompt(null);
            proceed();
          }}
          onCancel={() => setDraftPrompt(null)}
        />
      )}

      {toast && <div className="fixed bottom-[18px] left-1/2 z-[80] -translate-x-1/2 rounded-lg bg-[#1b1b1b] px-3 py-2 text-xs text-white dark:bg-[#f3f2f1] dark:text-[#1b1b1b]">{toast}</div>}
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const doc = await readJsonFile(file);
            replaceGraph(doc, "Imported graph");
            setSettings(mergeViewSettings(settings, doc.settings));
            fittedOnce.current = false;
            showToast("Imported graph");
          } catch {
            showToast("Could not import that file");
          }
        }}
      />
    </div>
  );
}
