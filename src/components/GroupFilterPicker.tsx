import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { groupStatusColor, groupTitle, UNGROUPED_FILTER } from "../graph/groups";
import { STATUS_COLORS, WORKFLOW_STATUS_META } from "../graph/workflowStatus";
import { placePortaledMenu, portaledMenuListClass, portaledMenuShellClass, type PortaledMenuPos } from "../lib/dropdownPortal";
import { handleOverlayWheel } from "../lib/overlayScroll";
import { cx, field } from "../styles";
import type { ColorBy, GraphGroup, GraphNode } from "../types";

type Props = {
  groups: GraphGroup[];
  nodes: GraphNode[];
  colorBy: ColorBy;
  selected: string[];
  onChange: (next: string[]) => void;
};

function chipTone(color: string) {
  const meta = WORKFLOW_STATUS_META.find((item) => STATUS_COLORS[item.id] === color);
  return { background: meta?.pillBg ?? color, color: meta?.pillText ?? "#1f2937" };
}

function GroupDot({ color, muted }: { color?: string; muted?: boolean }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-full"
      style={{ background: muted ? "var(--input)" : color, boxShadow: muted ? "inset 0 0 0 1px var(--line)" : undefined }}
      aria-hidden
    />
  );
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export default function GroupFilterPicker({ groups, nodes, colorBy, selected, onChange }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<PortaledMenuPos | null>(null);

  const ungroupedCount = useMemo(() => nodes.filter((n) => !n.groupId).length, [nodes]);

  const closed = useMemo(() => {
    if (!selected.length) {
      return { title: "All groups", hint: "Show every node", tone: null as ReturnType<typeof chipTone> | null };
    }
    if (selected.length === 1) {
      const id = selected[0];
      if (id === UNGROUPED_FILTER) {
        return {
          title: "Ungrouped",
          hint: `${ungroupedCount} node${ungroupedCount === 1 ? "" : "s"}`,
          tone: null,
        };
      }
      const group = groups.find((g) => g.id === id);
      if (group) {
        const members = nodes.filter((n) => n.groupId === group.id);
        return {
          title: groupTitle(group.title),
          hint: `${members.length} node${members.length === 1 ? "" : "s"}`,
          tone: chipTone(groupStatusColor(members, colorBy)),
        };
      }
    }
    return {
      title: `${selected.length} groups`,
      hint: "Combined filter",
      tone: null,
    };
  }, [selected, groups, nodes, colorBy, ungroupedCount]);

  const showUngrouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q || "ungrouped".includes(q);
  }, [query]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => groupTitle(group.title).toLowerCase().includes(q));
  }, [groups, query]);

  function placeMenu() {
    if (!rootRef.current) return;
    setMenuPos(placePortaledMenu(rootRef.current));
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onReposition = () => placeMenu();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && menuPos) searchRef.current?.focus();
  }, [open, menuPos]);

  function toggle(id: string) {
    onChange(toggleId(selected, id));
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cx(field, "flex items-center justify-between gap-2 py-1.5 pr-2 text-left")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Filter by group"
        onClick={() => {
          if (open) close();
          else {
            placeMenu();
            setOpen(true);
          }
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <GroupDot color={closed.tone?.background} muted={!closed.tone} />
          <span className="min-w-0">
            <span className={cx("block truncate text-[13px] font-semibold", selected.length ? "text-[var(--text)]" : "text-[var(--muted)]")}>
              {closed.title}
            </span>
            <span className="block truncate text-[11px] text-[var(--muted)]">{closed.hint}</span>
          </span>
        </span>
        <svg
          className={cx("size-3.5 shrink-0 text-[var(--muted)] transition-transform", open && "rotate-180")}
          viewBox="0 0 12 12"
          aria-hidden
        >
          <path d="M2.2 4.2L6 8l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            className={portaledMenuShellClass}
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width, maxHeight: menuPos.maxHeight }}
            role="listbox"
            aria-label="Groups"
            aria-multiselectable="true"
            onWheel={handleOverlayWheel}
          >
            <input
              ref={searchRef}
              className={cx(field, "shrink-0 rounded-none border-0 border-b")}
              placeholder="Search groups"
              aria-label="Search groups"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className={portaledMenuListClass}>
              {selected.length ? (
                <li className="mb-0.5 border-b border-[var(--line)] pb-0.5">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-left text-[11px] font-semibold text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    onClick={() => onChange([])}
                  >
                    Clear group filter
                  </button>
                </li>
              ) : null}
              {showUngrouped ? (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected.includes(UNGROUPED_FILTER)}
                    className={cx(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-left hover:bg-[var(--hover)]",
                      selected.includes(UNGROUPED_FILTER) && "ring-1 ring-inset ring-[var(--accent)]",
                    )}
                    onClick={() => toggle(UNGROUPED_FILTER)}
                  >
                    <GroupDot muted />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--text)]">Ungrouped</span>
                      <span className="block truncate text-[10px] text-[var(--muted)]">
                        {ungroupedCount} node{ungroupedCount === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                </li>
              ) : null}
              {matches.map((group) => {
                const members = nodes.filter((n) => n.groupId === group.id);
                const tone = chipTone(groupStatusColor(members, colorBy));
                const active = selected.includes(group.id);
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cx(
                        "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-left hover:bg-[var(--hover)]",
                        active && "ring-1 ring-inset ring-[var(--accent)]",
                      )}
                      onClick={() => toggle(group.id)}
                    >
                      <GroupDot color={tone.background} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-[var(--text)]">{groupTitle(group.title)}</span>
                        <span className="block truncate text-[10px] text-[var(--muted)]">
                          {members.length} node{members.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!showUngrouped && !matches.length ? (
                <li className="px-2 py-2 text-[11px] text-[var(--muted)]">No matching groups</li>
              ) : null}
            </ul>
          </div>,
          document.body,
        ) : null}
    </div>
  );
}
