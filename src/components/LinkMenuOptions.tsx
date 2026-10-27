import type { ArrowStyle } from "../types";

const LINK_OPTIONS = [
  ["none", "No arrow"],
  ["one", "One arrow"],
  ["both", "Two arrows"],
] as const;

export function ArrowIcon({ kind }: { kind: ArrowStyle }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden>
      {kind !== "none" && kind !== "one" ? (
        <path d="M4 5 L1 5 L2.6 2.6 M1 5 L2.6 7.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : null}
      <path d="M3 5 H19" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {kind !== "none" ? (
        <path d="M18 5 L21 5 L19.4 2.6 M21 5 L19.4 7.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

type Props = {
  onLink: (arrows: ArrowStyle) => void;
};

export default function LinkMenuOptions({ onLink }: Props) {
  return (
    <>
      <div className="mx-1.5 mt-2 mb-1 text-[10px] font-bold tracking-wider text-[var(--muted)] uppercase">Link</div>
      {LINK_OPTIONS.map(([arrows, label]) => (
        <button
          key={arrows}
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-[7px] text-left font-sans text-xs text-[var(--text)] hover:bg-[var(--hover)]"
          onClick={() => onLink(arrows)}
        >
          <ArrowIcon kind={arrows} />
          <span>{label}</span>
        </button>
      ))}
    </>
  );
}
