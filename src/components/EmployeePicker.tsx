import { useEffect, useState } from "react";
import { searchEmployees, type EntraEmployee } from "../api/employees";
import { employeeColor, employeeInitials } from "../graph/employee";
import { cx, field } from "../styles";

type Props = {
  name: string;
  email?: string;
  onChange: (next: { name: string; email: string }) => void;
};

function samePerson(person: EntraEmployee, name: string, email: string) {
  const byEmail = email && person.email && person.email.toLowerCase() === email.toLowerCase();
  const byName = name && person.name.toLowerCase() === name.toLowerCase();
  return Boolean(byEmail || (!email && byName));
}

export default function EmployeePicker({ name, email = "", onChange }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<EntraEmployee[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const people = await searchEmployees(query, controller.signal);
        setHits(people);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setHits([]);
        setError(err instanceof Error ? err.message : "Could not load Entra users.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, query.trim() ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const selected = name.trim();

  function pick(person: EntraEmployee) {
    onChange({ name: person.name, email: person.email });
    setQuery("");
  }

  return (
    <div className="employee-picker">
      {selected ? (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--input)] px-2 py-1.5">
          <span
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-bold text-white"
            style={{ background: employeeColor(selected) }}
            aria-hidden
          >
            {employeeInitials(selected)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-[var(--text)]">{selected}</span>
            {email ? <span className="block truncate text-[10px] text-[var(--muted)]">{email}</span> : null}
          </span>
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => onChange({ name: "", email: "" })}
          >
            Clear
          </button>
        </div>
      ) : null}

      <input
        className={field}
        type="search"
        value={query}
        placeholder={selected ? "Search to change employee…" : "Search Entra users…"}
        autoComplete="off"
        aria-label="Search Entra employees"
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="mt-1.5 mb-0 max-h-40 list-none overflow-auto rounded-lg border border-[var(--line)] bg-[var(--card)] p-1">
        {busy && !hits.length ? <li className="px-2 py-1.5 text-[11px] text-[var(--muted)]">Loading employees…</li> : null}
        {error ? <li className="px-2 py-1.5 text-[11px] text-red-500">{error}</li> : null}
        {!busy && !error && !hits.length ? <li className="px-2 py-1.5 text-[11px] text-[var(--muted)]">No matching employees</li> : null}
        {hits.map((person) => {
          const active = samePerson(person, selected, email);
          return (
            <li key={person.id || person.email}>
              <button
                type="button"
                className={cx(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left hover:bg-[var(--hover)]",
                  active && "bg-[var(--hover)]",
                )}
                aria-pressed={active}
                onClick={() => pick(person)}
              >
                <span
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-bold text-white"
                  style={{ background: employeeColor(person.name) }}
                  aria-hidden
                >
                  {employeeInitials(person.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-[var(--text)]">{person.name}</span>
                  <span className="block truncate text-[10px] text-[var(--muted)]">{person.email}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
