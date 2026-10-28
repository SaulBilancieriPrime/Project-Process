export const PERSON_ICONS = [
  "star",
  "circle",
  "diamond",
  "shield",
  "triangle",
  "hex",
  "square",
  "bolt",
  "leaf",
  "plus",
] as const;

export type PersonIcon = (typeof PERSON_ICONS)[number];

const PALETTE = [
  "#ffc107",
  "#26c6da",
  "#ab47bc",
  "#ef5350",
  "#66bb6a",
  "#42a5f5",
  "#ffa726",
  "#ec407a",
  "#7e57c2",
  "#26a69a",
];

/** Same color/icon map as PM Manual committee badges. */
const KNOWN: Record<string, { color: string; icon: PersonIcon }> = {
  "adam.mckinley@primeeng.com": { color: "#ffc107", icon: "star" },
  "ericka.campbell@primeeng.com": { color: "#26c6da", icon: "circle" },
  "jjerrels@primeeng.com": { color: "#ab47bc", icon: "diamond" },
  "jennifer.partain@primeeng.com": { color: "#ef5350", icon: "shield" },
  "juan.contreras@primeeng.com": { color: "#66bb6a", icon: "triangle" },
  "kala.melchiori@primeeng.com": { color: "#42a5f5", icon: "hex" },
  "kalala.melchiori@primeeng.com": { color: "#42a5f5", icon: "hex" },
  "matthew.dick@primeeng.com": { color: "#42a5f5", icon: "hex" },
  "michael.harris@primeeng.com": { color: "#ffa726", icon: "square" },
  "saul.bilancieri@primeeng.com": { color: "#ec407a", icon: "bolt" },
  "tess.seidewitz@primeeng.com": { color: "#7e57c2", icon: "leaf" },
  "walt.mckinley@primeeng.com": { color: "#26a69a", icon: "plus" },
  "josh.marrero@primeeng.com": { color: "#ffa726", icon: "square" },
};

export function personStyle(email: string) {
  const key = email.trim().toLowerCase();
  const known = KNOWN[key];
  if (known) return known;
  const seed = [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return {
    color: PALETTE[seed % PALETTE.length],
    icon: PERSON_ICONS[seed % PERSON_ICONS.length],
  };
}
