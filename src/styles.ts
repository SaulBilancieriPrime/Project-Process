export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const ghostBtn =
  "cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--input)] px-2.5 py-1.5 font-sans text-xs text-[var(--text)] hover:bg-[var(--hover)]";

export const primaryBtn =
  "cursor-pointer rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 font-sans text-xs font-bold text-white";

export const dangerText = "text-red-500";

export const headerBtn =
  "cursor-pointer rounded-lg border border-white/30 bg-[var(--header-btn)] px-2.5 py-1.5 font-sans text-xs text-[var(--omp-on-header)] hover:bg-[var(--header-btn-hover)]";

export const chip =
  "cursor-pointer rounded-full border border-[var(--line)] bg-[var(--card)] px-2 py-[3px] text-[11px] font-bold text-[var(--muted)]";

export const chipOn = "border-[var(--accent)] bg-[var(--hover)] text-[var(--text)]";

export const swatch =
  "block size-[18px] min-h-[18px] min-w-[18px] cursor-pointer rounded-full border-2 border-transparent p-0 hover:brightness-110";

export const swatchOn = "border-white shadow-[0_0_0_1px_#000]";

export const field =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--input)] px-2 py-[7px] font-sans text-[13px] text-[var(--text)]";

export const fieldArea = `${field} min-h-[72px] resize-y`;

export const fieldLabel =
  "mt-2 mb-1 block text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase";

export const menuItem =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-[7px] text-left font-sans text-xs text-[var(--text)] hover:bg-[var(--hover)]";

export const plusMenuBox =
  "min-w-44 rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-1.5 shadow-[var(--shadow)] dark:border-[#6e6c6a] dark:bg-[#353331] dark:shadow-[0_14px_32px_rgba(0,0,0,0.55)]";

export const toolBtn =
  "cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--input)] px-2.5 py-1.5 font-sans text-xs text-[var(--text)] hover:bg-[var(--hover)]";

export const toolOn = "border-[var(--accent)] bg-[var(--accent)] text-white";

export const sideH2 =
  "mt-0 mb-2 text-[11px] tracking-wider text-[var(--accent)] uppercase";

export const filterHint = "mt-2 mb-0 text-[11px] leading-snug text-[var(--muted)]";

export const historyKind = (kind: string) =>
  kind === "add"
    ? "border-l-[3px] border-l-emerald-400"
    : kind === "remove"
      ? "border-l-[3px] border-l-rose-500"
      : "border-l-[3px] border-l-sky-500";

export const ctxBox =
  "fixed z-40 min-w-[198px] rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-1.5 shadow-[var(--shadow)]";

export const editFloat =
  "edit-float fixed z-[86] w-[280px] rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 shadow-[var(--shadow)]";
