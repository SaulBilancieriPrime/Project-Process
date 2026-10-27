import type { ColorBy, GraphNode, NodeKind } from "../types";

export const LEVEL_COLORS = ["#f43f5e", "#f59e0b", "#34d399"];

export const SIZE_PRESETS = [
  { value: 0.5, label: "xs", dot: 8 },
  { value: 1.5, label: "s", dot: 11 },
  { value: 2.5, label: "m", dot: 14 },
  { value: 3.5, label: "l", dot: 18 },
  { value: 4.5, label: "xl", dot: 22 },
  { value: 5.5, label: "2xl", dot: 26 },
  { value: 6.5, label: "3xl", dot: 32 },
] as const;

export const TYPE_COLORS: Record<NodeKind, string> = {
  concept: "#7dd3fc",
  category: "#e67e22",
  task: "#34d399",
  info: "#c4b5fd",
};

export function sizeForLevel(level: number) {
  return Math.max(0.62, 1.72 - level * 0.2);
}

export function normalizeHex(hex: string) {
  const raw = hex.trim().toLowerCase().replace("#", "");
  if (!raw) return "#000000";
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return `#${full}`;
}

export function nodeColor(node: GraphNode, colorBy: ColorBy) {
  if (colorBy === "custom" && node.color) return node.color;
  if (colorBy === "type") return node.color || TYPE_COLORS[node.type];
  return (
    node.color || LEVEL_COLORS[Math.min(node.level, LEVEL_COLORS.length - 1)]
  );
}

export function hexToRgb(hex: string) {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function graphTheme(theme: "light" | "dark") {
  if (theme === "light") {
    return {
      bg: "#f4f6f8",
      link: "rgba(27, 58, 107, 0.28)",
      linkHot: "rgba(27, 58, 107, 0.72)",
      linkCross: "rgba(138, 110, 40, 0.38)",
      linkCrossHot: "rgba(160, 110, 20, 0.7)",
      linkDim: "rgba(27, 58, 107, 0.07)",
      label: "rgba(27, 27, 27, 0.92)",
      labelDim: "rgba(27, 27, 27, 0.32)",
      card: "#ffffff",
      cardText: "#1b1b1b",
      cardMuted: "rgba(91, 98, 112, 0.92)",
      ring: "#1b3a6b",
      connectRing: "#8a6d00",
      badge: "#ffffff",
      badgeText: "#1b1b1b",
      pin: "rgba(27, 58, 107, 0.9)",
    };
  }
  return {
    bg: "#1a1a1a",
    link: "rgba(214, 226, 248, 0.92)",
    linkHot: "rgba(240, 246, 255, 1)",
    linkCross: "rgba(246, 210, 128, 0.92)",
    linkCrossHot: "rgba(255, 228, 164, 1)",
    linkDim: "rgba(200, 210, 228, 0.22)",
    label: "rgba(236, 236, 236, 0.92)",
    labelDim: "rgba(220, 220, 220, 0.35)",
    card: "#242424",
    cardText: "#f2f2f2",
    cardMuted: "rgba(210, 210, 210, 0.78)",
    ring: "#f5f5f5",
    connectRing: "#f3e8c8",
    badge: "#2c2c2c",
    badgeText: "#fff",
    pin: "rgba(243, 243, 243, 0.85)",
  };
}
