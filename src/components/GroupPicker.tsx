import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { groupStatusColor, groupTitle } from "../graph/groups";
import { STATUS_COLORS, WORKFLOW_STATUS_META } from "../graph/workflowStatus";
import { placePortaledMenu, portaledMenuListClass, portaledMenuShellClass, type PortaledMenuPos } from "../lib/dropdownPortal";
import { handleOverlayWheel } from "../lib/overlayScroll";
import { cx, field, primaryBtn } from "../styles";
import type { ColorBy, GraphGroup, GraphNode } from "../types";

type Props = {
  groupId: string | null;
  groups: GraphGroup[];
  nodes: GraphNode[];
  colorBy: ColorBy;
  mixed?: boolean;
  emptyLabel?: string;
  onChange: (groupId: string | null) => void;
  onCreate: (title: string) => void;
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

export default function GroupPicker({
  groupId,
  groups,
  nodes,
  colorBy,
  mixed = false,
  emptyLabel = "None",
  onChange,
  onCreate,
}: Props) {
  const current = !mixed ? groups.find((group) => group.id === groupId) ?? null : null;
  const currentMembers = current ? nodes.filter((n) => n.groupId === current.id) : [];
  const currentTone = current ? chipTone(groupStatusColor(currentMembers, colorBy)) : null;
  const closedTitle = mixed ? emptyLabel : current ? groupTitle(current.title) : "None";
  const closedHint = mixed
    ? "Groups differ"
    : current
      ? `${currentMembers.length} node${currentMembers.length === 1 ? "" : "s"}`
      : "Not in a group";
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [menuPos, setMenuPos] = useState<PortaledMenuPos | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => groupTitle(group.title).toLowerCase().includes(q));
  }, [groups, query]);

  function placeMenu() {
    if (!rootRef.current) return;
    setMenuPos(placePortaledMenu(rootRef.current, 320));
  }

  function close() {
    setOpen(false);
    setQuery("");
    setDraft("");
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

  function assign(id: string | null) {
    onChange(id);
    close();
  }

  function createFrom(title: string) {
    const next = title.trim();
    if (!next) return;
    const existing = groups.find((group) => groupTitle(group.title).toLowerCase() === next.toLowerCase());
    if (existing) {
      assign(existing.id);
      return;
    }
    onCreate(next);
    close();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cx(field, "flex items-center justify-between gap-2 py-1.5 pr-2 text-left")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Group"
        onClick={() => {
          if (open) close();
          else {
            placeMenu();
            setOpen(true);
          }
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <GroupDot color={currentTone?.background} muted={!current} />
          <span className="min-w-0">
            <span className={cx("block truncate text-[13px] font-semibold", current ? "text-[var(--text)]" : "text-[var(--muted)]")}>
              {closedTitle}
            </span>
            <span className="block truncate text-[11px] text-[var(--muted)]">{closedHint}</span>
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
            onWheel={handleOverlayWheel}
          >
            <input
              ref={searchRef}
              className={cx(field, "shrink-0 rounded-none border-0 border-b")}
              placeholder="Search groups"
              aria-label="Search groups"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (matches[0]) assign(matches[0].id);
              }}
            />
            <ul className={cx(portaledMenuListClass, "max-h-36")}>
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!mixed && !current}
                  className={cx(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-left hover:bg-[var(--hover)]",
                    !mixed && !current && "ring-1 ring-inset ring-[var(--accent)]",
                  )}
                  onClick={() => assign(null)}
                >
                  <GroupDot muted />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[var(--text)]">None</span>
                    <span className="block truncate text-[10px] text-[var(--muted)]">Remove from group</span>
                  </span>
                </button>
              </li>
              {matches.map((group) => {
                const members = nodes.filter((n) => n.groupId === group.id);
                const tone = chipTone(groupStatusColor(members, colorBy));
                const active = group.id === groupId;
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
                      onClick={() => assign(group.id)}
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
              {!matches.length ? (
                <li className="px-2 py-2 text-[11px] text-[var(--muted)]">No matching groups</li>
              ) : null}
            </ul>
            <form
              className="flex shrink-0 items-center gap-1 border-t border-[var(--line)] p-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                createFrom(draft || query);
              }}
            >
              <input
                ref={createRef}
                className={cx(field, "min-w-0 flex-1 py-[5px] text-xs")}
                placeholder="New group name"
                aria-label="New group name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className={cx(primaryBtn, "shrink-0 px-2 py-[5px]")} disabled={!draft.trim() && !query.trim()}>
                Create
              </button>
            </form>
          </div>,
          document.body,
        ) : null}
    </div>
  );
}
