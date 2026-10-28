import { cx, headerBtn } from "../styles";

type Props = {
  nodeCount: number;
  linkCount: number;
  liveStatus: "offline" | "live" | "syncing";
  historyCount: number;
  historyOpen: boolean;
  infoOpen: boolean;
  theme: "light" | "dark";
  onTheme: (theme: "light" | "dark") => void;
  onExport: () => void;
  onImport: () => void;
  onHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInfo: () => void;
};

export default function Header({
  nodeCount,
  linkCount,
  liveStatus,
  historyCount,
  historyOpen,
  infoOpen,
  theme,
  onTheme,
  onExport,
  onImport,
  onHistory,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onInfo,
}: Props) {
  return (
    <header className="omp-header relative z-20 flex min-h-[52px] items-center justify-between gap-3.5 bg-[var(--omp-header)] px-4 py-1.5 text-[var(--omp-on-header)] max-[820px]:flex-wrap">
      <div className="flex min-w-0 items-center gap-4">
        <div className="inline-flex items-center whitespace-nowrap">
          <img className="block h-5 w-auto" src="/prime-ae-logo-white.png" alt="PRIME AE" />
        </div>
        <nav className="flex flex-wrap items-center gap-2.5" aria-label="NEXUS">
          <a className="whitespace-nowrap text-[0.8rem] font-bold tracking-wide text-[var(--omp-on-header)] no-underline" href="/">
            Project Process
          </a>
        </nav>
        <span className="whitespace-nowrap text-[0.8rem] font-bold tracking-wide text-[var(--omp-on-header)]">
          {nodeCount} nodes · {linkCount} links
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className={headerBtn} onClick={onImport}>Import</button>
        <button type="button" className={headerBtn} onClick={onExport}>Export</button>
        <button
          type="button"
          className={cx(headerBtn, "inline-flex items-center gap-1.5", historyOpen && "bg-[var(--header-btn-hover)]")}
          aria-pressed={historyOpen}
          onClick={onHistory}
        >
          History
          {historyCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] leading-none font-bold">
              {historyCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={cx(headerBtn, "inline-flex size-9 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-40")}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M5.5 3.5 L2.5 6.5 L5.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.5 6.5 H9.2 A3.8 3.8 0 0 1 9.2 14.1 H7.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className={cx(headerBtn, "inline-flex size-9 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-40")}
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M10.5 3.5 L13.5 6.5 L10.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.5 6.5 H6.8 A3.8 3.8 0 0 0 6.8 14.1 H8.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <span
          className={cx(
            headerBtn,
            "pointer-events-none cursor-default font-bold",
            liveStatus === "live" && "border-[var(--omp-teal)] bg-[var(--omp-teal)] text-white",
            liveStatus === "syncing" && "border-[var(--omp-teal)] bg-[#0e8f9d] text-white",
            liveStatus === "offline" && "opacity-80",
          )}
          title={liveStatus === "offline" ? "Azure SQL unavailable — edits stay local" : "Shared map writes to Azure SQL as you edit"}
        >
          {liveStatus === "live" ? "Live" : liveStatus === "syncing" ? "Syncing" : "Offline"}
        </span>
        <button
          type="button"
          className={cx(headerBtn, "inline-flex size-9 items-center justify-center p-0", infoOpen && "bg-[var(--header-btn-hover)]")}
          aria-label="Information"
          aria-pressed={infoOpen}
          title="Information"
          onClick={onInfo}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 7.1 v4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="8" cy="5.15" r="0.85" fill="currentColor" />
          </svg>
        </button>
        <label className="theme-switch inline-flex select-none items-center gap-1.5 text-[11px] font-bold tracking-wide text-[var(--omp-on-header)]" title="Light or dark mode">
          <span>Light</span>
          <input
            className="absolute h-0 w-0 opacity-0"
            type="checkbox"
            role="switch"
            aria-label="Dark mode"
            checked={theme === "dark"}
            onChange={(e) => onTheme(e.target.checked ? "dark" : "light")}
          />
          <span className="theme-slider relative inline-block h-5 w-9 cursor-pointer rounded-full border border-white/40 bg-white/30" />
          <span>Dark</span>
        </label>
      </div>
    </header>
  );
}
