import type { HistoryAction } from "../graph/history";
import { cx, ghostBtn, historyKind, primaryBtn } from "../styles";

type Props = {
  open: boolean;
  changes: HistoryAction[];
  onConfirm: () => void;
  onContinue: () => void;
};

export default function SaveConfirmModal({ open, changes, onConfirm, onContinue }: Props) {
  if (!open) return null;
  const items = [...changes].reverse();
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(12,16,24,0.45)] p-5" role="presentation" onClick={onContinue}>
      <div
        className="max-h-[min(80vh,640px)] w-min min-w-0 overflow-auto rounded-[14px] border border-[var(--line)] bg-[var(--card)] px-4 pt-4 pb-3.5 shadow-[var(--shadow)] [width:min(480px,100%)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saveConfirmTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="saveConfirmTitle" className="mt-0 mb-1.5 text-base text-[var(--accent)]">Save this snapshot?</h2>
        <p className="mt-0 mb-3 text-[13px] leading-snug text-[var(--muted)]">
          {changes.length
            ? `${changes.length} unsaved action${changes.length === 1 ? "" : "s"} will be committed and History will clear.`
            : "There are no unsaved graph actions. You can still write the current snapshot to this browser."}
        </p>
        {items.length > 0 && (
          <ul className="mt-2.5 mb-0 flex max-h-80 list-none flex-col gap-2 overflow-auto p-0">
            {items.map((action) => (
              <li key={action.id} className={cx("rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-2", historyKind(action.kind))}>
                <div className="flex items-start justify-between gap-2">
                  <strong className="block text-xs">{action.label}</strong>
                </div>
                <ul className="mt-1.5 mb-0 list-none p-0">
                  {action.changes.map((item) => (
                    <li key={item.id} className="py-[3px] text-[11px] leading-snug text-[var(--text)]">
                      {item.title}
                      {item.detail ? <span className="text-[var(--muted)]"> · {item.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3.5 flex justify-end gap-2">
          <button type="button" className={ghostBtn} onClick={onContinue}>
            Continue editing
          </button>
          <button type="button" className={primaryBtn} onClick={onConfirm}>
            Confirm save
          </button>
        </div>
      </div>
    </div>
  );
}
