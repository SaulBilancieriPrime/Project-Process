import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasTools from "./components/CanvasTools";
import EditLinkPanel from "./components/EditLinkPanel";
import EditNodePanel from "./components/EditNodePanel";
import PlusMenu from "./components/PlusMenu";
import PlusMenuButton from "./components/PlusMenuButton";
import GraphCanvas, { type GraphHandle } from "./components/GraphCanvas";
import Header from "./components/Header";
import NodeContextMenu from "./components/NodeContextMenu";
import NodePreviewPanel from "./components/NodePreviewPanel";
import SaveConfirmModal from "./components/SaveConfirmModal";
import Sidebar, { type SidebarTab } from "./components/Sidebar";
import {
  ACTION_COALESCE_MS,
  actionKindFromChanges,
  cloneSnapshot,
  diffSnapshots,
  mergeAction,
  type HistoryAction,
} from "./graph/history";
import { nodeColor } from "./graph/colors";
import { addChild, addLink, blankNode, deleteNode, insertNodeBetween } from "./graph/ops";
import { linkEnds } from "./graph/visibility";
import { createSampleDocument } from "./sampleData";
import {
  downloadJson,
  loadDocument,
  loadTheme,
  readJsonFile,
  newId,
  saveDocument,
  saveTheme,
} from "./storage";
import { ctxBox, cx, dangerText, ghostBtn, menuItem, plusMenuBox, toolBtn, toolOn } from "./styles";
import type { ArrowStyle, GraphLink, GraphNode, GraphSettings, NodeKind } from "./types";

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
  const [settings, setSettings] = useState<GraphSettings>(initial.settings);
  const [theme, setTheme] = useState<"light" | "dark">(loadTheme);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickState | null>(null);
  const [connect, setConnect] = useState<{ arrows: ArrowStyle; from?: string } | null>(null);
  const [placing, setPlacing] = useState<PlaceState | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("filter");
  const [saveOpen, setSaveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const [types, setTypes] = useState<NodeKind[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [hideFiltered, setHideFiltered] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [zoom, setZoom] = useState(1);

  const stageRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphHandle | undefined>(undefined);
  const importRef = useRef<HTMLInputElement>(null);
  const persistTimer = useRef<number | null>(null);
  const fittedOnce = useRef(false);
  const editSaveRef = useRef<(() => void) | null>(null);
  const [actions, setActions] = useState<HistoryAction[]>([]);
  const [editLocked, setEditLocked] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const editing = nodes.find((n) => n.id === editingId) ?? null;
  const editingLink = links.find((l) => l.id === editingLinkId) ?? null;
  const preview =
    previewOpen && !editing && !editingLink && !menu && !placing && !connect && selectedIds.length === 1
      ? nodes.find((n) => n.id === selectedIds[0]) ?? null
      : null;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

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
    setDirty(actions.length > 0);
  }, [actions.length]);

  useEffect(() => {
    if (!editing && !editingLink) setEditLocked(false);
  }, [editing, editingLink]);

  const dismissEditPanel = useCallback(() => {
    setEditLocked(false);
    setEditingId(null);
    setEditingLinkId(null);
    setPreviewOpen(false);
    setPendingEdit(null);
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
    setPreviewOpen(false);
    setSelectedIds([]);
    setPicked(null);
  }, []);

  useEffect(() => {
    const editingOpen = editingId !== null || editingLinkId !== null;
    const previewShowing = previewOpen && !editingOpen && selectedIds.length === 1;
    if (!menu && !editingOpen && !previewShowing) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const onGraph = Boolean(target.closest(".graph-host"));
      if (menu && !target.closest(".ctx, .plus-menu-floating")) {
        setMenu(null);
      }
      if (editingOpen && !editLocked && !target.closest(".edit-float") && !onGraph) {
        dismissEditPanel();
        setSelectedIds([]);
        setPicked(null);
      } else if (previewShowing && !target.closest(".edit-float") && !onGraph) {
        dismissPreview();
      }
    };
    const timer = window.setTimeout(() => window.addEventListener("pointerdown", onPointerDown, true), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [menu, editingId, editingLinkId, editLocked, dismissEditPanel, dismissPreview, previewOpen, selectedIds.length]);

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
        setPreviewOpen(false);
        setPendingEdit(null);
        setSaveOpen(false);
      }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editLocked) {
          editSaveRef.current?.();
          return;
        }
        requestSave();
      }
      if (e.key === "Delete") {
        if (editingId || editingLinkId || editLocked) return;
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
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  function openContextMenu(next: MenuState) {
    if (editLocked) return;
    dismissEditPanel();
    setMenu(next);
    setPicked(null);
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
    const afterNodes = next.nodes ?? nodes;
    const afterLinks = next.links ?? links;
    const afterSettings = next.settings ?? settings;
    const before = cloneSnapshot(nodes, links, settings);
    const after = cloneSnapshot(afterNodes, afterLinks, afterSettings);
    const changes = diffSnapshots(before, after);
    if (next.nodes) setNodes(afterNodes);
    if (next.links) setLinks(afterLinks);
    if (next.settings) setSettings(afterSettings);
    if (!changes.length) return;
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

  function undoAction(id: string) {
    const idx = actions.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const target = actions[idx];
    setNodes(target.before.nodes);
    setLinks(target.before.links);
    setSettings(target.before.settings);
    setActions((prev) => prev.slice(0, idx));
    setEditingId((cur) => (cur && target.before.nodes.some((n) => n.id === cur) ? cur : null));
    setEditingLinkId((cur) => (cur && target.before.links.some((l) => l.id === cur) ? cur : null));
    setSelectedIds((prev) => prev.filter((item) => target.before.nodes.some((n) => n.id === item)));
    setPicked((cur) => {
      if (!cur) return null;
      if (cur.kind === "node" && !target.before.nodes.some((n) => n.id === cur.id)) return null;
      if (cur.kind === "link" && !target.before.links.some((l) => l.id === cur.id)) return null;
      return cur;
    });
    setMenu(null);
    const live = liveGraphNodes();
    for (const n of live) {
      const match = target.before.nodes.find((item) => item.id === n.id);
      if (!match) continue;
      n.x = match.x;
      n.y = match.y;
      n.fx = match.fx;
      n.fy = match.fy;
    }
    showToast("Undid action");
  }

  function patchSettings(patch: Partial<GraphSettings>) {
    applyGraph("Changed settings", { settings: { ...settings, ...patch } }, "settings");
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
      label = `Recolored ${name}`;
    } else if (patch.size !== undefined && Object.keys(patch).length === 1) {
      label = `Resized ${name}`;
    } else if (patch.type && Object.keys(patch).length === 1) {
      label = `Changed type of ${name}`;
    } else if (patch.employee !== undefined && Object.keys(patch).length === 1) {
      label = `Assigned ${name}`;
    }
    applyGraph(label, { nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }, coalesceKey);
    const live = liveGraphNodes().find((n) => n.id === id);
    if (!live) return;
    Object.assign(live, patch);
  }

  function requestSave() {
    if (editLocked) {
      editSaveRef.current?.();
      return;
    }
    setSaveOpen(true);
    setMenu(null);
    setPlusOpen(false);
  }

  function commitSave() {
    saveDocument({ nodes, links, settings });
    setActions([]);
    setSaveOpen(false);
    setDirty(false);
    showToast("Saved locally");
  }

  function addLooseNode(at: { x: number; y: number }, edit = false) {
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
      setPlacing(null);
      if (edit) setEditingId(next.id);
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
    setPlacing(null);
    if (edit) setEditingId(created.id);
  }

  function startPlace(parentId?: string, size?: number) {
    if (editLocked) return;
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
    if (editLocked) return;
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

  function pickNode(id: string, additive = false) {
    if (editLocked) return;
    if (!additive && editingId !== null && editingId !== id) {
      dismissEditPanel();
    } else if (!additive && editingLinkId !== null) {
      dismissEditPanel();
    }
    setSelectedIds((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      return [id];
    });
    setPicked({ kind: "node", id });
    setEditingLinkId(null);
    setMenu(null);
    setPlusOpen(false);
    setPreviewOpen(!additive);
  }

  function pickLink(id: string) {
    if (editLocked) return;
    setSelectedIds([]);
    setPicked({ kind: "link", id });
    setEditingId(null);
    setMenu(null);
    setPlusOpen(false);
    setPreviewOpen(false);
  }

  function requestNodeEdit(id: string) {
    if (editLocked) return;
    setPreviewOpen(false);
    setMenu(null);
    setPlusOpen(false);
    if (editingId === id && editingLinkId === null) return;
    if (editingId !== null || editingLinkId !== null) {
      setEditLocked(false);
      setPendingEdit({ kind: "node", id });
      setEditingId(null);
      setEditingLinkId(null);
      return;
    }
    setSelectedIds([id]);
    setPicked({ kind: "node", id });
    setEditingLinkId(null);
    setEditingId(id);
  }

  function requestLinkEdit(id: string) {
    if (editLocked) return;
    setPreviewOpen(false);
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

  function focusNode(id: string) {
    const node = liveNode(id);
    pickNode(id);
    if (!node || node.x == null || node.y == null) return;
    graphRef.current?.centerAt(node.x, node.y, 500);
    graphRef.current?.zoom(2.1, 500);
  }

  function fitGraph() {
    graphRef.current?.zoomToFit(400, 80);
    window.setTimeout(() => {
      const fg = graphRef.current as (GraphHandle & { zoom?: (k?: number, ms?: number) => number }) | undefined;
      const k = fg?.zoom?.();
      if (typeof k === "number" && k > 1.05) fg?.zoom?.(0.92, 280);
    }, 420);
  }

  function reheat() {
    applyGraph("Reorganized layout", { settings: { ...settings, physics: true } }, "settings");
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
    const rect = stageRef.current?.getBoundingClientRect();
    return { left: (rect?.left ?? 0) + s.x, top: (rect?.top ?? 0) + s.y };
  }

  const editPos = useMemo(() => {
    const live = editing ? liveNode(editing.id) : preview ? liveNode(preview.id) : null;
    if (!live || live.x == null || live.y == null) return { left: 80, top: 80 };
    const s = screenOf(live.x, live.y);
    return {
      left: Math.min(window.innerWidth - 300, Math.max(12, s.left + 18)),
      top: Math.min(window.innerHeight - 280, Math.max(60, s.top - 20)),
    };
  }, [editing, preview, size, zoom]);

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
  }, [editingLink, links, size, zoom]);

  const actionPos = useMemo(() => {
    if (selectedIds.length > 1) {
      const lives = selectedIds.map((id) => liveNode(id)).filter((n): n is GraphNode => Boolean(n && n.x != null && n.y != null));
      if (!lives.length) return { left: 80, top: 80 };
      const x = lives.reduce((s, n) => s + (n.x ?? 0), 0) / lives.length;
      const y = lives.reduce((s, n) => s + (n.y ?? 0), 0) / lives.length;
      const s = screenOf(x, y);
      return {
        left: Math.min(window.innerWidth - 200, Math.max(12, s.left + 16)),
        top: Math.min(window.innerHeight - 56, Math.max(60, s.top - 28)),
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
  }, [picked, selectedIds, links, size, zoom]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header
        nodeCount={nodes.length}
        linkCount={links.length}
        dirty={dirty}
        theme={theme}
        onTheme={setTheme}
        onSave={requestSave}
        onExport={() => {
          downloadJson({ nodes, links, settings });
          showToast("Exported JSON");
        }}
        onImport={() => importRef.current?.click()}
        onInfo={() => {
          setSidebarOpen(true);
          setSidebarTab("help");
        }}
        onReset={() => {
          if (editLocked) return;
          const sample = createSampleDocument();
          setNodes(sample.nodes);
          setLinks(sample.links);
          setSettings(sample.settings);
          setActions([]);
          setSelectedIds([]);
          setEditingId(null);
          setEditingLinkId(null);
          setPicked(null);
          setPlacing(null);
          setConnect(null);
          showToast("Loaded sample process");
          window.setTimeout(() => {
            graphRef.current?.zoomToFit(500, 80);
            window.setTimeout(() => {
              const fg = graphRef.current as (GraphHandle & { zoom?: (k?: number, ms?: number) => number }) | undefined;
              const k = fg?.zoom?.();
              if (typeof k === "number" && k > 1.05) fg?.zoom?.(0.92, 280);
            }, 520);
          }, 80);
        }}
      />

      <div className={cx("stage relative min-h-0 flex-1 bg-[var(--graph-bg)]", sidebarOpen && "has-side")} ref={stageRef}>
        <div
          className="graph-wrap absolute inset-0"
          onContextMenu={(e) => e.preventDefault()}
        >
          <GraphCanvas
            nodes={nodes}
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
            levels={levels}
            types={types}
            colors={colors}
            hideFiltered={hideFiltered}
            theme={theme}
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
              if (ids.length === 1) setPicked({ kind: "node", id: ids[0] });
              else setPicked(null);
              setEditingId(null);
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
            }}
            onSelectLink={pickLink}
            onHover={setHoveredId}
            onEdit={(id) => requestNodeEdit(id)}
            onEditLink={(id) => requestLinkEdit(id)}
            onNodeMenu={(id, x, y) => {
              setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
              openContextMenu({ kind: "node", id, x, y });
            }}
            onLinkMenu={(id, x, y) => openContextMenu({ kind: "link", id, x, y })}
            onBackgroundMenu={(x, y) => openContextMenu({ kind: "canvas", x, y })}
            onBackground={(_x, _y, graph, dbl) => {
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
              if (dbl) addLooseNode(graph);
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
              saveDocument({ nodes, links, settings });
              if (!fittedOnce.current) {
                fittedOnce.current = true;
                fitGraph();
              }
            }}
          />
        </div>

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
          onAddNode={startPlace}
          onLink={(arrows) => startLink(arrows)}
        />

        <CanvasTools
          physics={settings.physics}
          cardInfo={Boolean(settings.cardInfo)}
          onFit={fitGraph}
          onReorg={reheat}
          onPhysics={() => {
            const next = !settings.physics;
            applyPhysicsFreeze(next);
            applyGraph(next ? "Turned physics on" : "Turned physics off", { settings: { ...settings, physics: next } });
            window.setTimeout(() => {
              applyPhysicsFreeze(next);
              if (next) graphRef.current?.d3ReheatSimulation();
            }, 40);
          }}
          onSave={requestSave}
          onCardInfo={() => applyGraph(settings.cardInfo ? "Hid cards" : "Showed cards", { settings: { ...settings, cardInfo: !settings.cardInfo } })}
        />

        <button
          type="button"
          className={cx(toolBtn, "side-toggle absolute top-3 right-3 z-[9] [.has-side_&]:right-[312px] max-[820px]:[.has-side_&]:top-auto max-[820px]:[.has-side_&]:right-3 max-[820px]:[.has-side_&]:bottom-[calc(42%+8px)]", sidebarOpen && toolOn)}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          {sidebarOpen ? "Hide panel" : "Panel"}
        </button>

        <Sidebar
          open={sidebarOpen}
          tab={sidebarTab}
          onTab={setSidebarTab}
          nodes={nodes}
          settings={settings}
          search={search}
          levels={levels}
          types={types}
          colors={colors}
          hideFiltered={hideFiltered}
          selectedIds={selectedIds}
          history={actions}
          onUndo={undoAction}
          onSearch={setSearch}
          onLevels={setLevels}
          onTypes={setTypes}
          onColors={setColors}
          onHideFiltered={setHideFiltered}
          onSettings={patchSettings}
          onFocus={focusNode}
        />
      </div>

      {selectedIds.length > 1 && !menu && !editing && !editingLink && !connect && !placing && (
        <div className="item-actions fixed z-[28] flex gap-1 rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] p-1 shadow-[var(--shadow)] backdrop-blur-[10px]" style={actionPos}>
          <button type="button" className={ghostBtn} disabled>
            {selectedIds.length} selected
          </button>
          <button type="button" className={cx(ghostBtn, dangerText)} onClick={() => removeNodes(selectedIds)}>
            Delete
          </button>
        </div>
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

      {menu?.kind === "link" && (
        <div className={cx("ctx", ctxBox)} style={{ left: menu.x, top: menu.y }}>
          <button type="button" className={menuItem} onClick={() => insertNodeOnLink(menu.id)}>
            Insert node here
          </button>
          <div className="sep mx-0.5 my-1 h-px bg-[var(--line)]" />
          <button
            type="button"
            className={cx(menuItem, dangerText)}
            onClick={() => removeLink(menu.id)}
          >
            Delete connection
          </button>
        </div>
      )}

      {menu?.kind === "canvas" && (
        <div className={cx("plus-menu plus-menu-floating fixed z-40", plusMenuBox)} style={{ left: menu.x, top: menu.y }}>
          <PlusMenu
            onAddNode={startPlace}
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

      {preview && (
        <NodePreviewPanel
          node={preview}
          colorBy={settings.colorBy}
          style={editPos}
        />
      )}

      {editing && (
        <EditNodePanel
          key={editing.id}
          node={editing}
          colorBy={settings.colorBy}
          style={editPos}
          saveRef={editSaveRef}
          onDirty={setEditLocked}
          onSave={(patch) => {
            updateNode(editing.id, patch);
            dismissEditPanel();
          }}
          onClose={() => {
            dismissEditPanel();
          }}
          onDelete={() => removeNode(editing.id, false)}
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

      <SaveConfirmModal
        open={saveOpen}
        changes={actions}
        onConfirm={commitSave}
        onContinue={() => setSaveOpen(false)}
      />
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
            setSettings(doc.settings);
            setActions([]);
            showToast("Imported graph");
          } catch {
            showToast("Could not import that file");
          }
        }}
      />
    </div>
  );
}
