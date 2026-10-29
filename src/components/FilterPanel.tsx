import { useMemo, useState, type ReactNode } from "react";
import {
  WORKFLOW_STATUS_META,
  personAssignmentStats,
  statusPercent,
  workflowStats,
  type WorkflowStatus,
} from "../graph/workflowStatus";
import { users } from "../data/users";
import { cx, field, sideH2, toolBtn, toolBtnOn } from "../styles";
import type { ColorBy, GraphNode, GraphSettings } from "../types";
import PersonFace from "./PersonFace";

type Props = {
  nodes: GraphNode[];
  colorBy: ColorBy;
  settings: GraphSettings;
  search: string;
  statusFilters: WorkflowStatus[];
  employeeFilter: string | null;
  onSearch: (v: string) => void;
  onStatusFilters: (v: WorkflowStatus[]) => void;
  onEmployeeFilter: (v: string | null) => void;
  onSettings: (patch: Partial<GraphSettings>) => void;
  onFit: () => void;
  onReorg: () => void;
  onTogglePhysics: () => void;
  onToggleCards: () => void;
  onResetSettings: () => void;
};

function toggleStatus(list: WorkflowStatus[], status: WorkflowStatus) {
  return list.includes(status) ? list.filter((s) => s !== status) : [...list, status];
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="my-1 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
      <span>{label}</span>
      <input
        className="h-1 w-[88px] accent-[var(--accent)]"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function FilterPanel({
  nodes,
  colorBy,
  settings,
  search,
  statusFilters,
  employeeFilter,
  onSearch,
  onStatusFilters,
  onEmployeeFilter,
  onSettings,
  onFit,
  onReorg,
  onTogglePhysics,
  onToggleCards,
  onResetSettings,
}: Props) {
  const stats = useMemo(() => workflowStats(nodes, colorBy), [nodes, colorBy]);
  const [advanced, setAdvanced] = useState(false);

  return (
    <div className="filter-panel space-y-2.5 pt-0.5">
      <div
        className="flex items-center justify-between gap-2 px-0.5"
        aria-label="Left click for info and edit. Right click to add nodes and links."
        title="Left click: info and edit. Right click: add nodes and links."
      >
        <div className="min-w-0 flex-1 text-right">
          <p className="m-0 text-[9px] font-semibold leading-tight text-[var(--text)]">Info / edit</p>
          <p className="m-0 text-[8px] leading-tight text-[var(--muted)]">Left click</p>
        </div>
        <MouseHint />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[9px] font-semibold leading-tight text-[var(--text)]">Add links / nodes</p>
          <p className="m-0 text-[8px] leading-tight text-[var(--muted)]">Right click</p>
        </div>
      </div>
      <input
        className={field}
        type="search"
        placeholder="Search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />

      <section>
        <h2 className={cx(sideH2, "mb-1.5")}>Filter</h2>
        <div className="grid grid-cols-3 gap-0.5">
          {WORKFLOW_STATUS_META.map(({ id, label, filterLabel, pillBg, pillText }) => {
            const count = stats.counts[id];
            const pct = statusPercent(count, stats.total);
            const on = statusFilters.includes(id);
            return (
              <button
                key={id}
                type="button"
                title={`${label} (${pct}%)`}
                className={cx(
                  "flex h-5 min-w-0 cursor-pointer items-center justify-center rounded-full border px-0.5 text-[9px] font-semibold leading-none tracking-tight whitespace-nowrap",
                  on ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]" : "border-transparent",
                )}
                style={{ background: pillBg, color: pillText }}
                aria-pressed={on}
                aria-label={`${label} (${pct}%)`}
                onClick={() => onStatusFilters(toggleStatus(statusFilters, id))}
              >
                {filterLabel} ({pct}%)
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="People">
          <PersonBall
            label="Unassigned"
            active={employeeFilter === "__unassigned__"}
            pct={0}
            onClick={() => onEmployeeFilter(employeeFilter === "__unassigned__" ? null : "__unassigned__")}
          >
            <svg className="size-3.5 text-[var(--muted)]" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor" />
            </svg>
          </PersonBall>
          {users.map((user) => {
            const { total, pct } = personAssignmentStats(nodes, colorBy, user.email);
            const active = employeeFilter === user.email;
            return (
              <PersonBall
                key={user.objectId}
                label={`${user.name} — ${pct}% done (${total} assigned)`}
                active={active}
                pct={pct}
                onClick={() => onEmployeeFilter(active ? null : user.email)}
              >
                <PersonFace name={user.name} email={user.email} />
              </PersonBall>
            );
          })}
        </div>
      </section>

      <section className="border-t border-[var(--line)] pt-2 pb-0.5">
        <h2 className={cx(sideH2, "mb-1.5")}>View</h2>
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">Map</p>
        <div className="grid grid-cols-3 gap-1">
          <button type="button" className={cx(toolBtn, "min-w-0 px-1.5")} title="Fit the graph in the window" onClick={onFit}>
            Fit
          </button>
          <button type="button" className={cx(toolBtn, "min-w-0 px-1.5")} title="Spread nodes with physics" onClick={onReorg}>
            Reorg
          </button>
          <button
            type="button"
            className={cx(settings.physics ? toolBtnOn : toolBtn, "min-w-0 px-1.5")}
            aria-pressed={settings.physics}
            title="Let nodes move and settle"
            onClick={onTogglePhysics}
          >
            Physics
          </button>
        </div>
        <p className="mt-2 mb-1 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">Look</p>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            className={cx(settings.showText ? toolBtnOn : toolBtn, "min-w-0 px-1.5")}
            aria-pressed={settings.showText}
            title="Show or hide node titles"
            onClick={() => onSettings({ showText: !settings.showText })}
          >
            Text
          </button>
          <button
            type="button"
            className={cx(settings.cardInfo ? toolBtnOn : toolBtn, "min-w-0 px-1.5")}
            aria-pressed={Boolean(settings.cardInfo)}
            title="Show info cards when zoomed in"
            onClick={onToggleCards}
          >
            Cards
          </button>
          <button
            type="button"
            className={cx(settings.pulse ? toolBtnOn : toolBtn, "min-w-0 px-1.5")}
            aria-pressed={Boolean(settings.pulse)}
            title="Pulse connections outward from the core node"
            onClick={() => onSettings({ pulse: !settings.pulse })}
          >
            Pulse
          </button>
        </div>
        {settings.pulse ? (
          <SliderRow
            label="Speed"
            min={0.25}
            max={2.2}
            step={0.05}
            value={settings.pulseSpeed ?? 0.7}
            onChange={(pulseSpeed) => onSettings({ pulseSpeed })}
          />
        ) : null}
        <SliderRow
          label="Text"
          min={0.7}
          max={1.8}
          step={0.05}
          value={settings.textScale ?? settings.enlarge ?? 1}
          onChange={(textScale) => onSettings({ textScale })}
        />
        <SliderRow
          label="Card"
          min={0.7}
          max={1.8}
          step={0.05}
          value={settings.cardScale ?? settings.enlarge ?? 1}
          onChange={(cardScale) => onSettings({ cardScale })}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase hover:text-[var(--text)]"
            aria-expanded={advanced}
            onClick={() => setAdvanced((open) => !open)}
          >
            {advanced ? "▾" : "▸"} Advanced
          </button>
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-[10px] text-[var(--muted)] underline-offset-2 hover:text-[var(--text)] hover:underline"
            title="Reset view settings on this device to their defaults"
            onClick={onResetSettings}
          >
            Reset view prefs
          </button>
        </div>
        {advanced && !settings.physics ? (
          <p className="mt-1 mb-0 text-[10px] text-[var(--muted)]">Turn on Physics to tune forces.</p>
        ) : null}
        {advanced && settings.physics ? (
          <div className="mt-1.5">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">Forces</p>
            <label className="my-1 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
              <span>Gravity</span>
              <input
                type="checkbox"
                checked={settings.radial}
                onChange={(e) => onSettings({ radial: e.target.checked })}
              />
            </label>
            <SliderRow
              label="Spread"
              min={-420}
              max={-40}
              step={10}
              value={settings.charge}
              onChange={(charge) => onSettings({ charge })}
            />
            <SliderRow
              label="Spacing"
              min={24}
              max={300}
              step={4}
              value={settings.linkDistance}
              onChange={(linkDistance) => onSettings({ linkDistance })}
            />
            <SliderRow
              label="Padding"
              min={2}
              max={28}
              step={1}
              value={settings.collide}
              onChange={(collide) => onSettings({ collide })}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MouseHint() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden className="shrink-0 text-[var(--text)]">
      <rect x="3" y="1.5" width="16" height="25" rx="8" fill="var(--input)" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11 1.5 V12.2" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3 12.2 H19" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3 9.5 A8 8 0 0 1 11 1.5 V12.2 H3 Z" fill="var(--accent)" opacity="0.88" />
      <path d="M19 9.5 A8 8 0 0 0 11 1.5 V12.2 H19 Z" fill="currentColor" opacity="0.18" />
      <rect x="10.1" y="5.2" width="1.8" height="4.2" rx="0.9" fill="var(--card)" />
    </svg>
  );
}

function PersonBall({
  label,
  active,
  pct,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  pct: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "relative size-8 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 hover:brightness-105",
        active && "ring-1 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--card)]",
      )}
      onClick={onClick}
    >
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full">{children}</span>
      <span className="absolute -right-0.5 -bottom-0.5 min-w-[16px] rounded-full border border-[var(--line)] bg-[var(--card)] px-px text-center text-[7px] font-bold leading-[12px] text-[var(--muted)]">
        {pct}%
      </span>
    </button>
  );
}
