export type Point = { x: number; y: number };

function cross(ax: number, ay: number, bx: number, by: number) {
  return ax * by - ay * bx;
}

/** Proper segment intersection (excluding shared endpoints as crossings). */
export function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = cross(r.x, r.y, s.x, s.y);
  if (Math.abs(denom) < 1e-12) return null;
  const qmp = { x: c.x - a.x, y: c.y - a.y };
  const t = cross(qmp.x, qmp.y, s.x, s.y) / denom;
  const u = cross(qmp.x, qmp.y, r.x, r.y) / denom;
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

/** Latest self-crossing of the trailing edge against an earlier segment. */
export function findSelfIntersection(points: Point[]): { at: number; point: Point } | null {
  const n = points.length;
  if (n < 4) return null;
  const a = points[n - 2];
  const b = points[n - 1];
  for (let i = n - 4; i >= 0; i--) {
    const hit = segmentIntersection(points[i], points[i + 1], a, b);
    if (hit) return { at: i, point: hit };
  }
  return null;
}

function loopFromCross(points: Point[], crossAt: number, hit: Point): Point[] {
  const inner: Point[] = [hit];
  for (let i = crossAt + 1; i < points.length; i++) inner.push(points[i]);
  inner.push(hit);
  return inner;
}

function chordClosed(points: Point[]): Point[] {
  if (points.length < 2) return [...points];
  return [...points];
}

/** Region to test and fill: chord-closed path, or inner loop after self-cross. */
export function lassoRegion(points: Point[]): Point[] {
  if (points.length < 3) return chordClosed(points);
  const cross = findSelfIntersection(points);
  if (cross) return loopFromCross(points, cross.at, cross.point);
  return chordClosed(points);
}

export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
