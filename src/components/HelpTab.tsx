import type { ReactNode } from "react";
import { cx, sideH2 } from "../styles";

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--input)] text-[var(--accent)]">
      {children}
    </span>
  );
}

function Card({ icon, title, body }: { icon: ReactNode; title: string; body: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--input)_55%,transparent)] px-2 py-2">
      <IconWrap>{icon}</IconWrap>
      <div className="min-w-0">
        <p className="m-0 text-[11px] font-semibold leading-tight text-[var(--text)]">{title}</p>
        <p className="mt-0.5 mb-0 text-[10px] leading-snug text-[var(--muted)]">{body}</p>
      </div>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--line)] bg-[var(--input)] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[var(--text)]">
      {children}
    </kbd>
  );
}

function IcoZoom() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 L13.2 13.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IcoPan() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M8 2.4 V13.6 M2.4 8 H13.6 M4.2 4.2 L2.4 8 L4.2 11.8 M11.8 4.2 L13.6 8 L11.8 11.8 M4.2 4.2 L8 2.4 L11.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcoCompass() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 3.6 L10.2 9.2 H5.8 Z" fill="currentColor" />
    </svg>
  );
}

function IcoSelect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.2 1.8" />
    </svg>
  );
}

function IcoEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 13 L3.8 10.2 L11.4 2.6 C11.9 2.1 12.7 2.1 13.2 2.6 L13.4 2.8 C13.9 3.3 13.9 4.1 13.4 4.6 L5.8 12.2 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IcoAdd() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5 V11 M5 8 H11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IcoLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="8" r="1.6" fill="currentColor" />
      <circle cx="12" cy="8" r="1.6" fill="currentColor" />
      <path d="M5.8 8 H10.2 M10.2 8 L8.8 6.6 M10.2 8 L8.8 9.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IcoFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 4 H13 L9.2 8.6 V12.2 L6.8 13.2 V8.6 Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IcoPeople() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="5.6" r="2.3" fill="currentColor" />
      <path d="M3.4 13 C3.4 10.4 5.4 9.2 8 9.2 S12.6 10.4 12.6 13" fill="currentColor" />
    </svg>
  );
}

function IcoStatus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="3.4" cy="8" r="2" fill="#e24b4b" />
      <circle cx="8" cy="8" r="2" fill="#e29b2d" />
      <circle cx="12.6" cy="8" r="2" fill="#3f9a5c" />
    </svg>
  );
}

function IcoView() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 5 H13 M3 8 H10.5 M3 11 H8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="13" cy="8" r="1.3" fill="currentColor" />
      <circle cx="10.4" cy="11" r="1.3" fill="currentColor" />
    </svg>
  );
}

function IcoLive() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="2.1" fill="currentColor" />
      <circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.28" />
    </svg>
  );
}

function IcoHistory() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M4.2 8 A3.8 3.8 0 1 0 6.2 4.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.2 3.6 V5.8 H5.4 M8 6.2 V8.4 L9.8 9.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MouseGuide() {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--input)_55%,transparent)] px-3 py-2.5">
      <svg width="28" height="36" viewBox="0 0 22 28" aria-hidden className="shrink-0 text-[var(--text)]">
        <rect x="3" y="1.5" width="16" height="25" rx="8" fill="var(--input)" stroke="currentColor" strokeWidth="1.2" />
        <path d="M11 1.5 V12.2" stroke="currentColor" strokeWidth="1.1" />
        <path d="M3 12.2 H19" stroke="currentColor" strokeWidth="1.1" />
        <path d="M3 9.5 A8 8 0 0 1 11 1.5 V12.2 H3 Z" fill="var(--accent)" opacity="0.88" />
        <path d="M19 9.5 A8 8 0 0 0 11 1.5 V12.2 H19 Z" fill="currentColor" opacity="0.18" />
        <rect x="10.1" y="5.2" width="1.8" height="4.2" rx="0.9" fill="var(--card)" />
      </svg>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        <div>
          <p className="m-0 text-[11px] font-semibold text-[var(--text)]">Left click</p>
          <p className="m-0 text-[10px] leading-snug text-[var(--muted)]">Select, edit, and box-select</p>
        </div>
        <div>
          <p className="m-0 text-[11px] font-semibold text-[var(--text)]">Right click</p>
          <p className="m-0 text-[10px] leading-snug text-[var(--muted)]">Add nodes, links, or change a connection</p>
        </div>
      </div>
    </div>
  );
}

export default function HelpTab() {
  return (
    <div className="space-y-4 pb-2">
      <div className="rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--input))] px-3 py-2.5">
        <p className="m-0 text-[12px] font-semibold text-[var(--text)]">Shared live map</p>
        <p className="mt-1 mb-0 text-[11px] leading-snug text-[var(--muted)]">
          Edits write to Azure SQL as you go. There is no Save — the whole team sees status, people, and structure live.
        </p>
      </div>

      <section>
        <h3 className={cx(sideH2, "mb-1.5")}>Clicks</h3>
        <MouseGuide />
      </section>

      <section>
        <h3 className={cx(sideH2, "mb-1.5")}>Move around</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Card icon={<IcoZoom />} title="Zoom" body="Scroll on the canvas." />
          <Card icon={<IcoPan />} title="Pan" body={<>Hold <Key>Space</Key> or <Key>Alt</Key> and drag.</>} />
          <Card icon={<IcoCompass />} title="Rotate" body="Hold the top-right compass to enlarge it, then drag around to spin your view. Release to keep that angle — it stays on this device only." />
          <Card icon={<IcoSelect />} title="Box select" body="Drag empty space. Shift adds to the selection." />
        </div>
      </section>

      <section>
        <h3 className={cx(sideH2, "mb-1.5")}>Build the map</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Card icon={<IcoAdd />} title="Add a node" body={<>Hover or click <Key>+</Key>, or press <Key>N</Key>.</>} />
          <Card icon={<IcoLink />} title="Add a link" body="From + or a node menu, pick an arrow type, then click two nodes." />
          <Card icon={<IcoEdit />} title="Edit a node" body="Click a ball — the left panel opens. Tint follows status." />
          <Card icon={<IcoLink />} title="Edit a link" body="Right-click a connection to flip, change arrows, insert, or delete." />
        </div>
      </section>

      <section>
        <h3 className={cx(sideH2, "mb-1.5")}>Filter and look</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Card icon={<IcoFilter />} title="Search & filter" body="Search titles, or tap status pills and people in the left rail." />
          <Card icon={<IcoStatus />} title="Status" body="Incomplete, in progress, and done — shown as the ring on each ball." />
          <Card icon={<IcoPeople />} title="Assign people" body="Pick a person on a node. Their photo sits on the ball." />
          <Card icon={<IcoView />} title="View" body="Fit, Reorg, Physics, Text, Cards, and Pulse live under View. Those look and force choices stay on this device — they do not go into History or the shared map." />
        </div>
      </section>

      <section>
        <h3 className={cx(sideH2, "mb-1.5")}>Together</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <Card icon={<IcoLive />} title="Live writes" body="Every node, link, status, and assignee change commits immediately." />
          <Card icon={<IcoHistory />} title="Undo" body={<>Header arrows, or <Key>Ctrl/Cmd+Z</Key> / <Key>Y</Key>. History is local; writes still sync.</>} />
        </div>
      </section>

      <section>
        <h3 className={cx(sideH2, "mb-1.5")}>Keys</h3>
        <div className="space-y-1.5 rounded-[10px] border border-[var(--line)] px-2.5 py-2">
          <p className="m-0 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
            <span>Cancel / clear</span>
            <Key>Esc</Key>
          </p>
          <p className="m-0 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
            <span>Delete selection</span>
            <Key>Delete</Key>
          </p>
          <p className="m-0 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
            <span>Add node</span>
            <Key>N</Key>
          </p>
          <p className="m-0 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
            <span>Undo / redo</span>
            <span className="flex gap-1">
              <Key>Ctrl/Cmd+Z</Key>
              <Key>Ctrl/Cmd+Y</Key>
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
