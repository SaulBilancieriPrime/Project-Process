import { forceCollide, forceRadial } from "d3-force";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { graphTheme, nodeColor, sizeForLevel, withAlpha } from "../graph/colors";
import { isFiltered, linkEnds } from "../graph/visibility";
import type { ArrowStyle, GraphLink, GraphNode, GraphSettings, NodeKind } from "../types";

export type GraphHandle = ForceGraphMethods<GraphNode, GraphLink>;

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  settings: GraphSettings;
  selectedIds: string[];
  selectedLinkId: string | null;
  hoveredId: string | null;
  connectFrom: string | null;
  connectArmed: boolean;
  placeArmed: boolean;
  placeFrom: string | null;
  placeSize?: number;
  linkArrows: ArrowStyle;
  search: string;
  levels: number[];
  types: NodeKind[];
  colors: string[];
  hideFiltered: boolean;
  theme: "light" | "dark";
  width: number;
  height: number;
  onSelect: (id: string | null, additive?: boolean) => void;
  onMarquee: (ids: string[], additive: boolean) => void;
  onGroupMoveEnd: (positions: { id: string; x: number; y: number }[]) => void;
  onSelectLink: (id: string) => void;
  onHover: (id: string | null) => void;
  onEdit: (id: string) => void;
  onEditLink: (id: string) => void;
  onNodeMenu: (id: string, x: number, y: number) => void;
  onLinkMenu: (id: string, x: number, y: number) => void;
  onBackgroundMenu: (x: number, y: number) => void;
  onBackground: (x: number, y: number, graph: { x: number; y: number }, dbl: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onConnectTarget: (id: string) => void;
  onPlace: (graph: { x: number; y: number }) => void;
  onZoom: (k: number) => void;
  onSettle: () => void;
  graphRef: MutableRefObject<GraphHandle | undefined>;
};

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function dotRadius(node: GraphNode, globalScale: number, enlarge: number) {
  const base = (2.7 + node.size * 2 + Math.max(0, 2.1 - node.level * 0.32)) * enlarge;
  const screen = Math.min(base * globalScale, 6.5 + node.size * 4.5 * enlarge);
  return screen / globalScale;
}

function cardBox(node: GraphNode, globalScale: number, enlarge: number) {
  const w = (172 * enlarge * Math.min(node.size, 1.35)) / globalScale;
  const h = ((node.description ? 74 : 42) * enlarge) / globalScale;
  return { w, h };
}

function cardsAtZoom(cardInfo: boolean, globalScale: number) {
  return Boolean(cardInfo) && globalScale > 1.4;
}

function shouldLabel(
  node: GraphNode,
  globalScale: number,
  selected: boolean,
  hovered: boolean,
  searchHit: boolean,
) {
  if (selected || hovered || searchHit) return true;
  if (node.level <= 1) return globalScale > 0.32;
  if (node.level <= 2) return globalScale > 0.72;
  return globalScale > 1.1;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - 0.45), y2 - size * Math.sin(angle - 0.45));
  ctx.lineTo(x2 - size * Math.cos(angle + 0.45), y2 - size * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  if (len <= 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines && ctx.measureText(line).width > maxWidth) {
    let clipped = lines[maxLines - 1];
    while (clipped.length && ctx.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1);
    lines[maxLines - 1] = `${clipped}…`;
  }
  return lines;
}

export default function GraphCanvas({
  nodes,
  links,
  settings,
  selectedIds,
  selectedLinkId,
  hoveredId,
  connectFrom,
  connectArmed,
  placeArmed,
  placeFrom,
  placeSize,
  linkArrows,
  search,
  levels,
  types,
  colors,
  hideFiltered,
  theme,
  width,
  height,
  onSelect,
  onMarquee,
  onGroupMoveEnd,
  onSelectLink,
  onHover,
  onEdit,
  onEditLink,
  onNodeMenu,
  onLinkMenu,
  onBackgroundMenu,
  onBackground,
  onDragEnd,
  onConnectTarget,
  onPlace,
  onZoom,
  onSettle,
  graphRef,
}: Props) {
  const lastClick = useRef<{ key: string; t: number } | null>(null);
  const cursorGraph = useRef<{ x: number; y: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const spaceHeld = useRef(false);
  const skipBg = useRef(false);
  const fgContextHandled = useRef(false);
  const interaction = useRef<
    | { type: "marquee"; x0: number; y0: number; x1: number; y1: number; additive: boolean; sx0: number; sy0: number }
    | { type: "group"; lastX: number; lastY: number }
    | { type: "pan"; sx: number; sy: number; cx: number; cy: number }
    | null
  >(null);
  const [gesture, setGesture] = useState<"marquee" | "group" | "pan" | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const palette = graphTheme(theme);

  const graphData = useMemo(() => {
    const visible = nodes.filter((n) => {
      if (hideFiltered && !isFiltered(n, search, levels, types, colors, settings.colorBy)) return false;
      return true;
    });
    const ids = new Set(visible.map((n) => n.id));
    return {
      nodes: visible,
      links: links.flatMap((l) => {
        const e = linkEnds(l);
        if (!ids.has(e.source) || !ids.has(e.target)) return [];
        return [{ id: l.id, source: e.source, target: e.target, kind: l.kind, arrows: l.arrows ?? "none" }];
      }),
    };
  }, [nodes, links, hideFiltered, search, levels, types, colors, settings.colorBy]);

  useEffect(() => {
    if (!placeArmed) return;
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(".plus-wrap, .canvas-tools, .sidebar, .item-actions, .edit-float, .ctx, .omp-header")) return;
      onPlace(graphAtClient(e.clientX, e.clientY));
    };
    window.addEventListener("pointerup", onUp, true);
    return () => window.removeEventListener("pointerup", onUp, true);
  }, [placeArmed, onPlace, graphRef]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    const charge = fg.d3Force("charge") as { strength?: (n: number) => void } | undefined;
    charge?.strength?.(settings.physics ? settings.charge : 0);
    const linkForce = fg.d3Force("link") as
      | { distance?: (n: number) => unknown; strength?: (n: number) => unknown }
      | undefined;
    linkForce?.distance?.(settings.linkDistance);
    linkForce?.strength?.(0.48);
    if (settings.radial) {
      fg.d3Force(
        "radial",
        forceRadial((d: GraphNode) => 28 + d.level * 84, 0, 0).strength(0.065) as never,
      );
    } else {
      fg.d3Force("radial", null);
    }
    fg.d3Force(
      "collide",
      forceCollide((d: GraphNode) => settings.collide + d.size * 7 + Math.max(0, 3 - d.level)) as never,
    );
    if (settings.physics) fg.d3ReheatSimulation();
  }, [graphRef, settings]);

  function graphAtClient(clientX: number, clientY: number) {
    const rect = hostRef.current?.getBoundingClientRect();
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    return graphRef.current?.screen2GraphCoords(sx, sy) ?? { x: 0, y: 0 };
  }

  function zoomK() {
    const fg = graphRef.current as (GraphHandle & { zoom?: () => number }) | undefined;
    const k = fg?.zoom?.();
    return typeof k === "number" && k > 0 ? k : 1;
  }

  function liveEngineNodes(): GraphNode[] {
    const fg = graphRef.current as (GraphHandle & { graphData?: unknown }) | undefined;
    const raw = fg?.graphData;
    try {
      const data = typeof raw === "function" ? (raw as () => { nodes?: GraphNode[] })() : raw as { nodes?: GraphNode[] } | undefined;
      return data?.nodes ?? graphData.nodes;
    } catch {
      return graphData.nodes;
    }
  }

  function nodeAt(clientX: number, clientY: number) {
    const g = graphAtClient(clientX, clientY);
    const k = zoomK();
    const enlarge = Number.isFinite(settings.enlarge) ? settings.enlarge : 1;
    const cards = cardsAtZoom(Boolean(settings.cardInfo), k);
    let best: GraphNode | null = null;
    let bestD = Infinity;
    for (const n of liveEngineNodes()) {
      if (n.x == null || n.y == null) continue;
      const r = dotRadius(n, k, enlarge) + 10 / k;
      const d = Math.hypot(n.x - g.x, n.y - g.y);
      if (d <= r && d < bestD) {
        best = n;
        bestD = d;
      }
      if (cards) {
        const box = cardBox(n, k, enlarge);
        const rx = n.x - box.w / 2;
        const ry = n.y + r - 10 / k + 6 / k;
        if (g.x >= rx && g.x <= rx + box.w && g.y >= ry && g.y <= ry + box.h && d < bestD + box.w) {
          best = n;
          bestD = Math.min(bestD, d);
        }
      }
    }
    return best;
  }

  function isDouble(key: string) {
    const now = Date.now();
    const hit = Boolean(lastClick.current && lastClick.current.key === key && now - lastClick.current.t < 500);
    lastClick.current = { key, t: now };
    return hit;
  }

  function handleGraphClick(clientX: number, clientY: number, additive: boolean, forceDbl = false) {
    if (placeArmed) return false;
    const node = nodeAt(clientX, clientY);
    if (node) {
      skipBg.current = true;
      if (connectArmed) {
        onConnectTarget(node.id);
        return true;
      }
      if (forceDbl || isDouble(node.id)) {
        lastClick.current = null;
        onEdit(node.id);
        return true;
      }
      onSelect(node.id, additive);
      return true;
    }
    if (connectArmed) return false;
    const linkId = linkAtId(clientX, clientY);
    if (linkId) {
      skipBg.current = true;
      if (forceDbl || isDouble(`link:${linkId}`)) {
        lastClick.current = null;
        onEditLink(linkId);
        return true;
      }
      onSelectLink(linkId);
      return true;
    }
    return false;
  }

  function linkAtId(clientX: number, clientY: number) {
    const g = graphAtClient(clientX, clientY);
    const k = zoomK();
    const thresh = 9 / k;
    const live = liveEngineNodes();
    const byId = new Map(live.map((n) => [n.id, n]));
    let bestId: string | null = null;
    let bestD = Infinity;
    for (const l of graphData.links) {
      const e = linkEnds(l);
      const src = byId.get(e.source);
      const tgt = byId.get(e.target);
      if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
      const d = distToSeg(g.x, g.y, src.x, src.y, tgt.x, tgt.y);
      if (d <= thresh && d < bestD) {
        bestId = l.id;
        bestD = d;
      }
    }
    return bestId;
  }

  function selectionHull(pad = 16) {
    const ids = selectedSet;
    if (ids.size < 1) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;
    for (const n of liveEngineNodes()) {
      if (!ids.has(n.id) || n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
      count += 1;
    }
    if (!count) return null;
    const p = pad / zoomK();
    return { x: minX - p, y: minY - p, w: maxX - minX + p * 2, h: maxY - minY + p * 2 };
  }

  function moveSelected(dx: number, dy: number) {
    if (!dx && !dy) return;
    for (const n of liveEngineNodes()) {
      if (!selectedSet.has(n.id)) continue;
      n.x = (n.x ?? 0) + dx;
      n.y = (n.y ?? 0) + dy;
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    }
  }

  function selectedPositions() {
    return liveEngineNodes()
      .filter((n) => selectedSet.has(n.id) && n.x != null && n.y != null)
      .map((n) => ({ id: n.id, x: n.x as number, y: n.y as number }));
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (typing) return;
      if (e.code === "Space") {
        e.preventDefault();
        spaceHeld.current = true;
        setGesture((g) => g ?? "pan");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
        setGesture((g) => (g === "pan" && !interaction.current ? null : g));
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const block = (e: Event) => e.preventDefault();
    host.addEventListener("auxclick", block);
    return () => host.removeEventListener("auxclick", block);
  }, []);

  return (
    <div
      ref={hostRef}
      className={`graph-host absolute inset-0${placeArmed || connectArmed ? " is-draw" : ""}${gesture === "marquee" ? " is-select" : ""}${gesture === "group" ? " is-grab" : ""}${gesture === "pan" ? " is-pan" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        const handledByFg = fgContextHandled.current;
        fgContextHandled.current = false;
        const target = e.target as HTMLElement | null;
        if (target?.closest(".plus-wrap, .canvas-tools, .sidebar, .item-actions, .edit-float, .ctx, .omp-header")) return;
        if (handledByFg) return;

        const node = nodeAt(e.clientX, e.clientY);
        if (node) {
          onNodeMenu(node.id, e.clientX, e.clientY);
          return;
        }
        const linkId = linkAtId(e.clientX, e.clientY);
        if (linkId) {
          onLinkMenu(linkId, e.clientX, e.clientY);
          return;
        }
        onBackgroundMenu(e.clientX, e.clientY);
      }}
      onDoubleClick={(e) => {
        if (e.button !== 0) return;
        handleGraphClick(e.clientX, e.clientY, e.shiftKey, true);
      }}
      onPointerDown={(e) => {
        skipBg.current = false;
        if (placeArmed || connectArmed) return;
        if (e.button === 1) {
          e.preventDefault();
          const c = graphRef.current?.centerAt?.() ?? { x: 0, y: 0 };
          interaction.current = { type: "pan", sx: e.clientX, sy: e.clientY, cx: c.x, cy: c.y };
          setGesture("pan");
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          return;
        }
        if (e.button !== 0) return;
        if (spaceHeld.current || e.altKey) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest(".plus-wrap, .canvas-tools, .sidebar, .item-actions, .edit-float, .ctx, .omp-header")) return;
        const hit = nodeAt(e.clientX, e.clientY);
        if (hit) {
          skipBg.current = true;
          onSelect(hit.id, e.shiftKey);
          return;
        }
        if (linkAtId(e.clientX, e.clientY)) return;
        const g = graphAtClient(e.clientX, e.clientY);
        const hull = selectedSet.size > 1 ? selectionHull() : null;
        if (hull && g.x >= hull.x && g.x <= hull.x + hull.w && g.y >= hull.y && g.y <= hull.y + hull.h) {
          interaction.current = { type: "group", lastX: g.x, lastY: g.y };
          setGesture("group");
          skipBg.current = true;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          return;
        }
        skipBg.current = false;
        interaction.current = {
          type: "marquee",
          x0: g.x,
          y0: g.y,
          x1: g.x,
          y1: g.y,
          additive: e.shiftKey,
          sx0: e.clientX,
          sy0: e.clientY,
        };
        setGesture("marquee");
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (placeArmed || connectFrom) cursorGraph.current = graphAtClient(e.clientX, e.clientY);
        const it = interaction.current;
        if (!it) return;
        if (it.type === "marquee") {
          const g = graphAtClient(e.clientX, e.clientY);
          it.x1 = g.x;
          it.y1 = g.y;
          if (Math.hypot(e.clientX - it.sx0, e.clientY - it.sy0) > 5) skipBg.current = true;
        } else if (it.type === "group") {
          const g = graphAtClient(e.clientX, e.clientY);
          moveSelected(g.x - it.lastX, g.y - it.lastY);
          it.lastX = g.x;
          it.lastY = g.y;
          skipBg.current = true;
        } else if (it.type === "pan") {
          const k = zoomK();
          graphRef.current?.centerAt(it.cx - (e.clientX - it.sx) / k, it.cy - (e.clientY - it.sy) / k);
        }
      }}
      onPointerUp={(e) => {
        const it = interaction.current;
        interaction.current = null;
        setGesture(spaceHeld.current ? "pan" : null);
        if (!it) return;
        if (it.type === "marquee") {
          const k = zoomK();
          if (Math.abs(it.x1 - it.x0) * k < 6 && Math.abs(it.y1 - it.y0) * k < 6) {
            skipBg.current = true;
            if (handleGraphClick(e.clientX, e.clientY, it.additive)) return;
            const g = graphAtClient(e.clientX, e.clientY);
            const dbl = isDouble("__bg__");
            onBackground(e.clientX, e.clientY, g, dbl);
            return;
          }
          const minX = Math.min(it.x0, it.x1);
          const maxX = Math.max(it.x0, it.x1);
          const minY = Math.min(it.y0, it.y1);
          const maxY = Math.max(it.y0, it.y1);
          const ids = liveEngineNodes()
            .filter((n) => n.x != null && n.y != null && n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
            .map((n) => n.id);
          skipBg.current = true;
          onMarquee(ids, it.additive);
        } else if (it.type === "group") {
          onGroupMoveEnd(selectedPositions());
        }
      }}
      onPointerLeave={() => {
        if (!interaction.current) cursorGraph.current = null;
      }}
    >
    <ForceGraph2D<GraphNode, GraphLink>
      ref={graphRef as never}
      width={width}
      height={height}
      graphData={graphData}
      backgroundColor={palette.bg}
      nodeId="id"
      nodeLabel={(n) => n.title}
      linkSource="source"
      linkTarget="target"
      cooldownTicks={settings.physics ? 220 : 0}
      d3VelocityDecay={0.28}
      d3AlphaDecay={0.022}
      minZoom={0.12}
      maxZoom={8}
      enableNodeDrag
      enablePanInteraction={(ev) => spaceHeld.current || ev.altKey}
      autoPauseRedraw={false}
      warmupTicks={settings.physics ? 20 : 0}
      nodeCanvasObjectMode={() => "replace"}
      onZoom={(t) => onZoom(t.k)}
      onEngineStop={onSettle}
      onNodeHover={(n) => onHover(n?.id ?? null)}
      onNodeDrag={(n, translate) => {
        if (!selectedSet.has(n.id) || selectedSet.size < 2) return;
        for (const node of liveEngineNodes()) {
          if (node.id === n.id || !selectedSet.has(node.id)) continue;
          node.x = (node.x ?? 0) + translate.x;
          node.y = (node.y ?? 0) + translate.y;
          node.fx = node.x;
          node.fy = node.y;
          node.vx = 0;
          node.vy = 0;
        }
      }}
      onNodeDragEnd={(n) => {
        if (selectedSet.has(n.id) && selectedSet.size > 1) {
          onGroupMoveEnd(selectedPositions());
          return;
        }
        onDragEnd(n.id, n.x ?? 0, n.y ?? 0);
      }}
      onNodeClick={(n, ev) => {
        skipBg.current = true;
        if (placeArmed) return;
        if (connectArmed) {
          onConnectTarget(n.id);
          return;
        }
        if (ev.detail === 2 || isDouble(n.id)) {
          lastClick.current = null;
          onEdit(n.id);
          return;
        }
        onSelect(n.id, ev.shiftKey);
      }}
      onNodeRightClick={(n, ev) => {
        ev.preventDefault();
        fgContextHandled.current = true;
        onNodeMenu(n.id, ev.clientX, ev.clientY);
      }}
      onLinkRightClick={(l, ev) => {
        ev.preventDefault();
        fgContextHandled.current = true;
        onLinkMenu(l.id, ev.clientX, ev.clientY);
      }}
      onLinkClick={(l, ev) => {
        skipBg.current = true;
        if (placeArmed || connectArmed) return;
        if (ev.detail === 2 || isDouble(`link:${l.id}`)) {
          lastClick.current = null;
          onEditLink(l.id);
          return;
        }
        onSelectLink(l.id);
      }}
      linkHoverPrecision={10}
      onBackgroundClick={(ev) => {
        if (ev.button !== 0) return;
        if (placeArmed) return;
        if (skipBg.current) {
          skipBg.current = false;
          return;
        }
        if (handleGraphClick(ev.clientX, ev.clientY, ev.shiftKey, ev.detail === 2)) return;
        const g = graphAtClient(ev.clientX, ev.clientY);
        const dbl = isDouble("__bg__");
        onBackground(ev.clientX, ev.clientY, g, dbl);
      }}
      linkColor={(l) => {
        const e = linkEnds(l);
        const src = nodes.find((n) => n.id === e.source);
        const tgt = nodes.find((n) => n.id === e.target);
        const dim =
          (src && !isFiltered(src, search, levels, types, colors, settings.colorBy)) ||
          (tgt && !isFiltered(tgt, search, levels, types, colors, settings.colorBy));
        if (dim) return palette.linkDim;
        const hot = l.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target);
        if (l.kind === "cross") return hot ? palette.linkCrossHot : palette.linkCross;
        return hot ? palette.linkHot : palette.link;
      }}
      linkWidth={(l) => {
        const e = linkEnds(l);
        return l.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target)
          ? theme === "dark" ? 2.1 : 1.5
          : theme === "dark" ? 1.45 : 0.95;
      }}
      linkLineDash={(l) => (l.kind === "cross" ? [3.2, 3.2] : [])}
      linkDirectionalArrowLength={0}
      linkDirectionalArrowRelPos={0.82}
      linkDirectionalArrowColor={(l) => {
        const e = linkEnds(l);
        const hot = l.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target);
        if (l.kind === "cross") return hot ? palette.linkCrossHot : palette.linkCross;
        return hot ? palette.linkHot : palette.link;
      }}
      linkCanvasObjectMode={(l) => (l.arrows === "one" || l.arrows === "both" ? "after" : undefined)}
      linkCanvasObject={(link, ctx, globalScale) => {
        if (link.arrows !== "one" && link.arrows !== "both") return;
        const src = typeof link.source === "object" ? link.source as GraphNode : nodes.find((n) => n.id === String(link.source));
        const tgt = typeof link.target === "object" ? link.target as GraphNode : nodes.find((n) => n.id === String(link.target));
        if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;
        const e = linkEnds(link);
        const hot = link.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target);
        ctx.fillStyle = link.kind === "cross"
          ? (hot ? palette.linkCrossHot : palette.linkCross)
          : (hot ? palette.linkHot : palette.link);
        const size = 9 / globalScale;
        const along = (t: number) => ({
          x: src.x! + (tgt.x! - src.x!) * t,
          y: src.y! + (tgt.y! - src.y!) * t,
        });
        const tip = along(0.78);
        drawArrowHead(ctx, src.x, src.y, tip.x, tip.y, size);
        if (link.arrows === "both") {
          const back = along(0.22);
          drawArrowHead(ctx, tgt.x, tgt.y, back.x, back.y, size);
        }
      }}
      nodePointerAreaPaint={(node, color, ctx, globalScale) => {
        ctx.fillStyle = color;
        const enlarge = Number.isFinite(settings.enlarge) ? settings.enlarge : 1;
        const showCard = cardsAtZoom(Boolean(settings.cardInfo), globalScale);
        if (showCard) {
          const r = dotRadius(node, globalScale, enlarge);
          const { w, h } = cardBox(node, globalScale, enlarge);
          ctx.fillRect((node.x ?? 0) - w / 2, (node.y ?? 0) + r + 6 / globalScale, w, h);
        } else {
          const r = dotRadius(node, globalScale, settings.enlarge) + 4 / globalScale;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }}
      nodeCanvasObject={(node, ctx, globalScale) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const color = nodeColor(node, settings.colorBy);
        const matched = isFiltered(node, search, levels, types, colors, settings.colorBy);
        const dim = !matched;
        const selected = selectedSet.has(node.id);
        const hovered = node.id === hoveredId;
        const connecting = node.id === connectFrom;
        const enlarge = Number.isFinite(settings.enlarge) ? settings.enlarge : 1;
        const r = dotRadius(node, globalScale, enlarge);
        const asCard = cardsAtZoom(Boolean(settings.cardInfo), globalScale);
        const alpha = dim ? 0.16 : 1;
        const fontPx = (11 * enlarge) / globalScale;
        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.arc(x, y, r + 3.2 / globalScale, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(color, hovered || selected ? 0.28 : 0.12);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (selected || connecting) {
          ctx.strokeStyle = connecting ? palette.connectRing : palette.ring;
          ctx.lineWidth = 1.2 / globalScale;
          ctx.stroke();
        }

        if (asCard) {
          const { w, h } = cardBox(node, globalScale, enlarge);
          const rx = x - w / 2;
          const ry = y + r + 6 / globalScale;
          const rad = 7 / globalScale;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = palette.card;
          ctx.strokeStyle = selected || connecting ? palette.ring : withAlpha(color, 0.85);
          ctx.lineWidth = (selected ? 1.5 : 1) / globalScale;
          ctx.beginPath();
          ctx.moveTo(rx + rad, ry);
          ctx.arcTo(rx + w, ry, rx + w, ry + h, rad);
          ctx.arcTo(rx + w, ry + h, rx, ry + h, rad);
          ctx.arcTo(rx, ry + h, rx, ry, rad);
          ctx.arcTo(rx, ry, rx + w, ry, rad);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, w, h);
          ctx.clip();
          const titleSize = (12 * enlarge) / globalScale;
          const bodySize = (10.5 * enlarge) / globalScale;
          ctx.fillStyle = palette.cardText;
          ctx.font = `600 ${titleSize}px "Segoe UI", sans-serif`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          const title = wrapText(ctx, node.title, w - 16 / globalScale, 1)[0] ?? node.title;
          ctx.fillText(title, rx + 8 / globalScale, ry + 8 / globalScale);
          if (node.description) {
            ctx.fillStyle = palette.cardMuted;
            ctx.font = `${bodySize}px "Segoe UI", sans-serif`;
            const lines = wrapText(ctx, node.description, w - 16 / globalScale, 2);
            lines.forEach((line, i) => {
              ctx.fillText(line, rx + 8 / globalScale, ry + 26 / globalScale + i * (bodySize + 3 / globalScale));
            });
          }
          ctx.restore();
        } else if (shouldLabel(node, globalScale, selected, hovered, Boolean(search && matched))) {
          ctx.globalAlpha = alpha * smoothstep(0.28, 0.7, globalScale || 0.3);
          if (selected || hovered || node.level <= 1) ctx.globalAlpha = alpha;
          ctx.font = `${node.level === 0 ? 700 : 600} ${fontPx}px "Segoe UI", sans-serif`;
          ctx.fillStyle = dim ? palette.labelDim : palette.label;
          const outward = Math.hypot(x, y) > 80;
          const maxW = (outward ? 108 : 140) * enlarge / globalScale;
          const lines = wrapText(ctx, node.title, maxW, 2);
          if (outward) {
            const ang = Math.atan2(y, x);
            const lift = r + 10 / globalScale;
            const lx = x + Math.cos(ang) * lift;
            const ly = y + Math.sin(ang) * lift;
            ctx.textAlign = Math.abs(Math.cos(ang)) < 0.35 ? "center" : Math.cos(ang) > 0 ? "left" : "right";
            ctx.textBaseline = Math.sin(ang) > 0.35 ? "top" : Math.sin(ang) < -0.35 ? "bottom" : "middle";
            lines.forEach((line, i) => {
              const dy = (i - (lines.length - 1) / 2) * (fontPx + 2 / globalScale);
              ctx.fillText(line, lx, ly + dy);
            });
          } else {
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            lines.forEach((line, i) => {
              ctx.fillText(line, x, y + r + 4 / globalScale + i * (fontPx + 2 / globalScale));
            });
          }
        }

        ctx.restore();
      }}
      onRenderFramePost={(ctx, globalScale) => {
        const box = interaction.current;
        if (box?.type === "marquee") {
          const x = Math.min(box.x0, box.x1);
          const y = Math.min(box.y0, box.y1);
          const w = Math.abs(box.x1 - box.x0);
          const h = Math.abs(box.y1 - box.y0);
          ctx.save();
          ctx.fillStyle = theme === "dark" ? "rgba(91, 155, 213, 0.14)" : "rgba(27, 58, 107, 0.08)";
          ctx.strokeStyle = palette.ring;
          ctx.lineWidth = 1.1 / globalScale;
          ctx.setLineDash([6 / globalScale, 4 / globalScale]);
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
          ctx.restore();
        } else if (selectedSet.size > 1) {
          const hull = selectionHull();
          if (hull) {
            ctx.save();
            ctx.strokeStyle = palette.ring;
            ctx.fillStyle = theme === "dark" ? "rgba(245, 245, 245, 0.04)" : "rgba(27, 58, 107, 0.04)";
            ctx.lineWidth = 1 / globalScale;
            ctx.setLineDash([5 / globalScale, 4 / globalScale]);
            ctx.fillRect(hull.x, hull.y, hull.w, hull.h);
            ctx.strokeRect(hull.x, hull.y, hull.w, hull.h);
            ctx.restore();
          }
        }
        const cur = cursorGraph.current;
        if (!cur) return;
        if (placeArmed) {
          const src = placeFrom ? graphData.nodes.find((n) => n.id === placeFrom) : null;
          const ghostLevel = src ? src.level + 1 : 2;
          const ghostSize = placeSize ?? sizeForLevel(ghostLevel);
          const enlarge = Number.isFinite(settings.enlarge) ? settings.enlarge : 1;
          const r = dotRadius({ size: ghostSize, level: ghostLevel } as GraphNode, globalScale, enlarge);
          ctx.save();
          if (src && src.x != null && src.y != null) {
            ctx.strokeStyle = palette.linkHot;
            ctx.lineWidth = 1.35 / globalScale;
            ctx.setLineDash([5 / globalScale, 4 / globalScale]);
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(cur.x, cur.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(cur.x, cur.y, r + 3 / globalScale, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha("#5b9bd5", 0.22);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cur.x, cur.y, r, 0, Math.PI * 2);
          ctx.fillStyle = "#5b9bd5";
          ctx.fill();
          ctx.strokeStyle = palette.ring;
          ctx.lineWidth = 1.2 / globalScale;
          ctx.stroke();
          ctx.fillStyle = palette.label;
          ctx.globalAlpha = 0.9;
          ctx.font = `600 ${11 / globalScale}px "Segoe UI", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("New idea", cur.x, cur.y + r + 4 / globalScale);
          ctx.restore();
          return;
        }
        if (!connectFrom) return;
        const src = graphData.nodes.find((n) => n.id === connectFrom);
        if (!src || src.x == null || src.y == null) return;
        ctx.save();
        ctx.strokeStyle = palette.linkHot;
        ctx.fillStyle = palette.linkHot;
        ctx.lineWidth = 1.35 / globalScale;
        ctx.setLineDash([5 / globalScale, 4 / globalScale]);
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const head = 5.2 / globalScale;
        if (linkArrows === "one" || linkArrows === "both") {
          drawArrowHead(ctx, src.x, src.y, cur.x, cur.y, head);
        }
        if (linkArrows === "both") {
          drawArrowHead(ctx, cur.x, cur.y, src.x, src.y, head);
        }
        ctx.restore();
      }}
    />
    </div>
  );
}
