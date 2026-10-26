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
    <header className="omp-header">
      <div className="header-left">
        <div className="brand">
          <img className="brand-mark" src="/prime-ae-logo-white.png" alt="PRIME AE" />
        </div>
        <nav className="omp-nav" aria-label="NEXUS">
          <a className="is-current" href="/">Project Process</a>
        </nav>
        <span className="header-pct">
          {nodeCount} nodes · {linkCount} links
        </span>
      </div>
      <div className="top-actions">
        <button type="button" onClick={onImport}>Import</button>
        <button type="button" onClick={onExport}>Export</button>
        <button type="button" onClick={onReset}>Sample</button>
        <button type="button" className={`primary${dirty ? " is-dirty" : ""}`} onClick={onSave}>
          Save
        </button>
        <button type="button" className="info-btn" onClick={onInfo}>Info</button>
      </div>
      <div className="header-identity">
        <label className="theme-switch" title="Light or dark mode">
          <span>Light</span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Dark mode"
            checked={theme === "dark"}
            onChange={(e) => onTheme(e.target.checked ? "dark" : "light")}
          />
          <span className="theme-slider" />
          <span>Dark</span>
        </label>
      </div>
    </header>
  );
}
