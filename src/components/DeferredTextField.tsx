import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { registerDraft } from "../store/drafts";
import { cx } from "../styles";

type Props = {
  value: string;
  onCommit: (next: string) => void;
  multiline?: boolean;
  className: string;
  rows?: number;
  /** Names the field in the unsaved-changes prompt. */
  label: string;
  id?: string;
};

export default function DeferredTextField({ value, onCommit, multiline = false, className, rows = 3, label, id }: Props) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  const draftKey = useId();
  const latest = useRef({ draft, value, onCommit });
  latest.current = { draft, value, onCommit };

  useEffect(() => {
    if (!dirty) setDraft(value);
  }, [value, dirty]);

  useEffect(() => {
    registerDraft(
      draftKey,
      dirty
        ? {
            label,
            save: () => latest.current.onCommit(latest.current.draft),
            reset: () => setDraft(latest.current.value),
          }
        : null,
    );
  }, [draftKey, dirty, label]);

  useEffect(() => () => registerDraft(draftKey, null), [draftKey]);

  function commit() {
    if (!dirty) return;
    onCommit(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === "Escape" && dirty) {
      e.preventDefault();
      e.stopPropagation();
      setDraft(value);
      return;
    }
    if (e.key === "Enter" && multiline && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    }
  }

  const actions = dirty ? (
    <div
      className={cx(
        "absolute right-1 z-[1] flex items-center gap-0.5",
        multiline ? "top-1" : "top-1/2 -translate-y-1/2",
      )}
    >
      <button
        type="button"
        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
        aria-label={`Reset ${label}`}
        title="Reset (Esc)"
        onClick={() => setDraft(value)}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      </button>
      <button
        type="submit"
        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-0 bg-[var(--accent)] p-0 text-white hover:brightness-110"
        aria-label={`Save ${label}`}
        title={multiline ? "Save (Ctrl+Enter)" : "Save (Enter)"}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>
    </div>
  ) : null;

  const fieldClass = cx(className, dirty && "border-amber-500 pr-16");

  return (
    <form className="relative" onSubmit={(e) => { e.preventDefault(); commit(); }}>
      {multiline ? (
        <textarea
          id={id}
          className={fieldClass}
          rows={rows}
          value={draft}
          onKeyDown={onKeyDown}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className={fieldClass}
          value={draft}
          onKeyDown={onKeyDown}
          onChange={(e) => setDraft(e.target.value)}
        />
      )}
      {actions}
    </form>
  );
}
