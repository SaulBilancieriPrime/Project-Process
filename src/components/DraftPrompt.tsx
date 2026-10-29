import { useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import { draftStore } from "../store/drafts";
import { ghostBtn, primaryBtn } from "../styles";

type Props = {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export default function DraftPrompt({ onSave, onDiscard, onCancel }: Props) {
  const labels = useStore(draftStore, (s) => s.labels);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  const fields = labels.length ? labels.join(" and ") : "this node";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(12,16,24,0.45)] p-5" role="presentation" onClick={onCancel}>
      <div
        className="w-[min(380px,100%)] rounded-[14px] border border-[var(--line)] bg-[var(--card)] px-4 pt-4 pb-3.5 shadow-[var(--shadow)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="draftPromptTitle"
        aria-describedby="draftPromptBody"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="draftPromptTitle" className="mt-0 mb-1.5 text-base text-[var(--accent)]">Unsaved changes</h2>
        <p id="draftPromptBody" className="mt-0 mb-3 text-[13px] leading-snug text-[var(--muted)]">
          You have unsaved edits to {fields}. Save them before leaving?
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={ghostBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={ghostBtn} onClick={onDiscard}>
            Discard
          </button>
          <button ref={saveRef} type="button" className={primaryBtn} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
