export function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function normalizeDeg(degrees: number) {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function rotatePoint(x: number, y: number, cx: number, cy: number, radians: number) {
  if (!radians) return { x, y };
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}
