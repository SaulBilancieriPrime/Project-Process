import type { HistoryAction } from "../graph/history";

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
    <div className="modal-backdrop" role="presentation" onClick={onContinue}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saveConfirmTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="saveConfirmTitle">Save this snapshot?</h2>
        <p className="modal-lead">
          {changes.length
            ? `${changes.length} unsaved action${changes.length === 1 ? "" : "s"} will be committed and History will clear.`
            : "There are no unsaved graph actions. You can still write the current snapshot to this browser."}
        </p>
        {items.length > 0 && (
          <ul className="history-list modal-history">
            {items.map((action) => (
              <li key={action.id} className={`history-group is-${action.kind}`}>
                <div className="history-group-head">
                  <strong>{action.label}</strong>
                </div>
                <ul className="history-sub">
                  {action.changes.map((item) => (
                    <li key={item.id}>
                      {item.title}
                      {item.detail ? <span> · {item.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onContinue}>
            Continue editing
          </button>
          <button type="button" className="primary-btn" onClick={onConfirm}>
            Confirm save
          </button>
        </div>
      </div>
    </div>
  );
}
