import { LEVEL_COLORS } from "../graph/colors";
import type { HistoryAction } from "../graph/history";
import { KIND_LABEL } from "../graph/ops";
import { matchesQuery } from "../graph/visibility";
import type { ColorBy, GraphNode, GraphSettings, NodeKind } from "../types";
import { NODE_KINDS } from "../types";
import HelpTab from "./HelpTab";

export type SidebarTab = "filter" | "history" | "help";

type Props = {
  open: boolean;
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  nodes: GraphNode[];
  settings: GraphSettings;
  search: string;
  levels: number[];
  types: NodeKind[];
  colors: string[];
  hideFiltered: boolean;
  selectedIds: string[];
  history: HistoryAction[];
  onUndo: (id: string) => void;
  onSearch: (v: string) => void;
  onLevels: (v: number[]) => void;
  onTypes: (v: NodeKind[]) => void;
  onColors: (v: string[]) => void;
  onHideFiltered: (v: boolean) => void;
  onSettings: (patch: Partial<GraphSettings>) => void;
  onFocus: (id: string) => void;
};

function toggleNum(list: number[], value: number) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function toggleType(list: NodeKind[], value: NodeKind) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function toggleColor(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterTab({
  nodes,
  settings,
  search,
  levels,
  types,
  colors,
  hideFiltered,
  selectedIds,
  onSearch,
  onLevels,
  onTypes,
  onColors,
  onHideFiltered,
  onSettings,
  onFocus,
}: Omit<Props, "open" | "tab" | "onTab" | "history" | "onUndo">) {
  const maxLevel = nodes.reduce((m, n) => Math.max(m, n.level), 0);
  const hits = search.trim()
    ? nodes.filter((n) => matchesQuery(n, search)).slice(0, 12)
    : nodes.filter((n) => n.level <= 1).slice(0, 8);

  return (
    <>
      <section>
        <h2>Search</h2>
        <input
          type="search"
          placeholder="Find a concept…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <ul className="result-list">
          {hits.map((n) => (
            <li key={n.id}>
              <button type="button" className={selectedIds.includes(n.id) ? "on" : ""} onClick={() => onFocus(n.id)}>
                {n.title}
                <small>L{n.level} · {KIND_LABEL[n.type]}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Filters</h2>
        <div className="chip-row">
          {Array.from({ length: maxLevel + 1 }, (_, level) => (
            <button
              key={level}
              type="button"
              className={`chip${levels.includes(level) ? " on" : ""}`}
              onClick={() => onLevels(toggleNum(levels, level))}
            >
              L{level}
            </button>
          ))}
        </div>
        <div className="chip-row" style={{ marginTop: 8 }}>
          {NODE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`chip${types.includes(kind) ? " on" : ""}`}
              onClick={() => onTypes(toggleType(types, kind))}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <div className="filter-sublabel">Color</div>
        <div className="swatch-row" style={{ marginTop: 6 }}>
          {LEVEL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${colors.includes(c) ? " on" : ""}`}
              style={{ background: c }}
              title="Filter by this color"
              aria-label="Filter by color"
              aria-pressed={colors.includes(c)}
              onClick={() => onColors(toggleColor(colors, c))}
            />
          ))}
        </div>
        <label className="filter-row">
          <span>Hide non-matches</span>
          <input type="checkbox" checked={hideFiltered} onChange={(e) => onHideFiltered(e.target.checked)} />
        </label>
      </section>

      <section>
        <h2>Grouping</h2>
        <div className="chip-row">
          {(["level", "type", "custom"] as ColorBy[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`chip${settings.colorBy === mode ? " on" : ""}`}
              onClick={() => onSettings({ colorBy: mode })}
            >
              {mode === "level" ? "By level" : mode === "type" ? "By type" : "Custom"}
            </button>
          ))}
        </div>
        <p className="filter-hint">Level palette when coloring by level. Use Color above to narrow the map.</p>
      </section>

      <section>
        <h2>Appearance</h2>
        <label className="filter-row">
          <span>Enlarge</span>
          <input
            type="range"
            min={0.7}
            max={1.8}
            step={0.05}
            value={settings.enlarge ?? 1}
            onChange={(e) => onSettings({ enlarge: Number(e.target.value) })}
          />
        </label>
      </section>

      <section>
        <h2>Physics</h2>
        <label className="filter-row">
          <span>Force layout</span>
          <input
            type="checkbox"
            checked={settings.physics}
            onChange={(e) => onSettings({ physics: e.target.checked })}
          />
        </label>
        <label className="filter-row">
          <span>Radial branch</span>
          <input
            type="checkbox"
            checked={settings.radial}
            onChange={(e) => onSettings({ radial: e.target.checked })}
          />
        </label>
        <label className="filter-row">
          <span>Charge</span>
          <input
            type="range"
            min={-420}
            max={-40}
            value={settings.charge}
            onChange={(e) => onSettings({ charge: Number(e.target.value) })}
          />
        </label>
        <label className="filter-row">
          <span>Link distance</span>
          <input
            type="range"
            min={24}
            max={300}
            value={settings.linkDistance}
            onChange={(e) => onSettings({ linkDistance: Number(e.target.value) })}
          />
        </label>
        <label className="filter-row">
          <span>Collision</span>
          <input
            type="range"
            min={2}
            max={28}
            value={settings.collide}
            onChange={(e) => onSettings({ collide: Number(e.target.value) })}
          />
        </label>
      </section>
    </>
  );
}

function HistoryTab({ history, onUndo }: { history: HistoryAction[]; onUndo: (id: string) => void }) {
  if (!history.length) {
    return (
      <section>
        <h2>Unsaved actions</h2>
        <p className="filter-hint">No actions since the last confirmed save. Edits you make will list here until you Save.</p>
      </section>
    );
  }
  const items = [...history].reverse();
  return (
    <section>
      <h2>Unsaved actions</h2>
      <p className="filter-hint">
        {history.length} action{history.length === 1 ? "" : "s"} since last save. Undo restores the map to just before that action and drops everything after it.
      </p>
      <ul className="history-list">
        {items.map((action) => (
          <li key={action.id} className={`history-group is-${action.kind}`}>
            <div className="history-group-head">
              <strong>{action.label}</strong>
              <button type="button" className="ghost history-undo" onClick={() => onUndo(action.id)}>
                Undo
              </button>
            </div>
            <ul className="history-sub">
              {action.changes.map((item) => (
                <li key={item.id}>
                  {item.title}
                  {item.detail ? <span> · {item.detail}</span> : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Sidebar({
  open,
  tab,
  onTab,
  history,
  onUndo,
  ...filterProps
}: Props) {
  if (!open) return null;
  return (
    <aside className="sidebar">
      <div className="side-tabs" role="tablist" aria-label="Side panel">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "filter"}
          className={tab === "filter" ? "is-on" : ""}
          onClick={() => onTab("filter")}
        >
          Filter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={tab === "history" ? "is-on" : ""}
          onClick={() => onTab("history")}
        >
          History
          {history.length > 0 && <span className="tab-count">{history.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "help"}
          className={tab === "help" ? "is-on" : ""}
          onClick={() => onTab("help")}
        >
          Help
        </button>
      </div>
      <div className="side-tab-body" role="tabpanel">
        {tab === "filter" && <FilterTab {...filterProps} />}
        {tab === "history" && <HistoryTab history={history} onUndo={onUndo} />}
        {tab === "help" && <HelpTab />}
      </div>
    </aside>
  );
}
