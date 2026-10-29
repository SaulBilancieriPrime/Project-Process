type NodeScreen = { left: number; top: number; r: number };

const PANEL_W = 220;
const PANEL_H = 420;
const MARGIN = 12;
const GAP = 16;
const TOP_MIN = 56;

function selectionBounds(points: NodeScreen[]) {
  let minL = Infinity;
  let minT = Infinity;
  let maxL = -Infinity;
  let maxT = -Infinity;
  for (const p of points) {
    minL = Math.min(minL, p.left - p.r);
    minT = Math.min(minT, p.top - p.r);
    maxL = Math.max(maxL, p.left + p.r);
    maxT = Math.max(maxT, p.top + p.r);
  }
  return { minL, minT, maxL, maxT };
}

function clampPanel(left: number, top: number, vw: number, vh: number) {
  return {
    left: Math.min(vw - PANEL_W - MARGIN, Math.max(MARGIN, left)),
    top: Math.min(vh - PANEL_H - MARGIN, Math.max(TOP_MIN, top)),
  };
}

function overlapsPanel(left: number, top: number, bounds: ReturnType<typeof selectionBounds>) {
  const { minL, minT, maxL, maxT } = bounds;
  return left < maxL && left + PANEL_W > minL && top < maxT && top + PANEL_H > minT;
}

/** Fixed position for a bulk-edit panel beside the selected nodes' screen hull. */
export function selectionPanelPlacement(points: NodeScreen[]): { left: number; top: number } {
  if (!points.length) return { left: 80, top: 80 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bounds = selectionBounds(points);

  const candidates = [
    { left: bounds.maxL + GAP, top: bounds.minT },
    { left: bounds.minL - GAP - PANEL_W, top: bounds.minT },
    { left: bounds.minL, top: bounds.maxT + GAP },
    { left: bounds.minL, top: bounds.minT - GAP - PANEL_H },
  ];

  for (const c of candidates) {
    const pos = clampPanel(c.left, c.top, vw, vh);
    if (!overlapsPanel(pos.left, pos.top, bounds)) return pos;
  }

  return clampPanel(bounds.maxL + GAP, bounds.minT, vw, vh);
}
