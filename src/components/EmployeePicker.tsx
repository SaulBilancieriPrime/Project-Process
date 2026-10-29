import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { placePortaledMenu, portaledMenuListClass, portaledMenuShellClass, type PortaledMenuPos } from "../lib/dropdownPortal";
import { handleOverlayWheel } from "../lib/overlayScroll";
import { findUsers, users } from "../data/users";
import { employeeAssignmentSchema, type User } from "../schema/user";
import { cx, field } from "../styles";
import PersonFace from "./PersonFace";

type Props = {
  name: string;
  email?: string;
  emptyLabel?: string;
  onChange: (next: { name: string; email: string }) => void;
};

function samePerson(person: User, name: string, email: string) {
  const byEmail = email && person.email.toLowerCase() === email.toLowerCase();
  const byName = name && person.name.toLowerCase() === name.toLowerCase();
  return Boolean(byEmail || (!email && byName));
}

function UnassignedMark() {
  return (
    <span
      className="inline-flex size-full items-center justify-center rounded-full bg-[var(--input)] text-[var(--muted)]"
      aria-hidden
    >
      <svg className="size-3.5" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" fill="currentColor" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor" />
      </svg>
    </span>
  );
}

function PersonSummary({
  name,
  email,
  emptyLabel,
}: {
  name: string;
  email?: string;
  emptyLabel: string;
}) {
  if (!name && !email) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="size-8 shrink-0">
          <UnassignedMark />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-[var(--muted)]">{emptyLabel}</span>
          <span className="block truncate text-[11px] text-[var(--muted)]">
            {emptyLabel === "Unassigned" ? "No one assigned" : "Assignees differ"}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="size-8 shrink-0">
        <PersonFace name={name} email={email} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{name || "Assigned"}</span>
        <span className="block truncate text-[11px] text-[var(--muted)]">{email || "No email"}</span>
      </span>
    </span>
  );
}

export default function EmployeePicker({
  name,
  email = "",
  emptyLabel = "Unassigned",
  onChange,
}: Props) {
  const selected = name.trim();
  const current = users.find((person) => samePerson(person, selected, email));
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<PortaledMenuPos | null>(null);
  const matches = useMemo(() => findUsers(query), [query]);

  function placeMenu() {
    if (!rootRef.current) return;
    setMenuPos(placePortaledMenu(rootRef.current));
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
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open && menuPos) searchRef.current?.focus();
  }, [open, menuPos]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function assign(person: User | null) {
    if (!person) {
      onChange(employeeAssignmentSchema.parse({ name: "", email: "" }));
      close();
      return;
    }
    onChange(employeeAssignmentSchema.parse({ name: person.name, email: person.email }));
    close();
  }

  const options = matches;
  const optionCount = options.length + 1;

  function move(delta: number) {
    setActiveIndex((i) => (i + delta + optionCount) % optionCount);
  }

  function chooseActive() {
    if (activeIndex <= 0) assign(null);
    else assign(options[activeIndex - 1] ?? null);
  }

  return (
    <div className="employee-picker relative" ref={rootRef}>
      <button
        type="button"
        className={cx(field, "flex items-center justify-between gap-2 py-1.5 pr-2 text-left")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Assigned employee"
        onClick={() => {
          if (open) close();
          else {
            placeMenu();
            setOpen(true);
          }
        }}
      >
        <PersonSummary
          name={current?.name ?? selected}
          email={current?.email ?? email}
          emptyLabel={emptyLabel}
        />
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
          aria-label="Users"
          onWheel={handleOverlayWheel}
        >
          <input
            ref={searchRef}
            className={cx(field, "shrink-0 rounded-none border-0 border-b")}
            placeholder="Search name or email"
            aria-label="Search people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                chooseActive();
              }
            }}
          />
          <ul className={portaledMenuListClass}>
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!current}
                className={cx(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-left hover:bg-[var(--hover)]",
                  activeIndex === 0 && "bg-[var(--hover)]",
                  !current && "ring-1 ring-inset ring-[var(--accent)]",
                )}
                onClick={() => assign(null)}
              >
                <span className="size-7 shrink-0">
                  <UnassignedMark />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[var(--text)]">Unassigned</span>
                  <span className="block truncate text-[10px] text-[var(--muted)]">Clear assignee</span>
                </span>
              </button>
            </li>
            {options.map((person, index) => {
              const active = samePerson(person, selected, email);
              const focused = activeIndex === index + 1;
              return (
                <li key={person.objectId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cx(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-left hover:bg-[var(--hover)]",
                      focused && "bg-[var(--hover)]",
                      active && "ring-1 ring-inset ring-[var(--accent)]",
                    )}
                    onClick={() => assign(person)}
                  >
                    <span className="size-7 shrink-0">
                      <PersonFace name={person.name} email={person.email} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--text)]">{person.name}</span>
                      <span className="block truncate text-[10px] text-[var(--muted)]">{person.email}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!options.length ? (
              <li className="px-2 py-2 text-[11px] text-[var(--muted)]">No matching people</li>
            ) : null}
          </ul>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
