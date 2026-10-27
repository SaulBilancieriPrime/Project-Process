import { LEVEL_COLORS } from "../graph/colors";
import type { HistoryAction } from "../graph/history";
import { KIND_LABEL } from "../graph/ops";
import { matchesQuery } from "../graph/visibility";
import type { ColorBy, GraphNode, GraphSettings, NodeKind } from "../types";
import { NODE_KINDS } from "../types";
import { chip, chipOn, cx, field, filterHint, ghostBtn, historyKind, sideH2, swatch, swatchOn, toolOn } from "../styles";
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
      <section className="mb-4">
        <h2 className={sideH2}>Search</h2>
        <input
          className={field}
          type="search"
          placeholder="Find a concept…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <ul className="mt-2 mb-0 list-none p-0">
          {hits.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={cx("w-full cursor-pointer rounded-md border-0 bg-transparent px-1 py-1 text-left font-sans text-xs text-[var(--text)] hover:bg-[var(--hover)]", selectedIds.includes(n.id) && "bg-[var(--hover)]")}
                onClick={() => onFocus(n.id)}
              >
                {n.title}
                <small className="block text-[10px] text-[var(--muted)]">L{n.level} · {KIND_LABEL[n.type]}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <h2 className={sideH2}>Filters</h2>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: maxLevel + 1 }, (_, level) => (
            <button
              key={level}
              type="button"
              className={cx(chip, levels.includes(level) && chipOn)}
              onClick={() => onLevels(toggleNum(levels, level))}
            >
              L{level}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {NODE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={cx(chip, types.includes(kind) && chipOn)}
              onClick={() => onTypes(toggleType(types, kind))}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <div className="mt-2.5 text-[10px] font-bold tracking-wider text-[var(--muted)] uppercase">Color</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {LEVEL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cx(swatch, colors.includes(c) && swatchOn)}
              style={{ background: c }}
              title="Filter by this color"
              aria-label="Filter by color"
              aria-pressed={colors.includes(c)}
              onClick={() => onColors(toggleColor(colors, c))}
            />
          ))}
        </div>
        <label className="my-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Hide non-matches</span>
          <input type="checkbox" checked={hideFiltered} onChange={(e) => onHideFiltered(e.target.checked)} />
        </label>
      </section>

      <section className="mb-4">
        <h2 className={sideH2}>Grouping</h2>
        <div className="flex flex-wrap gap-1.5">
          {(["level", "type", "custom"] as ColorBy[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cx(chip, settings.colorBy === mode && chipOn)}
              onClick={() => onSettings({ colorBy: mode })}
            >
              {mode === "level" ? "By level" : mode === "type" ? "By type" : "Custom"}
            </button>
          ))}
        </div>
        <p className={filterHint}>Level palette when coloring by level. Use Color above to narrow the map.</p>
      </section>

      <section className="mb-4">
        <h2 className={sideH2}>Appearance</h2>
        <label className="my-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Enlarge</span>
          <input
            className="w-[120px]"
            type="range"
            min={0.7}
            max={1.8}
            step={0.05}
            value={settings.enlarge ?? 1}
            onChange={(e) => onSettings({ enlarge: Number(e.target.value) })}
          />
        </label>
      </section>

      <section className="mb-4">
        <h2 className={sideH2}>Physics</h2>
        <label className="my-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Force layout</span>
          <input
            type="checkbox"
            checked={settings.physics}
            onChange={(e) => onSettings({ physics: e.target.checked })}
          />
        </label>
        <label className="my-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Radial branch</span>
          <input
            type="checkbox"
            checked={settings.radial}
            onChange={(e) => onSettings({ radial: e.target.checked })}
          />
        </label>
        <label className="my-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Charge</span>
          <input
            className="w-[120px]"
            type="range"
            min={-420}
            max={-40}
            value={settings.charge}
            onChange={(e) => onSettings({ charge: Number(e.target.value) })}
          />
        </label>
        <label className="my-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Link distance</span>
          <input
            className="w-[120px]"
            type="range"
            min={24}
            max={300}
            value={settings.linkDistance}
            onChange={(e) => onSettings({ linkDistance: Number(e.target.value) })}
          />
        </label>
        <label className="my-2 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Collision</span>
          <input
            className="w-[120px]"
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
      <section className="mb-4">
        <h2 className={sideH2}>Unsaved actions</h2>
        <p className={filterHint}>No actions since the last confirmed save. Edits you make will list here until you Save.</p>
      </section>
    );
  }
  const items = [...history].reverse();
  return (
    <section className="mb-4">
      <h2 className={sideH2}>Unsaved actions</h2>
      <p className={filterHint}>
        {history.length} action{history.length === 1 ? "" : "s"} since last save. Undo restores the map to just before that action and drops everything after it.
      </p>
      <ul className="mt-2.5 mb-0 flex list-none flex-col gap-2 p-0">
        {items.map((action) => (
          <li key={action.id} className={cx("rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-2", historyKind(action.kind))}>
            <div className="flex items-start justify-between gap-2">
              <strong className="block text-xs">{action.label}</strong>
              <button type="button" className={cx(ghostBtn, "shrink-0 px-2 py-[3px] text-[11px]")} onClick={() => onUndo(action.id)}>
                Undo
              </button>
            </div>
            <ul className="mt-1.5 mb-0 list-none p-0">
              {action.changes.map((item) => (
                <li key={item.id} className="py-[3px] text-[11px] leading-snug text-[var(--text)]">
                  {item.title}
                  {item.detail ? <span className="text-[var(--muted)]"> · {item.detail}</span> : null}
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
    <aside className="sidebar absolute top-0 right-0 z-[8] flex h-full w-[296px] flex-col overflow-hidden border-l border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_94%,transparent)] backdrop-blur-[12px] max-[820px]:top-auto max-[820px]:bottom-0 max-[820px]:h-[42%] max-[820px]:w-full max-[820px]:border-t max-[820px]:border-l-0">
      <div className="flex shrink-0 gap-1 px-2.5 pt-2.5" role="tablist" aria-label="Side panel">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "filter"}
          className={cx("flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--input)] px-1 py-1.5 font-sans text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase", tab === "filter" && toolOn)}
          onClick={() => onTab("filter")}
        >
          Filter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={cx("flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--input)] px-1 py-1.5 font-sans text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase", tab === "history" && toolOn)}
          onClick={() => onTab("history")}
        >
          History
          {history.length > 0 && <span className="h-4 min-w-4 rounded-full bg-white/20 px-1 text-[10px] leading-4">{history.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "help"}
          className={cx("flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--input)] px-1 py-1.5 font-sans text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase", tab === "help" && toolOn)}
          onClick={() => onTab("help")}
        >
          Help
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 pt-3 pb-6" role="tabpanel">
        {tab === "filter" && <FilterTab {...filterProps} />}
        {tab === "history" && <HistoryTab history={history} onUndo={onUndo} />}
        {tab === "help" && <HelpTab />}
      </div>
    </aside>
  );
}
