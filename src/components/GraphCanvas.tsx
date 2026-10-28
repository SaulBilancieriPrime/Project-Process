import { forceCollide, forceRadial } from "d3-force";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { users } from "../data/users";
import { personStyle } from "../data/personStyle";
import { NODE_FILL, graphTheme, nodeColor, sizeForLevel, withAlpha } from "../graph/colors";
import { employeeInitials } from "../graph/employee";
import { findOriginId, hopDistances, hopGlow, pulseAmountOnLink, pulseFront, pulseHalo, pulseStroke } from "../graph/pulse";
import { rotatePoint } from "../graph/viewRotation";
import { isFiltered, linkEnds } from "../graph/visibility";
import { STATUS_COLORS, type WorkflowStatus } from "../graph/workflowStatus";
import { loadPersonPhoto } from "../lib/personPhoto";
import type { ArrowStyle, GraphLink, GraphNode, GraphSettings } from "../types";

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
  statusFilters: WorkflowStatus[];
  employeeFilter: string | null;
  hideFiltered: boolean;
  theme: "light" | "dark";
  rotation?: number;
  width: number;
  height: number;
  onSelect: (id: string | null, additive?: boolean) => void;
  onMarquee: (ids: string[], additive: boolean) => void;
  onGroupMoveEnd: (positions: { id: string; x: number; y: number }[]) => void;
  onSelectLink: (id: string) => void;
  onHover: (id: string | null) => void;
  onEditLink: (id: string) => void;
  onNodeMenu: (id: string, x: number, y: number) => void;
  onLinkMenu: (id: string, x: number, y: number) => void;
  onBackgroundMenu: (x: number, y: number) => void;
  onBackground: (x: number, y: number, graph: { x: number; y: number }) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onConnectTarget: (id: string) => void;
  onPlace: (graph: { x: number; y: number }) => void;
  onZoom: (k: number) => void;
  onSettle: () => void;
  graphRef: MutableRefObject<GraphHandle | undefined>;
};

function layoutCentroid(nodes: GraphNode[]) {
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (const n of nodes) {
    if (typeof n.x !== "number" || typeof n.y !== "number") continue;
    sx += n.x;
    sy += n.y;
    count += 1;
  }
  if (!count) return { x: 0, y: 0 };
  return { x: sx / count, y: sy / count };
}

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

function viewScale(value: number | undefined, fallback = 1) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function assigneeEmail(node: GraphNode) {
  const email = node.employeeEmail?.trim();
  if (email) return email.toLowerCase();
  const name = node.employee?.trim().toLowerCase();
  if (!name) return "";
  return users.find((user) => user.name.toLowerCase() === name)?.email.toLowerCase() ?? "";
}

function inScreenSpace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  globalScale: number,
  paint: (scale: number) => void,
) {
  const k = Math.max(globalScale, 1e-4);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / k, 1 / k);
  paint(k);
  ctx.restore();
}

function drawUnassignedIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const size = r * 1.42;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2 + size * 0.06);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = "#1a1208";
  ctx.beginPath();
  ctx.arc(12, 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, 20);
  ctx.bezierCurveTo(4, 16, 8, 14, 12, 14);
  ctx.bezierCurveTo(16, 14, 20, 16, 20, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintNodeDisc(
  ctx: CanvasRenderingContext2D,
  args: {
    x: number;
    y: number;
    r: number;
    fill: string;
    border: string;
    globalScale: number;
    selected?: boolean;
    hovered?: boolean;
    photo?: HTMLImageElement;
    initials?: string;
    unassigned?: boolean;
  },
) {
  const { x, y, r, fill, border, globalScale, selected, hovered, photo, initials, unassigned } = args;
  const statusW = (selected || hovered ? 2.8 : 2.2) / globalScale;
  const inkW = Math.max(1.05 / globalScale, r * 0.08);
  const innerR = Math.max(r * 0.62, r - statusW - inkW);

  ctx.beginPath();
  ctx.arc(x, y, innerR, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  inScreenSpace(ctx, x, y, globalScale, (k) => {
    const innerScreen = innerR * k;
    const face = Math.min(innerScreen, 12);
    ctx.beginPath();
    ctx.arc(0, 0, innerScreen, 0, Math.PI * 2);
    ctx.clip();
    if (photo && photo.naturalWidth) {
      const cover = face * 2.2;
      const scale = Math.max(cover / photo.naturalWidth, cover / photo.naturalHeight);
      const dw = photo.naturalWidth * scale;
      const dh = photo.naturalHeight * scale;
      ctx.drawImage(photo, -dw / 2, -dh * 0.32, dw, dh);
    } else if (initials) {
      ctx.fillStyle = "#1a1208";
      ctx.font = `700 ${Math.max(6, face * 0.72)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, 0, 0);
    } else if (unassigned) {
      drawUnassignedIcon(ctx, 0, 0, face);
    }
  });

  ctx.beginPath();
  ctx.arc(x, y, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = inkW;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, innerR + inkW * 0.5 + statusW * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = border;
  ctx.lineWidth = statusW;
  ctx.stroke();
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
  statusFilters,
  employeeFilter,
  hideFiltered,
  theme,
  rotation = 0,
  width,
  height,
  onSelect,
  onMarquee,
  onGroupMoveEnd,
  onSelectLink,
  onHover,
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
    | { type: "drag"; ids: string[]; lastX: number; lastY: number; sx: number; sy: number; moved: boolean }
    | null
  >(null);
  const [gesture, setGesture] = useState<"marquee" | "group" | "pan" | "drag" | null>(null);
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  useEffect(() => {
    graphRef.current?.resumeAnimation?.();
  }, [graphRef, rotation]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const palette = graphTheme(theme);

  const filterOptions = useMemo(
    () => ({ statusFilters, employeeEmail: employeeFilter }),
    [statusFilters, employeeFilter],
  );

  const graphData = useMemo(() => {
    const visible = nodes.filter((n) => {
      if (hideFiltered && !isFiltered(n, search, settings.colorBy, filterOptions)) return false;
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
  }, [nodes, links, hideFiltered, search, settings.colorBy, filterOptions]);

  const photosRef = useRef(new Map<string, HTMLImageElement>());
  const photoAsked = useRef(new Set<string>());
  const [, setPhotoGen] = useState(0);
  useEffect(() => {
    const emails = new Set(graphData.nodes.map(assigneeEmail).filter(Boolean));
    for (const email of emails) {
      if (photoAsked.current.has(email)) continue;
      photoAsked.current.add(email);
      loadPersonPhoto(email).then((url) => {
        if (!url) return;
        const img = new Image();
        img.onload = () => {
          photosRef.current.set(email, img);
          setPhotoGen((n) => n + 1);
        };
        img.src = url;
      });
    }
  }, [graphData.nodes]);

  const pulseHops = useMemo(() => {
    if (!settings.pulse) return null;
    const origin = findOriginId(graphData.nodes);
    if (!origin) return null;
    const hops = hopDistances(graphData.nodes, graphData.links, origin);
    let maxHop = 0;
    for (const hop of hops.values()) if (hop > maxHop) maxHop = hop;
    return { hops, maxHop, origin };
  }, [settings.pulse, graphData]);

  const pulseAt = useRef(0);
  useEffect(() => {
    if (!settings.pulse) return;
    let frame = 0;
    const tick = (now: number) => {
      pulseAt.current = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settings.pulse]);

  function pulseAmountForLink(link: GraphLink) {
    if (!pulseHops) return 0;
    const front = pulseFront(pulseAt.current, settings.pulseSpeed ?? 0.7, pulseHops.maxHop);
    return pulseAmountOnLink(link, pulseHops.hops, front, pulseHops.maxHop);
  }

  useEffect(() => {
    if (!placeArmed) return;
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(".plus-wrap, .filter-panel, .canvas-tools, .view-compass, .history-panel, .info-panel, .item-actions, .edit-float, .ctx, .omp-header")) return;
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
    linkForce?.strength?.(0.28);
    const { x: cx, y: cy } = layoutCentroid(nodes);
    if (settings.radial) {
      fg.d3Force(
        "radial",
        forceRadial((d: GraphNode) => 48 + d.level * 108, cx, cy).strength(0.032) as never,
      );
    } else {
      fg.d3Force("radial", null);
    }
    fg.d3Force(
      "collide",
      forceCollide((d: GraphNode) => settings.collide + d.size * 8 + Math.max(0, 4 - d.level)).strength(0.92).iterations(3) as never,
    );
    if (settings.physics) fg.d3ReheatSimulation();
  }, [graphRef, settings, nodes]);

  function canvasAtClient(clientX: number, clientY: number) {
    const rect = hostRef.current?.getBoundingClientRect();
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    const cx = (rect?.width ?? width) / 2;
    const cy = (rect?.height ?? height) / 2;
    return rotatePoint(sx, sy, cx, cy, -rotationRef.current);
  }

  function graphAtClient(clientX: number, clientY: number) {
    const p = canvasAtClient(clientX, clientY);
    return graphRef.current?.screen2GraphCoords(p.x, p.y) ?? { x: 0, y: 0 };
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

  function nodeAt(clientX: number, clientY: number, extraPad = 0) {
    const g = graphAtClient(clientX, clientY);
    const k = zoomK();
    const nodeScale = viewScale(settings.enlarge);
    const cardScale = viewScale(settings.cardScale, nodeScale);
    const cards = cardsAtZoom(Boolean(settings.cardInfo), k);
    let best: GraphNode | null = null;
    let bestD = Infinity;
    for (const n of liveEngineNodes()) {
      if (n.x == null || n.y == null) continue;
      const r = dotRadius(n, k, nodeScale) + (10 + extraPad) / k;
      const d = Math.hypot(n.x - g.x, n.y - g.y);
      if (d <= r && d < bestD) {
        best = n;
        bestD = d;
      }
      if (cards) {
        const box = cardBox(n, k, cardScale);
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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const trapWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const fg = graphRef.current;
      if (!fg) return;
      const oldK = zoomK();
      const nextK = Math.max(0.12, Math.min(8, oldK * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      if (nextK === oldK) return;
      const g = graphAtClient(e.clientX, e.clientY);
      fg.zoom(nextK, 0);
      const after = graphAtClient(e.clientX, e.clientY);
      const c = fg.centerAt?.() ?? { x: 0, y: 0 };
      fg.centerAt(c.x + (g.x - after.x), c.y + (g.y - after.y), 0);
      onZoom(nextK);
    };
    host.addEventListener("wheel", trapWheel, { passive: false, capture: true });
    return () => host.removeEventListener("wheel", trapWheel, { capture: true });
  }, [graphRef, onZoom]);

  return (
    <div
      ref={hostRef}
      className={`graph-host absolute inset-0${placeArmed || connectArmed ? " is-draw" : ""}${gesture === "marquee" ? " is-select" : ""}${gesture === "group" ? " is-grab" : ""}${gesture === "pan" ? " is-pan" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        const handledByFg = fgContextHandled.current;
        fgContextHandled.current = false;
        const target = e.target as HTMLElement | null;
        if (target?.closest(".plus-wrap, .filter-panel, .site-left-rail, .left-panel-top, .left-panel-bottom, .canvas-tools, .view-compass, .history-panel, .info-panel, .item-actions, .edit-float, .ctx, .omp-header")) return;
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
        if (e.button === 1 || (e.button === 0 && (spaceHeld.current || e.altKey))) {
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
        if (target?.closest(".plus-wrap, .filter-panel, .site-left-rail, .left-panel-top, .left-panel-bottom, .canvas-tools, .view-compass, .history-panel, .info-panel, .item-actions, .edit-float, .ctx, .omp-header")) return;
        const hit = nodeAt(e.clientX, e.clientY);
        if (hit) {
          skipBg.current = true;
          onSelect(hit.id, e.shiftKey);
          const g = graphAtClient(e.clientX, e.clientY);
          const ids = e.shiftKey
            ? (selectedSet.has(hit.id) ? [...selectedSet] : [...selectedSet, hit.id])
            : selectedSet.has(hit.id) && selectedSet.size > 1
              ? [...selectedSet]
              : [hit.id];
          interaction.current = { type: "drag", ids, lastX: g.x, lastY: g.y, sx: e.clientX, sy: e.clientY, moved: false };
          setGesture("drag");
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
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
        if (!interaction.current) {
          onHover(nodeAt(e.clientX, e.clientY, 12)?.id ?? null);
        }
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
        } else if (it.type === "drag") {
          const g = graphAtClient(e.clientX, e.clientY);
          if (!it.moved && Math.hypot(e.clientX - it.sx, e.clientY - it.sy) < 4) return;
          it.moved = true;
          const idSet = new Set(it.ids);
          const dx = g.x - it.lastX;
          const dy = g.y - it.lastY;
          for (const n of liveEngineNodes()) {
            if (!idSet.has(n.id)) continue;
            n.x = (n.x ?? 0) + dx;
            n.y = (n.y ?? 0) + dy;
            n.fx = n.x;
            n.fy = n.y;
            n.vx = 0;
            n.vy = 0;
          }
          it.lastX = g.x;
          it.lastY = g.y;
          skipBg.current = true;
        } else if (it.type === "pan") {
          const k = zoomK();
          const delta = rotatePoint(e.clientX - it.sx, e.clientY - it.sy, 0, 0, -rotationRef.current);
          graphRef.current?.centerAt(it.cx - delta.x / k, it.cy - delta.y / k);
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
            onBackground(e.clientX, e.clientY, g);
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
        } else if (it.type === "drag" && it.moved) {
          const idSet = new Set(it.ids);
          onGroupMoveEnd(
            liveEngineNodes()
              .filter((n) => idSet.has(n.id) && n.x != null && n.y != null)
              .map((n) => ({ id: n.id, x: n.x as number, y: n.y as number })),
          );
        }
      }}
      onPointerLeave={() => {
        if (!interaction.current) {
          cursorGraph.current = null;
          onHover(null);
        }
      }}
    >
    <div
      className="graph-spin pointer-events-none absolute inset-0 origin-center will-change-transform"
      style={{ transform: `rotate(${rotation}rad)` }}
    >
    <ForceGraph2D<GraphNode, GraphLink>
      ref={graphRef as never}
      width={width}
      height={height}
      graphData={graphData}
      backgroundColor={palette.bg}
      nodeId="id"
      nodeLabel={() => ""}
      linkSource="source"
      linkTarget="target"
      cooldownTicks={settings.physics ? 320 : 0}
      d3VelocityDecay={0.32}
      d3AlphaDecay={0.018}
      minZoom={0.12}
      maxZoom={8}
      enableNodeDrag={false}
      enablePanInteraction={false}
      enableZoomInteraction={false}
      enablePointerInteraction={false}
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
        onBackground(ev.clientX, ev.clientY, g);
      }}
      linkColor={(l) => {
        const e = linkEnds(l);
        const src = nodes.find((n) => n.id === e.source);
        const tgt = nodes.find((n) => n.id === e.target);
        const dim =
          (src && !isFiltered(src, search, settings.colorBy, filterOptions)) ||
          (tgt && !isFiltered(tgt, search, settings.colorBy, filterOptions));
        if (dim) return palette.linkDim;
        const amount = pulseAmountForLink(l);
        if (amount > 0.05) return pulseStroke(amount, theme);
        const hot = l.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target);
        return hot ? palette.linkHot : palette.link;
      }}
      linkWidth={(l) => {
        const e = linkEnds(l);
        const amount = pulseAmountForLink(l);
        const hot = l.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target);
        const base = hot
          ? theme === "dark" ? 2.1 : 1.5
          : theme === "dark" ? 1.45 : 0.95;
        return base + amount * 1.7;
      }}
      linkDirectionalArrowLength={0}
      linkDirectionalArrowRelPos={0.82}
      linkDirectionalArrowColor={(l) => {
        const e = linkEnds(l);
        const amount = pulseAmountForLink(l);
        if (amount > 0.05) return pulseStroke(amount, theme);
        const hot = l.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target);
        return hot ? palette.linkHot : palette.link;
      }}
      linkCanvasObjectMode={(l) => (l.arrows === "one" || l.arrows === "both" ? "after" : undefined)}
      linkCanvasObject={(link, ctx, globalScale) => {
        if (link.arrows !== "one" && link.arrows !== "both") return;
        const src = typeof link.source === "object" ? link.source as GraphNode : nodes.find((n) => n.id === String(link.source));
        const tgt = typeof link.target === "object" ? link.target as GraphNode : nodes.find((n) => n.id === String(link.target));
        if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;
        const e = linkEnds(link);
        const amount = pulseAmountForLink(link);
        const hot = link.id === selectedLinkId || selectedSet.has(e.source) || selectedSet.has(e.target);
        ctx.fillStyle = amount > 0.05
          ? pulseStroke(amount, theme)
          : hot ? palette.linkHot : palette.link;
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
        const nodeScale = viewScale(settings.enlarge);
        const cardScale = viewScale(settings.cardScale, nodeScale);
        const showCard = cardsAtZoom(Boolean(settings.cardInfo), globalScale);
        if (showCard) {
          const r = dotRadius(node, globalScale, nodeScale);
          const { w, h } = cardBox(node, globalScale, cardScale);
          ctx.fillRect((node.x ?? 0) - w / 2, (node.y ?? 0) + r + 6 / globalScale, w, h);
        } else {
          const r = dotRadius(node, globalScale, nodeScale) + 10 / globalScale;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }}
      nodeCanvasObject={(node, ctx, globalScale) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const border = nodeColor(node, settings.colorBy);
        const matched = isFiltered(node, search, settings.colorBy, filterOptions);
        const dim = !matched;
        const selected = selectedSet.has(node.id);
        const hovered = node.id === hoveredId;
        const connecting = node.id === connectFrom;
        const nodeScale = viewScale(settings.enlarge);
        const cardScale = viewScale(settings.cardScale, nodeScale);
        const textScale = viewScale(settings.textScale, nodeScale);
        const r = dotRadius(node, globalScale, nodeScale);
        const asCard = cardsAtZoom(Boolean(settings.cardInfo), globalScale);
        const showText = settings.showText !== false;
        const alpha = dim ? 0.16 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;

        const email = assigneeEmail(node);
        const photo = email ? photosRef.current.get(email) : undefined;
        const fill = email ? personStyle(email).color : NODE_FILL;
        ctx.beginPath();
        ctx.arc(x, y, r + 3.2 / globalScale, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(fill, hovered || selected ? 0.28 : 0.12);
        ctx.fill();
        paintNodeDisc(ctx, {
          x,
          y,
          r,
          fill,
          border,
          globalScale,
          selected,
          hovered,
          photo,
          initials: email && !(photo && photo.naturalWidth) ? employeeInitials(node.employee || email) : undefined,
          unassigned: !email,
        });
        if (pulseHops) {
          const hop = pulseHops.hops.get(node.id);
          if (hop != null) {
            const glow = hopGlow(
              hop,
              pulseFront(pulseAt.current, settings.pulseSpeed ?? 0.7, pulseHops.maxHop),
              pulseHops.maxHop,
            );
            if (glow > 0.08) {
              const haloR = r + (3.2 + glow * 5.2) / globalScale;
              ctx.beginPath();
              ctx.arc(x, y, haloR, 0, Math.PI * 2);
              ctx.fillStyle = pulseHalo(glow, theme);
              ctx.globalAlpha = alpha;
              ctx.fill();
              ctx.beginPath();
              ctx.arc(x, y, r + (2.2 + glow * 2.8) / globalScale, 0, Math.PI * 2);
              ctx.strokeStyle = pulseStroke(glow, theme);
              ctx.lineWidth = (theme === "dark" ? 1.8 : 1.2 + glow * 1.6) / globalScale;
              ctx.globalAlpha = alpha * (theme === "dark" ? 0.55 + glow * 0.45 : 0.35 + glow * 0.55);
              ctx.stroke();
              ctx.globalAlpha = alpha;
            }
          }
        }
        if (selected || connecting) {
          ctx.beginPath();
          ctx.arc(x, y, r + 2.2 / globalScale, 0, Math.PI * 2);
          ctx.strokeStyle = connecting ? palette.connectRing : palette.ring;
          ctx.lineWidth = 1.2 / globalScale;
          ctx.stroke();
        }

        if (asCard) {
          const { w, h } = cardBox(node, globalScale, cardScale);
          const rx = x - w / 2;
          const ry = y + r + 6 / globalScale;
          const rad = 7 / globalScale;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = palette.card;
          ctx.strokeStyle = selected || connecting ? palette.ring : withAlpha(border, 0.85);
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
          if (showText) {
            inScreenSpace(ctx, rx, ry, globalScale, (k) => {
              const sw = w * k;
              const sh = h * k;
              ctx.beginPath();
              ctx.rect(0, 0, sw, sh);
              ctx.clip();
              const titleSize = 12 * textScale;
              const bodySize = 10.5 * textScale;
              ctx.fillStyle = palette.cardText;
              ctx.font = `600 ${titleSize}px "Segoe UI", sans-serif`;
              ctx.textAlign = "left";
              ctx.textBaseline = "top";
              const title = wrapText(ctx, node.title, sw - 16, 1)[0] ?? node.title;
              ctx.fillText(title, 8, 8);
              if (node.description) {
                ctx.fillStyle = palette.cardMuted;
                ctx.font = `${bodySize}px "Segoe UI", sans-serif`;
                const lines = wrapText(ctx, node.description, sw - 16, 2);
                lines.forEach((line, i) => {
                  ctx.fillText(line, 8, 26 + i * (bodySize + 3));
                });
              }
            });
          }
        } else if (showText && shouldLabel(node, globalScale, selected, hovered, Boolean(search && matched))) {
          ctx.globalAlpha = alpha * smoothstep(0.28, 0.7, globalScale || 0.3);
          if (selected || hovered || node.level <= 1) ctx.globalAlpha = alpha;
          inScreenSpace(ctx, x, y, globalScale, (k) => {
            const fontPx = 11 * textScale;
            const rScreen = r * k;
            ctx.font = `${node.level === 0 ? 700 : 600} ${fontPx}px "Segoe UI", sans-serif`;
            ctx.fillStyle = dim ? palette.labelDim : palette.label;
            const outward = Math.hypot(x, y) > 80;
            const maxW = (outward ? 108 : 140) * textScale;
            const lines = wrapText(ctx, node.title, maxW, 2);
            if (outward) {
              const ang = Math.atan2(y, x);
              const lift = rScreen + 10;
              const lx = Math.cos(ang) * lift;
              const ly = Math.sin(ang) * lift;
              ctx.textAlign = Math.abs(Math.cos(ang)) < 0.35 ? "center" : Math.cos(ang) > 0 ? "left" : "right";
              ctx.textBaseline = Math.sin(ang) > 0.35 ? "top" : Math.sin(ang) < -0.35 ? "bottom" : "middle";
              lines.forEach((line, i) => {
                const dy = (i - (lines.length - 1) / 2) * (fontPx + 2);
                ctx.fillText(line, lx, ly + dy);
              });
            } else {
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              lines.forEach((line, i) => {
                ctx.fillText(line, 0, rScreen + 4 + i * (fontPx + 2));
              });
            }
          });
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
          const nodeScale = viewScale(settings.enlarge);
          const r = dotRadius({ size: ghostSize, level: ghostLevel } as GraphNode, globalScale, nodeScale);
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
          ctx.fillStyle = withAlpha(NODE_FILL, 0.22);
          ctx.fill();
          paintNodeDisc(ctx, {
            x: cur.x,
            y: cur.y,
            r,
            fill: NODE_FILL,
            border: STATUS_COLORS.incomplete,
            globalScale,
            unassigned: true,
          });
          ctx.fillStyle = palette.label;
          ctx.globalAlpha = 0.9;
          inScreenSpace(ctx, cur.x, cur.y, globalScale, (k) => {
            ctx.font = "600 11px \"Segoe UI\", sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText("New idea", 0, r * k + 4);
          });
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
    </div>
  );
}
