import { pointInPolygon, type Point } from "./lasso";

export type Disk = Point & { r: number };
export type Capsule = { a: Point; b: Point; r: number };

/** World-space halo around members and intra-group links. Tight enough that a nearby ungrouped node stays outside. */
export const GROUP_MEMBRANE_PAD = 10;

/** Extra screen-px around each member so the stroke clears the ring without swallowing neighbors. */
export const GROUP_MEMBRANE_SCREEN_PAD = 8;

/** Link corridor as a fraction of the thinner member disk. */
export const GROUP_LINK_CAPSULE = 0.58;

/** Clear air between two group membranes so they never paint over each other. */
export const GROUP_MEMBRANE_GAP = 16;

export type GroupFieldSpec = {
  disks: Disk[];
  capsules: Capsule[];
  blend: number;
};

function cross(o: Point, a: Point, b: Point) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Counter-clockwise convex hull. */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 2) return points.slice();
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Polynomial smooth-min so nearby disks melt into one membrane instead of a peanut. */
function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function signedGroupField(x: number, y: number, disks: Disk[], capsules: Capsule[] = [], blend = 0) {
  let best = Infinity;
  for (const disk of disks) {
    const d = Math.hypot(x - disk.x, y - disk.y) - disk.r;
    best = best === Infinity ? d : smin(best, d, blend);
  }
  for (const cap of capsules) {
    const d = distToSeg(x, y, cap.a.x, cap.a.y, cap.b.x, cap.b.y) - cap.r;
    best = best === Infinity ? d : smin(best, d, blend);
  }
  return best;
}

/** Inside this group only where no other group claims the point, plus a visible gap. */
export function exclusiveGroupField(
  x: number,
  y: number,
  self: GroupFieldSpec,
  others: GroupFieldSpec[] = [],
  gap = GROUP_MEMBRANE_GAP,
) {
  let d = signedGroupField(x, y, self.disks, self.capsules, self.blend);
  for (const other of others) {
    const o = signedGroupField(x, y, other.disks, other.capsules, other.blend);
    d = Math.max(d, -o + gap);
  }
  return d;
}

export function groupFieldGradient(x: number, y: number, disks: Disk[], capsules: Capsule[] = [], blend = 0) {
  return exclusiveGroupFieldGradient(x, y, { disks, capsules, blend }, []);
}

export function exclusiveGroupFieldGradient(
  x: number,
  y: number,
  self: GroupFieldSpec,
  others: GroupFieldSpec[] = [],
  gap = GROUP_MEMBRANE_GAP,
) {
  const e = 1.25;
  const dx = exclusiveGroupField(x + e, y, self, others, gap) - exclusiveGroupField(x - e, y, self, others, gap);
  const dy = exclusiveGroupField(x, y + e, self, others, gap) - exclusiveGroupField(x, y - e, self, others, gap);
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

function lerpZero(a: number, b: number, va: number, vb: number) {
  const t = va / (va - vb);
  return a + (b - a) * t;
}

function edgeKey(a: Point, b: Point) {
  const left = a.x < b.x || (a.x === b.x && a.y <= b.y);
  const p = left ? a : b;
  const q = left ? b : a;
  return `${p.x.toFixed(3)}:${p.y.toFixed(3)}>${q.x.toFixed(3)}:${q.y.toFixed(3)}`;
}

function pointKey(p: Point) {
  return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
}

function polygonArea(pts: Point[]) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return a / 2;
}

function chaikin(pts: Point[], iterations = 7): Point[] {
  let cur = pts;
  for (let n = 0; n < iterations; n += 1) {
    const next: Point[] = [];
    for (let i = 0; i < cur.length; i += 1) {
      const a = cur[i];
      const b = cur[(i + 1) % cur.length];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    cur = next;
  }
  return cur;
}

function laplacian(pts: Point[], amount = 0.5, iterations = 3): Point[] {
  let cur = pts;
  for (let n = 0; n < iterations; n += 1) {
    const next: Point[] = [];
    for (let i = 0; i < cur.length; i += 1) {
      const prev = cur[(i - 1 + cur.length) % cur.length];
      const p = cur[i];
      const nxt = cur[(i + 1) % cur.length];
      next.push({
        x: p.x + ((prev.x + nxt.x) * 0.5 - p.x) * amount,
        y: p.y + ((prev.y + nxt.y) * 0.5 - p.y) * amount,
      });
    }
    cur = next;
  }
  return cur;
}

function smoothLoop(pts: Point[]) {
  return laplacian(chaikin(pts, 7), 0.55, 3);
}

function stitchLoops(segments: Array<[Point, Point]>): Point[][] {
  const unused = new Map<string, [Point, Point]>();
  const adj = new Map<string, Point[]>();
  const addAdj = (from: Point, to: Point) => {
    const k = pointKey(from);
    const list = adj.get(k);
    if (list) list.push(to);
    else adj.set(k, [to]);
  };
  for (const [a, b] of segments) {
    unused.set(edgeKey(a, b), [a, b]);
    addAdj(a, b);
    addAdj(b, a);
  }
  const loops: Point[][] = [];
  while (unused.size) {
    const start = unused.values().next().value as [Point, Point];
    unused.delete(edgeKey(start[0], start[1]));
    const loop: Point[] = [start[0], start[1]];
    let prev = start[0];
    let cur = start[1];
    let guard = segments.length + 2;
    while (guard-- && pointKey(cur) !== pointKey(loop[0])) {
      const nbrs = adj.get(pointKey(cur)) ?? [];
      let next: Point | null = null;
      for (const cand of nbrs) {
        if (pointKey(cand) === pointKey(prev)) continue;
        if (!unused.has(edgeKey(cur, cand))) continue;
        next = cand;
        break;
      }
      if (!next) break;
      unused.delete(edgeKey(cur, next));
      loop.push(next);
      prev = cur;
      cur = next;
    }
    if (loop.length >= 4) {
      if (pointKey(loop[0]) === pointKey(loop[loop.length - 1])) loop.pop();
      if (loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

function fieldBounds(disks: Disk[], capsules: Capsule[], extra: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minR = Infinity;
  for (const disk of disks) {
    minX = Math.min(minX, disk.x - disk.r);
    minY = Math.min(minY, disk.y - disk.r);
    maxX = Math.max(maxX, disk.x + disk.r);
    maxY = Math.max(maxY, disk.y + disk.r);
    minR = Math.min(minR, disk.r);
  }
  for (const cap of capsules) {
    minX = Math.min(minX, cap.a.x - cap.r, cap.b.x - cap.r);
    minY = Math.min(minY, cap.a.y - cap.r, cap.b.y - cap.r);
    maxX = Math.max(maxX, cap.a.x + cap.r, cap.b.x + cap.r);
    maxY = Math.max(maxY, cap.a.y + cap.r, cap.b.y + cap.r);
    minR = Math.min(minR, cap.r);
  }
  minX -= extra;
  minY -= extra;
  maxX += extra;
  maxY += extra;
  return { minX, minY, maxX, maxY, minR: Number.isFinite(minR) ? minR : extra };
}

function fieldContours(self: GroupFieldSpec, others: GroupFieldSpec[] = []): Point[][] {
  const margin = Math.max(self.blend * 0.7, 8);
  const { minX, minY, maxX, maxY, minR } = fieldBounds(self.disks, self.capsules, margin);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const cell = Math.max(Math.min(minR / 2, 16), Math.max(spanX, spanY) / 52, 4);
  const cols = Math.max(2, Math.ceil(spanX / cell));
  const rows = Math.max(2, Math.ceil(spanY / cell));
  const values: number[][] = [];
  for (let i = 0; i <= rows; i += 1) {
    const row: number[] = [];
    const y = minY + i * cell;
    for (let j = 0; j <= cols; j += 1) {
      row.push(exclusiveGroupField(minX + j * cell, y, self, others));
    }
    values.push(row);
  }

  const segments: Array<[Point, Point]> = [];
  const pushPair = (a: Point | null, b: Point | null) => {
    if (a && b) segments.push([a, b]);
  };

  for (let i = 0; i < rows; i += 1) {
    const y0 = minY + i * cell;
    const y1 = y0 + cell;
    for (let j = 0; j < cols; j += 1) {
      const x0 = minX + j * cell;
      const x1 = x0 + cell;
      const v00 = values[i][j];
      const v10 = values[i][j + 1];
      const v01 = values[i + 1][j];
      const v11 = values[i + 1][j + 1];
      const tl = v00 < 0;
      const tr = v10 < 0;
      const bl = v01 < 0;
      const br = v11 < 0;
      const mask = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (mask === 0 || mask === 15) continue;
      const top = tl !== tr ? { x: lerpZero(x0, x1, v00, v10), y: y0 } : null;
      const right = tr !== br ? { x: x1, y: lerpZero(y0, y1, v10, v11) } : null;
      const bottom = bl !== br ? { x: lerpZero(x0, x1, v01, v11), y: y1 } : null;
      const left = tl !== bl ? { x: x0, y: lerpZero(y0, y1, v00, v01) } : null;
      switch (mask) {
        case 1:
        case 14:
          pushPair(left, bottom);
          break;
        case 2:
        case 13:
          pushPair(bottom, right);
          break;
        case 3:
        case 12:
          pushPair(left, right);
          break;
        case 4:
        case 11:
          pushPair(top, right);
          break;
        case 6:
        case 9:
          pushPair(top, bottom);
          break;
        case 7:
        case 8:
          pushPair(top, left);
          break;
        case 5:
        case 10: {
          const center = (v00 + v10 + v01 + v11) * 0.25 < 0;
          if (center === tl) {
            pushPair(left, top);
            pushPair(bottom, right);
          } else {
            pushPair(left, bottom);
            pushPair(top, right);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return stitchLoops(segments)
    .map((loop) => smoothLoop(loop))
    .sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
}

export function groupFieldBlend(disks: Disk[]) {
  if (!disks.length) return GROUP_MEMBRANE_PAD * 0.7;
  const avg = disks.reduce((sum, d) => sum + d.r, 0) / disks.length;
  return Math.max(14, avg * 0.58);
}

/** Padded, blended membrane around node disks and the links that join them. */
export function cellHulls(
  disks: Disk[],
  capsules: Capsule[] = [],
  blend?: number,
  others: GroupFieldSpec[] = [],
): Point[][] {
  if (!disks.length) return [];
  const k = blend ?? groupFieldBlend(disks);
  const self = { disks, capsules, blend: k };
  if (disks.length === 1 && !capsules.length && !others.length) {
    const disk = disks[0];
    const count = 32;
    const ring: Point[] = [];
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      ring.push({ x: disk.x + Math.cos(a) * disk.r, y: disk.y + Math.sin(a) * disk.r });
    }
    return [smoothLoop(ring)];
  }
  return fieldContours(self, others);
}

/** Largest membrane — kept for callers that only need one ring. */
export function cellHull(disks: Disk[], capsules: Capsule[] = [], blend?: number, others: GroupFieldSpec[] = []): Point[] {
  return cellHulls(disks, capsules, blend, others)[0] ?? [];
}

/** Smooth closed path through hull vertices so the membrane reads as a cell, not a polygon. */
export function traceCellPath(ctx: CanvasRenderingContext2D, hull: Point[]) {
  if (hull.length < 3) return;
  const n = hull.length;
  ctx.beginPath();
  ctx.moveTo((hull[n - 1].x + hull[0].x) / 2, (hull[n - 1].y + hull[0].y) / 2);
  for (let i = 0; i < n; i += 1) {
    const cur = hull[i];
    const next = hull[(i + 1) % n];
    ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
  }
  ctx.closePath();
}

export function pointInCell(x: number, y: number, hull: Point[]) {
  return hull.length >= 3 && pointInPolygon(x, y, hull);
}

export function hullApex(hull: Point[]): Point | null {
  if (!hull.length) return null;
  let best = hull[0];
  for (const p of hull) {
    if (p.y < best.y) best = p;
  }
  return best;
}

export type GroupFieldBody = {
  memberIds: Set<string>;
  disks: Disk[];
  capsules: Capsule[];
  blend: number;
  cx: number;
  cy: number;
};

/** Pushes nodes that are not in a group out of that group's membrane. */
export function forceGroupExclusion(
  getBodies: (nodes: { id: string; x?: number; y?: number; size?: number; fx?: number; fy?: number; vx?: number; vy?: number }[]) => GroupFieldBody[],
  nodeClearance: (node: { size?: number }) => number,
) {
  type SimNode = {
    id: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number;
    fy?: number;
    size?: number;
  };
  let nodes: SimNode[] = [];
  function force(alpha: number) {
    if (!nodes.length) return;
    const bodies = getBodies(nodes);
    if (!bodies.length) return;
    const strength = 0.7;
    for (const node of nodes) {
      if (node.fx != null || node.fy != null) continue;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const clearance = nodeClearance(node);
      for (const body of bodies) {
        if (body.memberIds.has(node.id)) continue;
        const others = bodies.filter((item) => item !== body);
        const d = exclusiveGroupField(x, y, body, others);
        if (d >= clearance) continue;
        let g = exclusiveGroupFieldGradient(x, y, body, others);
        if (!g.x && !g.y) {
          const awayX = x - body.cx;
          const awayY = y - body.cy;
          const len = Math.hypot(awayX, awayY) || 1;
          g = { x: awayX / len, y: awayY / len };
        }
        const overlap = clearance - d;
        const kick = overlap * strength * alpha;
        node.vx = (node.vx ?? 0) + g.x * kick;
        node.vy = (node.vy ?? 0) + g.y * kick;
        node.x = x + g.x * overlap * 0.45;
        node.y = y + g.y * overlap * 0.45;
      }
    }
  }
  force.initialize = (next: SimNode[]) => {
    nodes = next;
  };
  return force;
}
