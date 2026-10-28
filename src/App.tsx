import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import EditLinkPanel from "./components/EditLinkPanel";
import { type NodeEditPreview } from "./components/EditNodePanel";
import LeftSidePanel from "./components/LeftSidePanel";
import PlusMenu from "./components/PlusMenu";
import PlusMenuButton from "./components/PlusMenuButton";
import ViewCompass from "./components/ViewCompass";
import GraphCanvas, { type GraphHandle } from "./components/GraphCanvas";
import Header from "./components/Header";
import HistoryPanel from "./components/HistoryPanel";
import InfoPanel from "./components/InfoPanel";
import LinkContextMenu from "./components/LinkContextMenu";
import NodeContextMenu from "./components/NodeContextMenu";
import NodePreviewPanel from "./components/NodePreviewPanel";
import SelectionPanel from "./components/SelectionPanel";
import SyncChangesModal from "./components/SyncChangesModal";
import {
  ACTION_COALESCE_MS,
  actionKindFromChanges,
  cloneSnapshot,
  diffSnapshots,
  mergeAction,
  type ChangeItem,
  type HistoryAction,
} from "./graph/history";
import { fetchSharedMap, postMapTx, txFromSnapshots, type MapTx } from "./lib/mapSync";
import { nodeColor } from "./graph/colors";
import type { WorkflowStatus } from "./graph/workflowStatus";
import { addChild, addLink, blankNode, deleteNode, insertNodeBetween } from "./graph/ops";
import { mergeViewSettings } from "./graph/viewSettings";
import { degToRad, rotatePoint, viewCoverOffset } from "./graph/viewRotation";
import { isFiltered, linkEnds } from "./graph/visibility";
import {
  downloadJson,
  loadDocument,
  loadViewRotation,
  loadViewSettings,
  readJsonFile,
  newId,
  saveDocument,
  saveViewRotation,
  saveViewSettings,
} from "./storage";
import { patchUi, showToast as pushToast, toggleHistory, toggleInfo, uiStore } from "./store/ui";
import { ctxBox, cx } from "./styles";
import type { ArrowStyle, GraphLink, GraphNode, GraphSettings } from "./types";

type MenuState =
  | { kind: "node"; id: string; x: number; y: number }
  | { kind: "link"; id: string; x: number; y: number }
  | { kind: "canvas"; x: number; y: number };

type PickState = { kind: "node" | "link"; id: string };
type PlaceState = { parentId?: string; size?: number };
type PendingEdit = { kind: "node"; id: string } | { kind: "link"; id: string };

export default function App() {
  const initial = useMemo(() => loadDocument(), []);
  const [nodes, setNodes] = useState<GraphNode[]>(initial.nodes);
  const [links, setLinks] = useState<GraphLink[]>(initial.links);
  const [settings, setSettings] = useState<GraphSettings>(() =>
    mergeViewSettings(initial.settings, loadViewSettings(initial.settings)),
  );
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
  const hideFiltered = Boolean(search.trim()) || statusFilters.length > 0 || employeeFilter != null;
  const [liveStatus, setLiveStatus] = useState<"offline" | "live" | "syncing">("offline");
  const [syncLocked, setSyncLocked] = useState(false);
  const [syncChanges, setSyncChanges] = useState<ChangeItem[]>([]);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [zoom, setZoom] = useState(1);
  const [viewRotation, setViewRotation] = useState(loadViewRotation);
  const [viewSpinning, setViewSpinning] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphHandle | undefined>(undefined);
  const importRef = useRef<HTMLInputElement>(null);
  const persistTimer = useRef<number | null>(null);
  const persistChain = useRef(Promise.resolve());
  const revisionRef = useRef(0);
  const hydratedRef = useRef(false);
  const syncingRef = useRef(false);
  const syncLockedRef = useRef(false);
  const graphSnapRef = useRef({ nodes, links, settings });
  graphSnapRef.current = { nodes, links, settings };
  const offlineToastRef = useRef(false);
  const lastPosHash = useRef("");
  const fittedOnce = useRef(false);
  const editSaveRef = useRef<(() => void) | null>(null);
  const [actions, setActions] = useState<HistoryAction[]>([]);
  const [future, setFuture] = useState<HistoryAction[]>([]);
  const [editLocked, setEditLocked] = useState(false);
  const [previewAnchorId, setPreviewAnchorId] = useState<string | null>(null);
  const previewOverRef = useRef(false);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [editVisual, setEditVisual] = useState<NodeEditPreview | null>(null);

  const editing = nodes.find((n) => n.id === editingId) ?? null;
  const editingLink = links.find((l) => l.id === editingLinkId) ?? null;

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
  const preview = previewTargetId ? nodes.find((n) => n.id === previewTargetId) ?? null : null;
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
      const doc = { nodes, links, settings };
      saveDocument(doc);
    }, 450);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [nodes, links, settings]);

  useEffect(() => {
    if (!editing && !editingLink) setEditLocked(false);
  }, [editing, editingLink]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape") {
        if (editLocked) return;
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
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editLocked) editSaveRef.current?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (!editLocked) undoLast();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        if (!editLocked) redoLast();
      }
      if (e.key === "Delete") {
        if (editLocked || editingLinkId) return;
        if (picked?.kind === "link") removeLink(picked.id);
        else if (selectedIds.length) removeNodes(selectedIds);
      }
      if (e.key.toLowerCase() === "n") {
        startPlace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const showToast = useCallback((msg: string) => {
    pushToast(msg);
  }, []);

  const persistTx = useCallback((tx: MapTx | null, opts?: { silent?: boolean; expect?: { nodes: GraphNode[]; links: GraphLink[]; settings: GraphSettings } }) => {
    if (!tx || !hydratedRef.current) return;
    persistChain.current = persistChain.current.then(async () => {
      const lockCanvas = !opts?.silent;
      syncingRef.current = true;
      setLiveStatus("syncing");
      if (lockCanvas) {
        syncLockedRef.current = true;
        setSyncLocked(true);
      }
      try {
        const result = await postMapTx(tx);
        if (result.ok) {
          revisionRef.current = result.revision;
          offlineToastRef.current = false;
          if (lockCanvas) {
            const map = await fetchSharedMap();
            if (map.ok && !map.unchanged) {
              const before = opts?.expect ?? graphSnapRef.current;
              const appliedSettings = mergeViewSettings(map.settings, before.settings);
              const incoming = diffSnapshots(before, { ...map, settings: appliedSettings });
              setNodes(map.nodes);
              setLinks(map.links);
              setSettings(appliedSettings);
              revisionRef.current = map.revision;
              lastPosHash.current = JSON.stringify(map.nodes.map((n) => [n.id, n.x, n.y, n.fx, n.fy]));
              saveDocument(map);
              const live = liveGraphNodes();
              for (const n of live) {
                const match = map.nodes.find((item) => item.id === n.id);
                if (!match) continue;
                n.x = match.x;
                n.y = match.y;
                n.fx = match.fx;
                n.fy = match.fy;
              }
              if (incoming.length) setSyncChanges(incoming);
            }
          }
          setLiveStatus("live");
          return;
        }
        setLiveStatus("offline");
        if (!offlineToastRef.current) {
          offlineToastRef.current = true;
          showToast("Working offline — Azure SQL unavailable");
        }
      } catch {
        setLiveStatus("offline");
      } finally {
        syncingRef.current = false;
        if (lockCanvas) {
          syncLockedRef.current = false;
          setSyncLocked(false);
        }
      }
    });
  }, [showToast]);

  const persistPositions = useCallback((moved: GraphNode[]) => {
    if (!hydratedRef.current || !moved.length) return;
    const hash = JSON.stringify(moved.map((n) => [n.id, n.x, n.y, n.fx, n.fy]));
    if (hash === lastPosHash.current) return;
    lastPosHash.current = hash;
    persistTx({ label: "Updated positions", upsertNodes: moved }, { silent: true });
  }, [persistTx]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = await fetchSharedMap();
      if (cancelled) return;
      if (!map.ok) {
        setLiveStatus("offline");
        return;
      }
      if (map.unchanged) return;
      setNodes(map.nodes);
      setLinks(map.links);
      setSettings(mergeViewSettings(map.settings, loadViewSettings(map.settings)));
      setActions([]);
      setFuture([]);
      revisionRef.current = map.revision;
      hydratedRef.current = true;
      lastPosHash.current = JSON.stringify(map.nodes.map((n) => [n.id, n.x, n.y, n.fx, n.fy]));
      saveDocument(map);
      setLiveStatus("live");
      fittedOnce.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.hidden || syncingRef.current || syncLockedRef.current || !hydratedRef.current) return;
      const map = await fetchSharedMap(revisionRef.current);
      if (!map.ok) {
        setLiveStatus("offline");
        return;
      }
      if (map.unchanged) {
        setLiveStatus("live");
        return;
      }
      const appliedSettings = mergeViewSettings(map.settings, graphSnapRef.current.settings);
      const incoming = diffSnapshots(graphSnapRef.current, { ...map, settings: appliedSettings });
      if (incoming.length) {
        syncingRef.current = true;
        syncLockedRef.current = true;
        setSyncLocked(true);
        setLiveStatus("syncing");
      }
      setNodes(map.nodes);
      setLinks(map.links);
      setSettings(appliedSettings);
      revisionRef.current = map.revision;
      lastPosHash.current = JSON.stringify(map.nodes.map((n) => [n.id, n.x, n.y, n.fx, n.fy]));
      saveDocument(map);
      const live = liveGraphNodes();
      for (const n of live) {
        const match = map.nodes.find((item) => item.id === n.id);
        if (!match) continue;
        n.x = match.x;
        n.y = match.y;
        n.fx = match.fx;
        n.fy = match.fy;
      }
      if (incoming.length) {
        setSyncChanges(incoming);
        syncingRef.current = false;
        syncLockedRef.current = false;
        setSyncLocked(false);
      }
      setLiveStatus("live");
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

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

  function applyPhysicsFreeze(physicsOn: boolean) {
    const live = liveGraphNodes();
    const freeze = (n: GraphNode) => {
      try {
        if (!physicsOn) {
          if (typeof n.x === "number") n.fx = n.x;
          if (typeof n.y === "number") n.fy = n.y;
        } else {
          delete n.fx;
          delete n.fy;
          n.fx = undefined;
          n.fy = undefined;
        }
      } catch {
        /* engine node objects can reject some writes */
      }
    };
    live.forEach(freeze);
    nodes.forEach((n) => {
      const match = live.find((item) => item.id === n.id);
      if (match && typeof match.x === "number") n.x = match.x;
      if (match && typeof match.y === "number") n.y = match.y;
      freeze(n);
    });
  }

  function applyGraph(
    label: string,
    next: { nodes?: GraphNode[]; links?: GraphLink[]; settings?: GraphSettings },
    coalesceKey?: string,
  ) {
    if (syncLockedRef.current) return;
    const afterNodes = next.nodes ?? nodes;
    const afterLinks = next.links ?? links;
    const afterSettings = next.settings ?? settings;
    const before = cloneSnapshot(nodes, links, settings);
    const after = cloneSnapshot(afterNodes, afterLinks, afterSettings);
    const changes = diffSnapshots(before, after);
    if (next.nodes) setNodes(afterNodes);
    if (next.links) setLinks(afterLinks);
    if (next.settings) setSettings(mergeViewSettings(afterSettings, settings));
    if (!changes.length) return;
    persistTx(txFromSnapshots(before, after, label), { expect: after });
    setFuture([]);
    setActions((prev) => {
      const last = prev[prev.length - 1];
      if (
        coalesceKey &&
        last?.coalesceKey === coalesceKey &&
        Date.now() - last.at < ACTION_COALESCE_MS
      ) {
        return [...prev.slice(0, -1), mergeAction(last, after, label)];
      }
      return [
        ...prev,
        {
          id: newId(),
          label,
          kind: actionKindFromChanges(changes),
          at: Date.now(),
          coalesceKey,
          before,
          after,
          changes,
        },
      ];
    });
  }

  function restoreSnapshot(snap: { nodes: GraphNode[]; links: GraphLink[]; settings: GraphSettings }, persistLabel?: string) {
    if (persistLabel) persistTx(txFromSnapshots({ nodes, links, settings }, snap, persistLabel), { expect: snap });
    setNodes(snap.nodes);
    setLinks(snap.links);
    setSettings(mergeViewSettings(snap.settings, settings));
    setEditingId((cur) => (cur && snap.nodes.some((n) => n.id === cur) ? cur : null));
    setEditingLinkId((cur) => (cur && snap.links.some((l) => l.id === cur) ? cur : null));
    setSelectedIds((prev) => prev.filter((item) => snap.nodes.some((n) => n.id === item)));
    setPicked((cur) => {
      if (!cur) return null;
      if (cur.kind === "node" && !snap.nodes.some((n) => n.id === cur.id)) return null;
      if (cur.kind === "link" && !snap.links.some((l) => l.id === cur.id)) return null;
      return cur;
    });
    setMenu(null);
    const live = liveGraphNodes();
    for (const n of live) {
      const match = snap.nodes.find((item) => item.id === n.id);
      if (!match) continue;
      n.x = match.x;
      n.y = match.y;
      n.fx = match.fx;
      n.fy = match.fy;
    }
  }

  function undoAction(id: string) {
    const idx = actions.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const target = actions[idx];
    const dropped = actions.slice(idx);
    restoreSnapshot(target.before, "Undid action");
    setActions((prev) => prev.slice(0, idx));
    setFuture((prev) => [...dropped, ...prev]);
    showToast("Undid action");
  }

  function undoLast() {
    const last = actions[actions.length - 1];
    if (!last) return;
    undoAction(last.id);
  }

  function redoLast() {
    const next = future[0];
    if (!next) return;
    restoreSnapshot(next.after, "Redid action");
    setFuture((prev) => prev.slice(1));
    setActions((prev) => [...prev, next]);
    showToast("Redid action");
  }

  function patchSettings(patch: Partial<GraphSettings>) {
    setSettings(mergeViewSettings(settings, patch));
  }

  useEffect(() => {
    try {
      applyPhysicsFreeze(settings.physics);
      if (settings.physics) graphRef.current?.d3ReheatSimulation();
    } catch {
      /* engine may be mid-tick */
    }
  }, [settings.physics]);

  function updateNode(id: string, patch: Partial<GraphNode>) {
    const current = nodes.find((n) => n.id === id);
    const name = current?.title.trim() || "node";
    let label = `Edited ${name}`;
    let coalesceKey = `node:${id}:edit`;
    if (patch.color && Object.keys(patch).length === 1) {
      label = `Changed status of ${name}`;
    } else if (patch.size !== undefined && Object.keys(patch).length === 1) {
      label = `Resized ${name}`;
    } else if (patch.employee !== undefined && Object.keys(patch).length <= 2) {
      label = `Assigned ${name}`;
    }
    applyGraph(label, { nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }, coalesceKey);
    const live = liveGraphNodes().find((n) => n.id === id);
    if (!live) return;
    Object.assign(live, patch);
  }

  function updateSelectedNodes(patch: Partial<GraphNode>, label: string) {
    const ids = new Set(selectedIds);
    applyGraph(
      label,
      { nodes: nodes.map((n) => (ids.has(n.id) ? { ...n, ...patch } : n)) },
      `selection:${Object.keys(patch).sort().join(",")}`,
    );
    for (const id of selectedIds) {
      const live = liveGraphNodes().find((n) => n.id === id);
      if (live) Object.assign(live, patch);
    }
  }

  function addLooseNode(at: { x: number; y: number }) {
    const parentId = placing?.parentId;
    const parent = parentId
      ? (liveNode(parentId) ?? nodes.find((n) => n.id === parentId)) ?? null
      : null;
    if (parent) {
      const next = addChild(nodes, links, parent, at, placing?.size);
      const placed = settings.physics
        ? next.nodes
        : next.nodes.map((n) => (n.id === next.id ? { ...n, fx: at.x, fy: at.y } : n));
      applyGraph(`Added node under ${parent.title || "node"}`, { nodes: placed, links: next.links });
      setSelectedIds([next.id]);
      setPicked({ kind: "node", id: next.id });
      setEditingId(next.id);
      setEditVisual(null);
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
      fx: settings.physics ? undefined : at.x,
      fy: settings.physics ? undefined : at.y,
    });
    applyGraph(`Added ${created.title}`, { nodes: [...nodes, created] });
    setSelectedIds([created.id]);
    setPicked({ kind: "node", id: created.id });
    setEditingId(created.id);
    setEditVisual(null);
    setPlacing(null);
  }

  function startPlace(parentId?: string, size?: number) {
    if (editLocked || syncLockedRef.current) return;
    setConnect(null);
    setMenu(null);
    setEditingId(null);
    setEditingLinkId(null);
    setPlacing({ parentId, size });
    if (parentId) {
      setSelectedIds([parentId]);
      setPicked({ kind: "node", id: parentId });
    }
  }

  function startLink(arrows: ArrowStyle, from?: string) {
    if (editLocked || syncLockedRef.current) return;
    setPlacing(null);
    setMenu(null);
    setEditingId(null);
    setEditingLinkId(null);
    setConnect({ arrows, from });
    if (from) setSelectedIds([from]);
  }

  function removeNode(id: string, branch: boolean) {
    const current = nodes.find((n) => n.id === id);
    const next = deleteNode(nodes, links, id, branch);
    applyGraph(
      branch ? `Deleted branch of ${current?.title || "node"}` : `Deleted ${current?.title || "node"}`,
      { nodes: next.nodes, links: next.links },
    );
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    if (editingId === id) setEditingId(null);
    if (picked?.id === id) setPicked(null);
    setMenu(null);
  }

  function removeNodes(ids: string[]) {
    let nextNodes = nodes;
    let nextLinks = links;
    for (const id of ids) {
      const next = deleteNode(nextNodes, nextLinks, id, false);
      nextNodes = next.nodes;
      nextLinks = next.links;
    }
    applyGraph(`Deleted ${ids.length} nodes`, { nodes: nextNodes, links: nextLinks });
    setSelectedIds([]);
    setEditingId(null);
    setPicked(null);
    setMenu(null);
  }

  function removeLink(id: string) {
    applyGraph("Deleted connection", { links: links.filter((l) => l.id !== id) });
    if (editingLinkId === id) setEditingLinkId(null);
    if (picked?.kind === "link" && picked.id === id) setPicked(null);
    setMenu(null);
  }

  function insertNodeOnLink(linkId: string) {
    const next = insertNodeBetween(nodes, links, linkId);
    if (!next) return;
    const placed = settings.physics
      ? next.nodes
      : next.nodes.map((n) => (n.id === next.id ? { ...n, fx: n.x, fy: n.y } : n));
    applyGraph("Inserted node on connection", { nodes: placed, links: next.links });
    setSelectedIds([next.id]);
    setPicked({ kind: "node", id: next.id });
    setEditingId(next.id);
    setEditVisual(null);
    setEditingLinkId(null);
    setMenu(null);
    showToast("Inserted node on connection");
  }

  function updateLink(id: string, patch: Partial<GraphLink>) {
    applyGraph(
      "Edited connection",
      { links: links.map((l) => (l.id === id ? { ...l, ...patch } : l)) },
      `link:${id}`,
    );
  }

  function flipLink(id: string) {
    applyGraph(
      "Flipped connection",
      {
        links: links.map((l) => {
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
  }

  function pickLink(id: string) {
    if (editLocked) return;
    setSelectedIds([]);
    setPicked({ kind: "link", id });
    setEditingId(null);
    setEditVisual(null);
    setMenu(null);
    setPlusOpen(false);
  }

  function requestLinkEdit(id: string) {
    if (editLocked) return;
    setMenu(null);
    setPlusOpen(false);
    if (editingLinkId === id && editingId === null) return;
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
  }

  function liveNode(id: string) {
    return liveGraphNodes().find((n) => n.id === id) ?? nodes.find((n) => n.id === id);
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
  }, [
    nodes,
    size.w,
    size.h,
    hideFiltered,
    search,
    settings.colorBy,
    statusFilters,
    employeeFilter,
    showToast,
  ]);

  useEffect(() => {
    if (!nodes.length || size.w < 200) return;
    if (fittedOnce.current) return;
    const timer = window.setTimeout(() => {
      fitGraph();
      fittedOnce.current = true;
    }, 120);
    return () => window.clearTimeout(timer);
  }, [nodes.length, size.w, size.h, fitGraph]);

  function reheat() {
    setSettings(mergeViewSettings(settings, { physics: true }));
    window.setTimeout(() => {
      try {
        applyPhysicsFreeze(true);
      } catch {
        /* ignore */
      }
      graphRef.current?.d3ReheatSimulation();
    }, 20);
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
      const x = lives.reduce((s, n) => s + (n.x ?? 0), 0) / lives.length;
      const y = lives.reduce((s, n) => s + (n.y ?? 0), 0) / lives.length;
      const s = screenOf(x, y);
      return {
        left: Math.min(window.innerWidth - 232, Math.max(12, s.left + 16)),
        top: Math.min(window.innerHeight - 220, Math.max(60, s.top - 28)),
      };
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
  }, [picked, selectedIds, links, size, zoom, viewRotation]);

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
        onUndo={undoLast}
        onRedo={redoLast}
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
              onFit={fitGraph}
              onReorg={reheat}
              onTogglePhysics={() => {
                const next = !settings.physics;
                applyPhysicsFreeze(next);
                setSettings(mergeViewSettings(settings, { physics: next }));
                window.setTimeout(() => {
                  applyPhysicsFreeze(next);
                  if (next) graphRef.current?.d3ReheatSimulation();
                }, 40);
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
              else dismissPreview();
            }}
            onMarquee={(ids, additive) => {
              if (editLocked) return;
              setSelectedIds((prev) => (additive ? Array.from(new Set([...prev, ...ids])) : ids));
              if (ids.length === 1) {
                setPicked({ kind: "node", id: ids[0] });
                setEditingId(ids[0]);
              } else {
                setPicked(null);
                setEditingId(null);
              }
              setEditVisual(null);
              setEditingLinkId(null);
              setMenu(null);
            }}
            onGroupMoveEnd={(positions) => {
              const live = liveGraphNodes();
              for (const pos of positions) {
                const model = nodes.find((n) => n.id === pos.id);
                const item = live.find((n) => n.id === pos.id);
                if (model) {
                  model.x = pos.x;
                  model.y = pos.y;
                  if (!settings.physics) {
                    model.fx = pos.x;
                    model.fy = pos.y;
                  }
                }
                if (item) {
                  item.x = pos.x;
                  item.y = pos.y;
                  if (!settings.physics) {
                    item.fx = pos.x;
                    item.fy = pos.y;
                  } else {
                    item.fx = undefined;
                    item.fy = undefined;
                  }
                }
              }
              const moved: GraphNode[] = [];
              for (const pos of positions) {
                const model = nodes.find((n) => n.id === pos.id);
                if (!model) continue;
                moved.push({
                  ...model,
                  x: pos.x,
                  y: pos.y,
                  fx: settings.physics ? undefined : pos.x,
                  fy: settings.physics ? undefined : pos.y,
                });
              }
              persistPositions(moved);
            }}
            onSelectLink={pickLink}
            onHover={setHoveredId}
            onEditLink={(id) => requestLinkEdit(id)}
            onNodeMenu={(id, x, y) => {
              if (editLocked) return;
              setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
              if (editingId !== id) setEditVisual(null);
              setEditingId(id);
              setPicked({ kind: "node", id });
              openContextMenu({ kind: "node", id, x, y });
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
              if (!editLocked) dismissEditPanel();
              dismissPreview();
            }}
            onPlace={addLooseNode}
            onDragEnd={(id, x, y) => {
              const model = nodes.find((n) => n.id === id);
              const live = liveGraphNodes().find((n) => n.id === id);
              if (model) {
                model.x = x;
                model.y = y;
                if (!settings.physics) {
                  model.fx = x;
                  model.fy = y;
                }
              }
              if (live) {
                live.x = x;
                live.y = y;
                if (!settings.physics) {
                  live.fx = x;
                  live.fy = y;
                } else {
                  live.fx = undefined;
                  live.fy = undefined;
                }
              }
              if (model) {
                persistPositions([
                  {
                    ...model,
                    x,
                    y,
                    fx: settings.physics ? undefined : x,
                    fy: settings.physics ? undefined : y,
                  },
                ]);
              }
            }}
            onConnectTarget={(id) => {
              if (!connect) return;
              const from = connect.from;
              if (!from) {
                setConnect({ ...connect, from: id });
                setSelectedIds([id]);
                return;
              }
              applyGraph("Linked nodes", { links: addLink(links, from, id, "cross", connect.arrows) });
              setConnect(null);
              showToast("Linked");
            }}
            onZoom={setZoom}
            onSettle={() => {
              const live = liveGraphNodes();
              for (const n of nodes) {
                const match = live.find((item) => item.id === n.id);
                if (match) {
                  n.x = match.x;
                  n.y = match.y;
                }
              }
              const doc = { nodes, links, settings };
              saveDocument(doc);
              persistPositions(nodes);
              if (!fittedOnce.current) {
                fittedOnce.current = true;
                fitGraph();
              }
            }}
          />
        </div>

        <ViewCompass degrees={viewRotation} onChange={setViewRotation} onHoldChange={setViewSpinning} />

        {syncLocked && (
          <div
            className="absolute inset-0 z-[30] flex items-center justify-center bg-[rgba(18,20,24,0.58)] backdrop-grayscale"
            role="status"
            aria-live="polite"
            aria-label="Syncing map"
          >
            <div className="rounded-full border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-[var(--shadow)]">
              Syncing map…
            </div>
          </div>
        )}

        {(placing || connect || selectedIds.length > 1) && (
          <div className="absolute top-3 left-1/2 z-[8] -translate-x-1/2 rounded-full bg-[rgba(27,58,107,0.92)] px-3 py-1.5 text-xs font-bold tracking-wide text-[#f3f2f1]">
            {placing
              ? "Click to place a node · Esc to cancel"
              : connect?.from
                ? "Click the next node · Esc to cancel"
                : connect
                  ? "Click the first node · Esc to cancel"
                  : "Drag the box or a selected node to move · Esc to clear"}
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
        const ctxNode = nodes.find((n) => n.id === menu.id);
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

      <SyncChangesModal changes={syncChanges} onClose={() => setSyncChanges([])} />

      <HistoryPanel
        open={historyOpen}
        history={actions}
        onUndo={undoAction}
        onClose={() => patchUi({ historyOpen: false })}
      />

      <InfoPanel open={infoOpen} onClose={() => patchUi({ infoOpen: false })} />

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
            setNodes(doc.nodes);
            setLinks(doc.links);
            setSettings(mergeViewSettings(doc.settings, doc.settings));
            setActions([]);
            setFuture([]);
            fittedOnce.current = false;
            persistTx({ label: "Imported graph", replace: doc }, { expect: doc });
            showToast("Imported graph");
          } catch {
            showToast("Could not import that file");
          }
        }}
      />
    </div>
  );
}
