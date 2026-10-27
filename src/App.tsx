import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasTools from "./components/CanvasTools";
import PlusMenu from "./components/PlusMenu";
import PlusMenuButton from "./components/PlusMenuButton";
import GraphCanvas, { type GraphHandle } from "./components/GraphCanvas";
import Header from "./components/Header";
import InfoPanel from "./components/InfoPanel";
import NodeContextMenu from "./components/NodeContextMenu";
import Sidebar from "./components/Sidebar";
import { LEVEL_COLORS, nodeColor } from "./graph/colors";
import { addChild, addLink, blankNode, deleteNode, KIND_LABEL, setPinned } from "./graph/ops";
import { linkEnds } from "./graph/visibility";
import { createSampleDocument } from "./sampleData";
import {
  downloadJson,
  loadDocument,
  loadTheme,
  readJsonFile,
  saveDocument,
  saveTheme,
} from "./storage";
import type { ArrowStyle, GraphLink, GraphNode, GraphSettings, NodeKind } from "./types";

type MenuState =
  | { kind: "node"; id: string; x: number; y: number }
  | { kind: "link"; id: string; x: number; y: number }
  | { kind: "canvas"; x: number; y: number };

type PickState = { kind: "node" | "link"; id: string };

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
  const [placing, setPlacing] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
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

  const editing = nodes.find((n) => n.id === editingId) ?? null;
  const editingLink = links.find((l) => l.id === editingLinkId) ?? null;

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
    setDirty(true);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      saveDocument({ nodes, links, settings });
      setDirty(false);
    }, 450);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [nodes, links, settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape") {
        setMenu(null);
        setConnect(null);
        setPlacing(false);
        setPlusOpen(false);
        setEditingId(null);
        setEditingLinkId(null);
        setPicked(null);
        setSelectedIds([]);
        setInfoOpen(false);
      }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      }
      if (e.key === "Delete") {
        if (picked?.kind === "link") removeLink(picked.id);
        else if (selectedIds.length) removeNodes(selectedIds);
      }
      if (e.key.toLowerCase() === "n") {
        setConnect(null);
        setPlacing(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

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

  function applyLivePins(physicsOn: boolean) {
    const live = liveGraphNodes();
    const pin = (n: GraphNode) => {
      try {
        if (!physicsOn || n.pinned) {
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
    live.forEach(pin);
    nodes.forEach((n) => {
      const match = live.find((item) => item.id === n.id);
      if (match && typeof match.x === "number") n.x = match.x;
      if (match && typeof match.y === "number") n.y = match.y;
      pin(n);
    });
  }

  function patchSettings(patch: Partial<GraphSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    try {
      applyLivePins(settings.physics);
      if (settings.physics) graphRef.current?.d3ReheatSimulation();
    } catch {
      /* engine may be mid-tick */
    }
  }, [settings.physics]);

  function updateNode(id: string, patch: Partial<GraphNode>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    const live = liveGraphNodes().find((n) => n.id === id);
    if (!live) return;
    Object.assign(live, patch);
    if (patch.pinned === true || (!settings.physics && patch.pinned !== false)) {
      live.fx = live.x;
      live.fy = live.y;
    }
    if (patch.pinned === false && settings.physics) {
      live.fx = undefined;
      live.fy = undefined;
    }
  }

  function saveNow() {
    saveDocument({ nodes, links, settings });
    setDirty(false);
    showToast("Saved locally");
  }

  const addLooseNode = useCallback((at: { x: number; y: number }, edit = false) => {
    const created = blankNode({
      title: "New idea",
      level: 2,
      type: "concept",
      x: at.x,
      y: at.y,
      pinned: true,
    });
    setNodes((prev) => [...prev, created]);
    setSelectedIds([created.id]);
    setPicked({ kind: "node", id: created.id });
    setPlacing(false);
    if (edit) setEditingId(created.id);
  }, []);

  function startPlace() {
    setConnect(null);
    setMenu(null);
    setEditingId(null);
    setEditingLinkId(null);
    setPlacing(true);
  }

  function startLink(arrows: ArrowStyle, from?: string) {
    setPlacing(false);
    setMenu(null);
    setEditingId(null);
    setEditingLinkId(null);
    setConnect({ arrows, from });
    if (from) setSelectedIds([from]);
  }

  function removeNode(id: string, branch: boolean) {
    const next = deleteNode(nodes, links, id, branch);
    setNodes(next.nodes);
    setLinks(next.links);
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
    setNodes(nextNodes);
    setLinks(nextLinks);
    setSelectedIds([]);
    setEditingId(null);
    setPicked(null);
    setMenu(null);
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    if (editingLinkId === id) setEditingLinkId(null);
    if (picked?.kind === "link" && picked.id === id) setPicked(null);
    setMenu(null);
  }

  function updateLink(id: string, patch: Partial<GraphLink>) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function pickNode(id: string, additive = false) {
    setSelectedIds((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      return [id];
    });
    setPicked({ kind: "node", id });
    setEditingLinkId(null);
    setMenu(null);
    setInfoOpen(false);
  }

  function pickLink(id: string) {
    setSelectedIds([]);
    setPicked({ kind: "link", id });
    setEditingId(null);
    setMenu(null);
    setInfoOpen(false);
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
    setSettings((s) => ({ ...s, physics: true }));
    window.setTimeout(() => {
      try {
        applyLivePins(true);
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
    const live = editing ? liveNode(editing.id) : null;
    if (!live || live.x == null || live.y == null) return { left: 80, top: 80 };
    const s = screenOf(live.x, live.y);
    return {
      left: Math.min(window.innerWidth - 300, Math.max(12, s.left + 18)),
      top: Math.min(window.innerHeight - 280, Math.max(60, s.top - 20)),
    };
  }, [editing, size, zoom]);

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
    <div className="app">
      <Header
        nodeCount={nodes.length}
        linkCount={links.length}
        dirty={dirty}
        theme={theme}
        onTheme={setTheme}
        onSave={saveNow}
        onExport={() => {
          downloadJson({ nodes, links, settings });
          showToast("Exported JSON");
        }}
        onImport={() => importRef.current?.click()}
        onInfo={() => setInfoOpen((v) => !v)}
        onReset={() => {
          const sample = createSampleDocument();
          setNodes(sample.nodes);
          setLinks(sample.links);
          setSettings(sample.settings);
          setSelectedIds([]);
          setEditingId(null);
          setEditingLinkId(null);
          setPicked(null);
          setPlacing(false);
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

      <div className={`stage${sidebarOpen ? " has-side" : ""}`} ref={stageRef}>
        <div
          className="graph-wrap"
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
            placeArmed={placing}
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
              if (id) pickNode(id, additive);
              else {
                setSelectedIds([]);
                setPicked(null);
              }
            }}
            onMarquee={(ids, additive) => {
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
                  if (model.pinned || !settings.physics) {
                    model.fx = pos.x;
                    model.fy = pos.y;
                  }
                }
                if (item) {
                  item.x = pos.x;
                  item.y = pos.y;
                  if (model?.pinned || !settings.physics) {
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
            onEdit={(id) => {
              pickNode(id);
              setEditingId(id);
              setEditingLinkId(null);
            }}
            onEditLink={(id) => {
              pickLink(id);
              setEditingLinkId(id);
            }}
            onNodeMenu={(id, x, y) => {
              setSelectedIds((prev) => (prev.includes(id) ? prev : [id]));
              setMenu({ kind: "node", id, x, y });
            }}
            onLinkMenu={(id, x, y) => setMenu({ kind: "link", id, x, y })}
            onBackgroundMenu={(x, y) => {
              setPlusOpen(false);
              setMenu({ kind: "canvas", x, y });
            }}
            onBackground={(_x, _y, graph, dbl) => {
              if (placing) {
                addLooseNode(graph);
                return;
              }
              if (connect) {
                setMenu(null);
                return;
              }
              setMenu(null);
              setSelectedIds([]);
              setEditingId(null);
              setEditingLinkId(null);
              setPicked(null);
              if (dbl) addLooseNode(graph);
            }}
            onPlace={addLooseNode}
            onDragEnd={(id, x, y) => {
              const model = nodes.find((n) => n.id === id);
              const live = liveGraphNodes().find((n) => n.id === id);
              if (model) {
                model.x = x;
                model.y = y;
                if (model.pinned || !settings.physics) {
                  model.fx = x;
                  model.fy = y;
                }
              }
              if (live) {
                live.x = x;
                live.y = y;
                if (model?.pinned || !settings.physics) {
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
              setLinks((prev) => addLink(prev, from, id, "cross", connect.arrows));
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
              setDirty(false);
              if (!fittedOnce.current) {
                fittedOnce.current = true;
                fitGraph();
              }
            }}
          />
        </div>

        {(placing || connect || selectedIds.length > 1) && (
          <div className="hint">
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
          armed={placing || Boolean(connect)}
          onOpen={(open) => {
            if (open) setMenu(null);
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
            applyLivePins(next);
            setSettings((s) => ({ ...s, physics: next }));
            window.setTimeout(() => {
              applyLivePins(next);
              if (next) graphRef.current?.d3ReheatSimulation();
            }, 40);
          }}
          onSave={saveNow}
          onCardInfo={() => setSettings((s) => ({ ...s, cardInfo: !s.cardInfo }))}
        />

        <button
          type="button"
          className={`side-btn side-toggle${sidebarOpen ? " is-on" : ""}`}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          {sidebarOpen ? "Hide panel" : "Filters"}
        </button>

        <Sidebar
          open={sidebarOpen}
          nodes={nodes}
          settings={settings}
          search={search}
          levels={levels}
          types={types}
          colors={colors}
          hideFiltered={hideFiltered}
          selectedIds={selectedIds}
          onSearch={setSearch}
          onLevels={setLevels}
          onTypes={setTypes}
          onColors={setColors}
          onHideFiltered={setHideFiltered}
          onSettings={patchSettings}
          onFocus={focusNode}
        />
      </div>

      {selectedIds.length > 1 && !editing && !editingLink && !connect && !placing && (
        <div className="item-actions" style={actionPos}>
          <button type="button" disabled>
            {selectedIds.length} selected
          </button>
          <button type="button" className="danger" onClick={() => removeNodes(selectedIds)}>
            Delete
          </button>
        </div>
      )}

      {picked && selectedIds.length <= 1 && !editing && !editingLink && !connect && !placing && (
        <div className="item-actions" style={actionPos}>
          <button
            type="button"
            onClick={() => {
              if (picked.kind === "node") setEditingId(picked.id);
              else setEditingLinkId(picked.id);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (picked.kind === "node") removeNode(picked.id, false);
              else removeLink(picked.id);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {menu?.kind === "node" && (() => {
        const ctxNode = nodes.find((n) => n.id === menu.id);
        if (!ctxNode) return null;
        return (
          <NodeContextMenu
            node={ctxNode}
            x={menu.x}
            y={menu.y}
            onEdit={() => { setEditingId(menu.id); setMenu(null); }}
            onAddChild={() => {
              const parent = liveNode(menu.id);
              if (!parent) return;
              const next = addChild(nodes, links, parent);
              setNodes(next.nodes);
              setLinks(next.links);
              setSelectedIds([next.id]);
              setEditingId(next.id);
              setMenu(null);
            }}
            onLink={(arrows) => startLink(arrows, menu.id)}
            onTogglePin={() => {
              updateNode(menu.id, setPinned(ctxNode, !ctxNode.pinned));
              setMenu(null);
            }}
            onToggleCollapse={() => {
              updateNode(menu.id, { collapsed: !ctxNode.collapsed });
              setMenu(null);
            }}
            onType={(kind) => updateNode(menu.id, { type: kind })}
            onColor={(color) => updateNode(menu.id, { color })}
            onSize={(size) => updateNode(menu.id, { size })}
            onDelete={() => removeNode(menu.id, false)}
            onDeleteBranch={() => removeNode(menu.id, true)}
          />
        );
      })()}

      {menu?.kind === "link" && (
        <div className="ctx" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            className="danger"
            onClick={() => removeLink(menu.id)}
          >
            Delete connection
          </button>
        </div>
      )}

      {menu?.kind === "canvas" && (
        <div className="plus-menu plus-menu-floating" style={{ left: menu.x, top: menu.y }}>
          <PlusMenu
            onAddNode={startPlace}
            onLink={(arrows) => startLink(arrows)}
            onClose={() => setMenu(null)}
          />
        </div>
      )}

      {editing && (
        <div className="edit-float" style={editPos}>
          <h3>Edit node</h3>
          <label>Title</label>
          <input
            autoFocus
            value={editing.title}
            onChange={(e) => updateNode(editing.id, { title: e.target.value })}
          />
          <label>Description</label>
          <textarea
            value={editing.description}
            onChange={(e) => updateNode(editing.id, { description: e.target.value })}
          />
          <label>Type</label>
          <select
            value={editing.type}
            onChange={(e) => updateNode(editing.id, { type: e.target.value as NodeKind })}
          >
            {(["concept", "category", "task", "info"] as NodeKind[]).map((kind) => (
              <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
            ))}
          </select>
          <label>Size</label>
          <input
            type="range"
            min={0.55}
            max={2.4}
            step={0.05}
            value={editing.size}
            onChange={(e) => updateNode(editing.id, { size: Number(e.target.value) })}
          />
          <div className="swatch-row" style={{ marginTop: 10 }}>
            {LEVEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch${editing.color === c || nodeColor(editing, settings.colorBy) === c ? " on" : ""}`}
                style={{ background: c }}
                onClick={() => updateNode(editing.id, { color: c })}
              />
            ))}
          </div>
          <div className="edit-actions">
            <button type="button" className="ghost" onClick={() => setEditingId(null)}>Done</button>
          </div>
        </div>
      )}

      {editingLink && (
        <div className="edit-float" style={{ left: actionPos.left, top: Math.min(window.innerHeight - 220, actionPos.top + 36) }}>
          <h3>Edit connection</h3>
          <label>Arrows</label>
          <div className="chip-row">
            {([
              ["none", "None"],
              ["one", "One"],
              ["both", "Two"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip${editingLink.arrows === value ? " on" : ""}`}
                onClick={() => updateLink(editingLink.id, { arrows: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <label>Type</label>
          <div className="chip-row">
            <button
              type="button"
              className={`chip${editingLink.kind === "parent" ? " on" : ""}`}
              onClick={() => updateLink(editingLink.id, { kind: "parent" })}
            >
              Hierarchy
            </button>
            <button
              type="button"
              className={`chip${editingLink.kind === "cross" ? " on" : ""}`}
              onClick={() => updateLink(editingLink.id, { kind: "cross" })}
            >
              Cross
            </button>
          </div>
          <div className="edit-actions">
            <button type="button" className="ghost" onClick={() => setEditingLinkId(null)}>Done</button>
          </div>
        </div>
      )}

      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} />
      {toast && <div className="toast">{toast}</div>}
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
            showToast("Imported graph");
          } catch {
            showToast("Could not import that file");
          }
        }}
      />
    </div>
  );
}
