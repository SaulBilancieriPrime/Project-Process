import { forceCollide, forceRadial } from "d3-force";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { users } from "../data/users";
import { personStyle } from "../data/personStyle";
import { NODE_FILL, graphTheme, nodeColor, sizeForLevel, withAlpha } from "../graph/colors";
import { employeeInitials } from "../graph/employee";
import { findOriginId, hopDistances, hopGlow, pulseAmountOnLink, pulseFront, pulseHalo, pulseStroke } from "../graph/pulse";
import { findSelfIntersection, lassoRegion, pointInPolygon, type Point } from "../graph/lasso";
import { rotatePoint, viewCoverOffset } from "../graph/viewRotation";
import { isFiltered, linkEnds } from "../graph/visibility";
import { STATUS_COLORS, type WorkflowStatus } from "../graph/workflowStatus";
import { loadPersonPhoto } from "../lib/personPhoto";
import type { ArrowStyle, GraphLink, GraphNode, GraphSettings } from "../types";

export type GraphHandle = ForceGraphMethods<GraphNode, GraphLink>;

/** Shift adds to the selection, Ctrl/⌘ subtracts from it, otherwise the lasso replaces it. */
export type LassoMode = "replace" | "add" | "subtract";

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
  uprightText?: boolean;
  width: number;
  height: number;
  onSelect: (id: string | null, additive?: boolean) => void;
  onMarquee: (ids: string[], mode: LassoMode) => void;
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

/** Hit target in graph space: disc + halo/ring paint + screen slack. */
function nodePickRadius(node: GraphNode, globalScale: number, enlarge: number, extraScreenPx = 14) {
  const k = Math.max(globalScale, 1e-4);
  return dotRadius(node, globalScale, enlarge) + (3.2 + 2.2 + extraScreenPx) / k;
}

/** Screen-px radius of the "−" deselect badge; tracks the node's on-screen size so it never hides small nodes. */
function deselectBadgePx(node: GraphNode, globalScale: number, enlarge: number) {
  return Math.min(7, Math.max(4.5, dotRadius(node, globalScale, enlarge) * globalScale * 0.75));
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
  unrotate = 0,
) {
  const k = Math.max(globalScale, 1e-4);
  ctx.save();
  ctx.translate(x, y);
  if (unrotate) ctx.rotate(unrotate);
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
    unrotate?: number;
  },
) {
  const { x, y, r, fill, border, globalScale, selected, hovered, photo, initials, unassigned, unrotate = 0 } = args;
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
  }, unrotate);

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
  uprightText = true,
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
  const labelCanvasRef = useRef<HTMLCanvasElement>(null);
  const spaceHeld = useRef(false);
  const skipBg = useRef(false);
  const armedClickHandled = useRef(false);
  const fgContextHandled = useRef(false);
  const interaction = useRef<
    | { type: "marquee"; points: Point[]; mode: LassoMode; sx0: number; sy0: number }
    | { type: "group"; lastX: number; lastY: number }
    | { type: "pan"; sx: number; sy: number; cx: number; cy: number }
    | { type: "drag"; ids: string[]; lastX: number; lastY: number; sx: number; sy: number; moved: boolean }
    | null
  >(null);
  const [gesture, setGesture] = useState<"marquee" | "group" | "pan" | "drag" | null>(null);
  const [overBadge, setOverBadge] = useState(false);
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  useEffect(() => {
    graphRef.current?.resumeAnimation?.();
  }, [graphRef, rotation, uprightText]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
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
    const { ox, oy } = viewCoverOffset(width, height);
    const rotated = rotatePoint(sx, sy, cx, cy, -rotationRef.current);
    return { x: rotated.x - ox, y: rotated.y - oy };
  }

  function overlayLabels() {
    return uprightText && Math.abs(rotationRef.current) > 1e-6;
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

  function labelUnrotate() {
    return uprightText && Math.abs(rotationRef.current) > 1e-6 ? -rotationRef.current : 0;
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

  function paintUprightLabels(globalScale: number) {
    const canvas = labelCanvasRef.current;
    if (!canvas) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!overlayLabels() || settings.showText === false) return;
    const fg = graphRef.current;
    if (!fg?.graph2ScreenCoords) return;
    const { ox, oy } = viewCoverOffset(width, height);
    const nodeScale = viewScale(settings.enlarge);
    const cardScale = viewScale(settings.cardScale, nodeScale);
    const textScale = viewScale(settings.textScale, nodeScale);
    const asCard = cardsAtZoom(Boolean(settings.cardInfo), globalScale);

    const screenOfNode = (x: number, y: number) => {
      const s = fg.graph2ScreenCoords(x, y);
      return rotatePoint(s.x + ox, s.y + oy, width / 2, height / 2, rotationRef.current);
    };

    for (const node of liveEngineNodes()) {
      if (node.x == null || node.y == null) continue;
      const matched = isFiltered(node, search, settings.colorBy, filterOptions);
      const dim = !matched;
      const selected = selectedSet.has(node.id);
      const hovered = node.id === hoveredId;
      const connecting = node.id === connectFrom;
      const r = dotRadius(node, globalScale, nodeScale);
      const p = screenOfNode(node.x, node.y);
      ctx.save();
      ctx.globalAlpha = dim ? 0.16 : 1;
      if (asCard) {
        const { w, h } = cardBox(node, globalScale, cardScale);
        const sw = w * globalScale;
        const sh = h * globalScale;
        const rx = p.x - sw / 2;
        const ry = p.y + r * globalScale + 6;
        const rad = 7;
        ctx.fillStyle = palette.card;
        ctx.strokeStyle = selected || connecting ? palette.ring : withAlpha(nodeColor(node, settings.colorBy), 0.85);
        ctx.lineWidth = selected ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(rx + rad, ry);
        ctx.arcTo(rx + sw, ry, rx + sw, ry + sh, rad);
        ctx.arcTo(rx + sw, ry + sh, rx, ry + sh, rad);
        ctx.arcTo(rx, ry + sh, rx, ry, rad);
        ctx.arcTo(rx, ry, rx + sw, ry, rad);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(rx, ry, sw, sh);
        ctx.clip();
        const titleSize = 12 * textScale;
        ctx.fillStyle = palette.cardText;
        ctx.font = `600 ${titleSize}px "Segoe UI", sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(wrapText(ctx, node.title, sw - 16, 1)[0] ?? node.title, rx + 8, ry + 8);
        if (node.description) {
          const bodySize = 10.5 * textScale;
          ctx.fillStyle = palette.cardMuted;
          ctx.font = `${bodySize}px "Segoe UI", sans-serif`;
          wrapText(ctx, node.description, sw - 16, 2).forEach((line, i) => {
            ctx.fillText(line, rx + 8, ry + 26 + i * (bodySize + 3));
          });
        }
      } else if (shouldLabel(node, globalScale, selected, hovered, Boolean(search && matched))) {
        ctx.globalAlpha = (dim ? 0.16 : 1) * (selected || hovered || node.level <= 1 ? 1 : smoothstep(0.28, 0.7, globalScale || 0.3));
        const fontPx = 11 * textScale;
        const rScreen = r * globalScale;
        ctx.font = `${node.level === 0 ? 700 : 600} ${fontPx}px "Segoe UI", sans-serif`;
        ctx.fillStyle = dim ? palette.labelDim : palette.label;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        wrapText(ctx, node.title, 148 * textScale, 2).forEach((line, i) => {
          ctx.fillText(line, p.x, p.y + rScreen + 4 + i * (fontPx + 2));
        });
      }
      ctx.restore();
    }

    const cur = cursorGraph.current;
    if (placeArmed && cur) {
      const p = screenOfNode(cur.x, cur.y);
      const src = placeFrom ? graphData.nodes.find((n) => n.id === placeFrom) : null;
      const ghostLevel = src ? src.level + 1 : 2;
      const ghostSize = placeSize ?? sizeForLevel(ghostLevel);
      const r = dotRadius({ size: ghostSize, level: ghostLevel } as GraphNode, globalScale, nodeScale);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = palette.label;
      ctx.font = '600 11px "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("New idea", p.x, p.y + r * globalScale + 4);
      ctx.restore();
    }
  }

  function nodeAt(clientX: number, clientY: number, extraPad = 0) {
    const g = graphAtClient(clientX, clientY);
    const k = zoomK();
    const nodeScale = viewScale(settings.enlarge);
    const cardScale = viewScale(settings.cardScale, nodeScale);
    const cards = cardsAtZoom(Boolean(settings.cardInfo), k);
    const pickSlack = connectArmed || placeArmed ? 20 : 14;
    let best: GraphNode | null = null;
    let bestD = Infinity;
    for (const n of liveEngineNodes()) {
      if (n.x == null || n.y == null) continue;
      const r = nodePickRadius(n, k, nodeScale, pickSlack + extraPad);
      const d = Math.hypot(n.x - g.x, n.y - g.y);
      if (d <= r && d < bestD) {
        best = n;
        bestD = d;
      }
      if (cards) {
        const box = cardBox(n, k, cardScale);
        const discR = dotRadius(n, k, nodeScale);
        const local = labelUnrotate()
          ? rotatePoint(g.x, g.y, n.x, n.y, rotationRef.current)
          : { x: g.x, y: g.y };
        const lx = local.x - n.x;
        const ly = local.y - n.y;
        const top = discR + 6 / k;
        if (lx >= -box.w / 2 && lx <= box.w / 2 && ly >= top && ly <= top + box.h && d < bestD + box.w) {
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

  /** Drops the temporary engine hold placed on nodes while they were being dragged. */
  function releaseHeld(ids: Set<string>) {
    for (const n of liveEngineNodes()) {
      if (!ids.has(n.id)) continue;
      n.fx = undefined;
      n.fy = undefined;
    }
  }

  function showDeselectBadges() {
    return selectedSet.size > 1 && !placeArmed && !connectArmed;
  }

  /** Graph-space center of the "−" badge at a selected node's upper right, kept upright when the view is rotated. */
  function deselectBadgeCenter(n: GraphNode, k: number) {
    const enlarge = viewScale(settings.enlarge);
    const reach = ((dotRadius(n, k, enlarge) * k + deselectBadgePx(n, k, enlarge) * 0.4) * Math.SQRT1_2) / k;
    const a = labelUnrotate();
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return { x: (n.x ?? 0) + reach * cos + reach * sin, y: (n.y ?? 0) + reach * sin - reach * cos };
  }

  function deselectBadgeAt(clientX: number, clientY: number) {
    if (!showDeselectBadges()) return null;
    const g = graphAtClient(clientX, clientY);
    const k = zoomK();
    const enlarge = viewScale(settings.enlarge);
    let best: string | null = null;
    let bestD = Infinity;
    for (const n of liveEngineNodes()) {
      if (!selectedSet.has(n.id) || n.x == null || n.y == null) continue;
      const c = deselectBadgeCenter(n, k);
      const d = Math.hypot(c.x - g.x, c.y - g.y);
      if (d <= (deselectBadgePx(n, k, enlarge) + 2) / k && d < bestD) {
        best = n.id;
        bestD = d;
      }
    }
    return best;
  }

  function nodesInLasso(points: Point[]) {
    const region = lassoRegion(points);
    if (region.length < 3) return [];
    return liveEngineNodes().filter((n) => n.x != null && n.y != null && pointInPolygon(n.x, n.y, region));
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

  const cover = viewCoverOffset(width, height);

  return (
    <div
      ref={hostRef}
      className={`graph-host absolute inset-0${placeArmed || connectArmed ? " is-draw" : ""}${gesture === "marquee" ? " is-select" : ""}${gesture === "group" ? " is-grab" : ""}${gesture === "pan" ? " is-pan" : ""}${overBadge && !gesture ? " is-badge" : ""}`}
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
        const badgeId = deselectBadgeAt(e.clientX, e.clientY);
        if (badgeId) {
          skipBg.current = true;
          setOverBadge(false);
          onMarquee([badgeId], "subtract");
          return;
        }
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
          points: [{ x: g.x, y: g.y }],
          mode: e.shiftKey ? "add" : e.ctrlKey || e.metaKey ? "subtract" : "replace",
          sx0: e.clientX,
          sy0: e.clientY,
        };
        setGesture("marquee");
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (placeArmed || connectFrom) cursorGraph.current = graphAtClient(e.clientX, e.clientY);
        if (!interaction.current) {
          const badge = deselectBadgeAt(e.clientX, e.clientY);
          setOverBadge(badge != null);
          onHover(badge ?? nodeAt(e.clientX, e.clientY, 12)?.id ?? null);
        }
        const it = interaction.current;
        if (!it) return;
        if (it.type === "marquee") {
          const g = graphAtClient(e.clientX, e.clientY);
          const k = zoomK();
          const last = it.points[it.points.length - 1];
          if (!last || Math.hypot(g.x - last.x, g.y - last.y) > 4 / k) {
            it.points.push({ x: g.x, y: g.y });
          } else {
            last.x = g.x;
            last.y = g.y;
          }
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
        if (!it && e.button === 0 && (connectArmed || placeArmed)) {
          armedClickHandled.current = false;
          skipBg.current = true;
          if (handleGraphClick(e.clientX, e.clientY, e.shiftKey)) {
            armedClickHandled.current = true;
            return;
          }
          if (placeArmed) {
            const g = graphAtClient(e.clientX, e.clientY);
            onBackground(e.clientX, e.clientY, g);
            armedClickHandled.current = true;
          }
          return;
        }
        if (!it) return;
        if (it.type === "marquee") {
          if (Math.hypot(e.clientX - it.sx0, e.clientY - it.sy0) < 6) {
            skipBg.current = true;
            if (handleGraphClick(e.clientX, e.clientY, it.mode === "add")) return;
            const g = graphAtClient(e.clientX, e.clientY);
            onBackground(e.clientX, e.clientY, g);
            return;
          }
          skipBg.current = true;
          onMarquee(nodesInLasso(it.points).map((n) => n.id), it.mode);
        } else if (it.type === "group") {
          releaseHeld(selectedSet);
          onGroupMoveEnd(selectedPositions());
        } else if (it.type === "drag" && it.moved) {
          const idSet = new Set(it.ids);
          releaseHeld(idSet);
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
      className="graph-spin pointer-events-none absolute origin-center"
      style={{
        transform: `rotate(${rotation}rad)`,
        left: cover.ox,
        top: cover.oy,
        width: cover.cover,
        height: cover.cover,
      }}
    >
    <ForceGraph2D<GraphNode, GraphLink>
      ref={graphRef as never}
      width={cover.cover}
      height={cover.cover}
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
      enablePointerInteraction={connectArmed || placeArmed}
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
          releaseHeld(selectedSet);
          onGroupMoveEnd(selectedPositions());
          return;
        }
        releaseHeld(new Set([n.id]));
        onDragEnd(n.id, n.x ?? 0, n.y ?? 0);
      }}
      onNodeClick={(n, ev) => {
        if (armedClickHandled.current) {
          armedClickHandled.current = false;
          return;
        }
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
        if (armedClickHandled.current) {
          armedClickHandled.current = false;
          return;
        }
        if (placeArmed) return;
        if (connectArmed) return;
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
        const src = nodeById.get(e.source);
        const tgt = nodeById.get(e.target);
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
        const src = typeof link.source === "object" ? link.source as GraphNode : nodeById.get(String(link.source));
        const tgt = typeof link.target === "object" ? link.target as GraphNode : nodeById.get(String(link.target));
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
        const pickSlack = connectArmed || placeArmed ? 20 : 14;
        if (showCard) {
          const r = dotRadius(node, globalScale, nodeScale);
          const { w, h } = cardBox(node, globalScale, cardScale);
          ctx.fillRect((node.x ?? 0) - w / 2, (node.y ?? 0) + r + 6 / globalScale, w, h);
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, nodePickRadius(node, globalScale, nodeScale, pickSlack), 0, Math.PI * 2);
          ctx.fill();
        } else {
          const r = nodePickRadius(node, globalScale, nodeScale, pickSlack);
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
        const unrotate = labelUnrotate();
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
          unrotate,
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
        if (connectArmed && hovered && !connecting) {
          ctx.beginPath();
          ctx.arc(x, y, r + 4.5 / globalScale, 0, Math.PI * 2);
          ctx.strokeStyle = palette.connectRing;
          ctx.lineWidth = 2.4 / globalScale;
          ctx.setLineDash([4 / globalScale, 3 / globalScale]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (overlayLabels()) {
          /* labels/cards paint on the unrotated overlay so they stay sharp */
        } else if (asCard) {
          const { w, h } = cardBox(node, globalScale, cardScale);
          ctx.globalAlpha = alpha;
          inScreenSpace(ctx, x, y, globalScale, (k) => {
            const sw = w * k;
            const sh = h * k;
            const rx = -sw / 2;
            const ry = r * k + 6;
            const rad = 7;
            ctx.fillStyle = palette.card;
            ctx.strokeStyle = selected || connecting ? palette.ring : withAlpha(border, 0.85);
            ctx.lineWidth = selected ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(rx + rad, ry);
            ctx.arcTo(rx + sw, ry, rx + sw, ry + sh, rad);
            ctx.arcTo(rx + sw, ry + sh, rx, ry + sh, rad);
            ctx.arcTo(rx, ry + sh, rx, ry, rad);
            ctx.arcTo(rx, ry, rx + sw, ry, rad);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            if (!showText) return;
            ctx.beginPath();
            ctx.rect(rx, ry, sw, sh);
            ctx.clip();
            const titleSize = 12 * textScale;
            const bodySize = 10.5 * textScale;
            ctx.fillStyle = palette.cardText;
            ctx.font = `600 ${titleSize}px "Segoe UI", sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            const title = wrapText(ctx, node.title, sw - 16, 1)[0] ?? node.title;
            ctx.fillText(title, rx + 8, ry + 8);
            if (node.description) {
              ctx.fillStyle = palette.cardMuted;
              ctx.font = `${bodySize}px "Segoe UI", sans-serif`;
              const lines = wrapText(ctx, node.description, sw - 16, 2);
              lines.forEach((line, i) => {
                ctx.fillText(line, rx + 8, ry + 26 + i * (bodySize + 3));
              });
            }
          }, unrotate);
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
          }, unrotate);
        }

        ctx.restore();
      }}
      onRenderFramePost={(ctx, globalScale) => {
        const box = interaction.current;
        if (box?.type === "marquee" && box.points.length >= 1) {
          const pts = box.points;
          const cross = findSelfIntersection(pts);
          const region = lassoRegion(pts);
          const subtract = box.mode === "subtract";
          ctx.save();
          ctx.fillStyle = subtract
            ? "rgba(244, 63, 94, 0.12)"
            : theme === "dark" ? "rgba(91, 155, 213, 0.14)" : "rgba(27, 58, 107, 0.08)";
          ctx.strokeStyle = subtract ? "#f43f5e" : palette.ring;
          ctx.lineWidth = 1.1 / globalScale;
          if (region.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(region[0].x, region[0].y);
            for (let i = 1; i < region.length; i++) ctx.lineTo(region[i].x, region[i].y);
            ctx.closePath();
            ctx.fill();
          }
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.setLineDash([]);
          ctx.stroke();
          if (!cross && pts.length >= 2) {
            ctx.setLineDash([6 / globalScale, 4 / globalScale]);
            ctx.beginPath();
            ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.lineTo(pts[0].x, pts[0].y);
            ctx.stroke();
          }
          const tip = pts[pts.length - 1];
          if (region.length >= 3 && tip) {
            const count = nodesInLasso(pts).length;
            const sign = box.mode === "add" ? "+" : subtract ? "−" : "";
            const text = `${sign}${count} node${count === 1 ? "" : "s"}`;
            ctx.setLineDash([]);
            inScreenSpace(ctx, tip.x, tip.y, globalScale, () => {
              ctx.font = "600 11px \"Segoe UI\", sans-serif";
              const w = ctx.measureText(text).width + 12;
              ctx.fillStyle = subtract ? "#be123c" : "rgba(27, 58, 107, 0.92)";
              ctx.beginPath();
              ctx.roundRect(12, 10, w, 20, 10);
              ctx.fill();
              ctx.fillStyle = "#f3f2f1";
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.fillText(text, 18, 20);
            }, labelUnrotate());
          }
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
          if (showDeselectBadges()) {
            for (const n of liveEngineNodes()) {
              if (!selectedSet.has(n.id) || n.x == null || n.y == null) continue;
              const c = deselectBadgeCenter(n, globalScale);
              const hot = n.id === hoveredId;
              const br = deselectBadgePx(n, globalScale, viewScale(settings.enlarge));
              inScreenSpace(ctx, c.x, c.y, globalScale, () => {
                ctx.beginPath();
                ctx.arc(0, 0, br, 0, Math.PI * 2);
                ctx.fillStyle = hot ? "#9f1239" : "#be123c";
                ctx.fill();
                ctx.lineWidth = 1.25;
                ctx.strokeStyle = palette.card;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-br * 0.5, 0);
                ctx.lineTo(br * 0.5, 0);
                ctx.lineWidth = Math.max(1.2, br * 0.26);
                ctx.lineCap = "round";
                ctx.strokeStyle = "#ffffff";
                ctx.stroke();
              });
            }
          }
        }
        const cur = cursorGraph.current;
        if (!cur) {
          paintUprightLabels(globalScale);
          return;
        }
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
            unrotate: labelUnrotate(),
          });
          ctx.fillStyle = palette.label;
          ctx.globalAlpha = 0.9;
          if (!overlayLabels()) {
            ctx.fillStyle = palette.label;
            ctx.globalAlpha = 0.9;
            inScreenSpace(ctx, cur.x, cur.y, globalScale, (k) => {
              ctx.font = "600 11px \"Segoe UI\", sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillText("New idea", 0, r * k + 4);
            });
          }
          ctx.restore();
          paintUprightLabels(globalScale);
          return;
        }
        if (!connectFrom) {
          paintUprightLabels(globalScale);
          return;
        }
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
        paintUprightLabels(globalScale);
      }}
    />
    </div>
    <canvas ref={labelCanvasRef} className="graph-labels pointer-events-none absolute inset-0" width={width} height={height} />
    </div>
  );
}
