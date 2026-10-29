import { useId, useMemo, useState } from "react";
import { handleOverlayWheel } from "../lib/overlayScroll";
import { findUsers } from "../data/users";
import { employeeAssignmentSchema, type User } from "../schema/user";
import { cx, field } from "../styles";
import PersonFace from "./PersonFace";

type Props = {
  name: string;
  email?: string;
  onChange: (next: { name: string; email: string }) => void;
};

function samePerson(person: User, name: string, email: string) {
  const byEmail = email && person.email.toLowerCase() === email.toLowerCase();
  const byName = name && person.name.toLowerCase() === name.toLowerCase();
  return Boolean(byEmail || (!email && byName));
}

const rowClass =
  "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1 text-left font-sans hover:bg-[var(--hover)]";

export default function EmployeePicker({ name, email = "", onChange }: Props) {
  const selected = name.trim();
  const [query, setQuery] = useState("");
  const listId = useId();
  const matches = useMemo(() => findUsers(query), [query]);
  const unassigned = !selected && !email;

  function choose(next: { name: string; email: string }) {
    onChange(employeeAssignmentSchema.parse(next));
  }

  return (
    <div className="employee-picker space-y-1.5">
      <input
        className={cx(field, "py-[5px] text-xs")}
        type="search"
        placeholder="Search people"
        aria-label="Search people"
        aria-controls={listId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul id={listId} className="m-0 flex list-none flex-col gap-0.5 p-0" onWheel={handleOverlayWheel} aria-label="People">
        {!query.trim() ? (
          <li>
            <button
              type="button"
              className={cx(rowClass, unassigned && "bg-[var(--hover)] ring-1 ring-[var(--accent)]")}
              aria-pressed={unassigned}
              onClick={() => choose({ name: "", email: "" })}
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--line)] text-[var(--muted)]">
                <svg className="size-3.5" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="8" r="4" fill="currentColor" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor" />
                </svg>
              </span>
              <span className="text-xs text-[var(--text)]">Unassigned</span>
            </button>
          </li>
        ) : null}
        {matches.map((person) => {
          const active = samePerson(person, selected, email);
          return (
            <li key={person.objectId}>
              <button
                type="button"
                className={cx(rowClass, active && "bg-[var(--hover)] ring-1 ring-[var(--accent)]")}
                aria-pressed={active}
                title={active ? "Click again to unassign" : undefined}
                onClick={() => choose(active ? { name: "", email: "" } : { name: person.name, email: person.email })}
              >
                <span className="inline-flex size-7 shrink-0 overflow-hidden rounded-full">
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
        {!matches.length ? <li className="px-1.5 py-1 text-[11px] text-[var(--muted)]">No one matches “{query.trim()}”.</li> : null}
      </ul>
    </div>
  );
}
