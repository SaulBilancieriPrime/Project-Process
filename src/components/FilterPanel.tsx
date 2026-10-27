import { useState, type ReactNode } from "react";
import { LEVEL_COLORS } from "../graph/colors";
import { KIND_LABEL } from "../graph/ops";
import { matchesQuery } from "../graph/visibility";
import { cx, field, sideH2, swatch, swatchOn } from "../styles";
import type { GraphNode, GraphSettings } from "../types";

type Props = {
  nodes: GraphNode[];
  settings: GraphSettings;
  search: string;
  colors: string[];
  hideFiltered: boolean;
  selectedIds: string[];
  onSearch: (v: string) => void;
  onColors: (v: string[]) => void;
  onHideFiltered: (v: boolean) => void;
  onSettings: (patch: Partial<GraphSettings>) => void;
  onFocus: (id: string) => void;
};

type SectionKey = "search" | "filters" | "appearance" | "physics";

const DEFAULT_OPEN: Record<SectionKey, boolean> = {
  search: true,
  filters: true,
  appearance: true,
  physics: true,
};

function toggleColor(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CollapsibleSection({
  sectionId,
  title,
  open,
  onToggle,
  className,
  children,
}: {
  sectionId: SectionKey;
  title: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}) {
  const panelId = `filter-section-${sectionId}`;
  return (
    <section className={cx("border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0", className)}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent px-0 py-1 text-left hover:bg-[var(--hover)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className={cx(sideH2, "mb-0")}>{title}</span>
        <svg
          className={cx("size-3.5 shrink-0 text-[var(--muted)] transition-transform", open && "rotate-180")}
          viewBox="0 0 16 16"
          aria-hidden
        >
          <path d="M4 6 L8 10 L12 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? <div id={panelId} className="mt-1.5">{children}</div> : null}
    </section>
  );
}

export default function FilterPanel({
  nodes,
  settings,
  search,
  colors,
  hideFiltered,
  selectedIds,
  onSearch,
  onColors,
  onHideFiltered,
  onSettings,
  onFocus,
}: Props) {
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN);

  function toggleSection(key: SectionKey) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const hits = search.trim()
    ? nodes.filter((n) => matchesQuery(n, search)).slice(0, 12)
    : nodes.filter((n) => n.level <= 1).slice(0, 8);

  return (
    <aside className="filter-panel min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] px-3 pt-2 pb-3 shadow-[var(--shadow)] backdrop-blur-[12px]">
      <CollapsibleSection
        sectionId="search"
        title="Search"
        open={openSections.search}
        onToggle={() => toggleSection("search")}
        className="pt-1"
      >
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
                className={cx(
                  "w-full cursor-pointer rounded-md border-0 bg-transparent px-1 py-1 text-left font-sans text-xs text-[var(--text)] hover:bg-[var(--hover)]",
                  selectedIds.includes(n.id) && "bg-[var(--hover)]",
                )}
                onClick={() => onFocus(n.id)}
              >
                {n.title}
                <small className="block text-[10px] text-[var(--muted)]">
                  L{n.level} · {KIND_LABEL[n.type]}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="filters"
        title="Filters"
        open={openSections.filters}
        onToggle={() => toggleSection("filters")}
        className="mt-3"
      >
        <div className="text-[10px] font-bold tracking-wider text-[var(--muted)] uppercase">Color</div>
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
        <label className="mt-2 mb-0 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Hide non-matches</span>
          <input type="checkbox" checked={hideFiltered} onChange={(e) => onHideFiltered(e.target.checked)} />
        </label>
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="appearance"
        title="Appearance"
        open={openSections.appearance}
        onToggle={() => toggleSection("appearance")}
        className="mt-3"
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        sectionId="physics"
        title="Physics"
        open={openSections.physics}
        onToggle={() => toggleSection("physics")}
        className="mt-3"
      >
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
      </CollapsibleSection>
    </aside>
  );
}
