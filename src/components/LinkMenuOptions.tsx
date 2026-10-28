import type { ArrowStyle } from "../types";
import { cx } from "../styles";

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

function FlipIcon() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden>
      <path d="M2 3 H13.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.2 1.2 L13.5 3 L11.2 4.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14 7 H2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4.8 5.2 L2.5 7 L4.8 8.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  compact?: boolean;
  heading?: string;
  active?: ArrowStyle;
  onLink: (arrows: ArrowStyle) => void;
  onFlip?: () => void;
};

export default function LinkMenuOptions({ compact = false, heading = "Add link", active, onLink, onFlip }: Props) {
  return (
    <>
      <div className={cx("flex items-center gap-1", compact ? "mx-1 mt-1.5 mb-0.5" : "mx-1.5 mt-2 mb-1")}>
        <div className={cx("min-w-0 flex-1 font-bold tracking-wider text-[var(--muted)] uppercase", compact ? "text-[9px]" : "text-[10px]")}>
          {heading}
        </div>
        {onFlip ? (
          <button
            type="button"
            title="Flip direction"
            className="flex h-[18px] cursor-pointer items-center justify-center rounded border-0 bg-transparent px-1 text-[var(--text)] hover:bg-[var(--hover)]"
            onClick={onFlip}
          >
            <FlipIcon />
          </button>
        ) : null}
      </div>
      {compact ? (
        <div className="grid grid-cols-3 gap-0.5">
          {LINK_OPTIONS.map(([arrows, label]) => (
            <button
              key={arrows}
              type="button"
              title={label}
              className={cx(
                "flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border-0 bg-transparent px-0.5 py-1 font-sans text-[8px] font-semibold text-[var(--text)] hover:bg-[var(--hover)]",
                active === arrows && "bg-[var(--hover)]",
              )}
              onClick={() => onLink(arrows)}
            >
              <ArrowIcon kind={arrows} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : (
        LINK_OPTIONS.map(([arrows, label]) => (
          <button
            key={arrows}
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-[7px] text-left font-sans text-xs text-[var(--text)] hover:bg-[var(--hover)]"
            onClick={() => onLink(arrows)}
          >
            <ArrowIcon kind={arrows} />
            <span>{label}</span>
          </button>
        ))
      )}
    </>
  );
}
