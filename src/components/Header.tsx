import { cx, headerBtn } from "../styles";

type Props = {
  nodeCount: number;
  linkCount: number;
  dirty: boolean;
  theme: "light" | "dark";
  onTheme: (theme: "light" | "dark") => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onInfo: () => void;
  onReset: () => void;
};

export default function Header({
  nodeCount,
  linkCount,
  dirty,
  theme,
  onTheme,
  onSave,
  onExport,
  onImport,
  onInfo,
  onReset,
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
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={headerBtn} onClick={onImport}>Import</button>
        <button type="button" className={headerBtn} onClick={onExport}>Export</button>
        <button type="button" className={headerBtn} onClick={onReset}>Sample</button>
        <button
          type="button"
          className={cx(
            headerBtn,
            "border-[var(--omp-teal)] bg-[var(--omp-teal)] font-bold text-white hover:bg-[#0e8f9d]",
            dirty && "shadow-[0_0_0_2px_#fff_inset]",
          )}
          onClick={onSave}
        >
          Save
        </button>
        <button type="button" className={cx(headerBtn, "bg-[var(--header-btn-hover)] font-bold")} onClick={onInfo}>
          Info
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
