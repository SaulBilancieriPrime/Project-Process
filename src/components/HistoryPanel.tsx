import type { HistoryAction } from "../graph/history";
import { cx, filterHint, ghostBtn, historyKind, sideH2 } from "../styles";

type Props = {
  open: boolean;
  history: HistoryAction[];
  onUndo: (id: string) => void;
  onClose: () => void;
};

export default function HistoryPanel({ open, history, onUndo, onClose }: Props) {
  if (!open) return null;
  const items = [...history].reverse();
  return (
    <aside
      className="history-panel fixed top-[58px] right-3 z-[70] max-h-[calc(100vh-80px)] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 pt-3.5 pb-[18px] shadow-[var(--shadow)] [width:min(380px,calc(100vw-24px))]"
      role="dialog"
      aria-labelledby="historyTitle"
    >
      <div className="mb-2.5 flex justify-between gap-2.5">
        <h2 id="historyTitle" className="m-0 text-base text-[var(--accent)]">History</h2>
        <button type="button" className={ghostBtn} onClick={onClose}>Close</button>
      </div>
      {!history.length ? (
        <section>
          <h3 className={sideH2}>Recent actions</h3>
          <p className={filterHint}>No local undo steps yet. Edits you make list here and also write to the shared map.</p>
        </section>
      ) : (
        <section>
          <h3 className={sideH2}>Recent actions</h3>
          <p className={filterHint}>
            {history.length} local action{history.length === 1 ? "" : "s"}. Undo restores the map to just before that action and syncs the shared map.
          </p>
          <ul className="mt-2.5 mb-0 flex list-none flex-col gap-2 p-0">
            {items.map((action) => (
              <li key={action.id} className={cx("rounded-lg border border-[var(--line)] bg-[var(--input)] px-2.5 py-2", historyKind(action.kind))}>
                <div className="flex items-start justify-between gap-2">
                  <strong className="block text-xs">{action.label}</strong>
                  <button type="button" className={cx(ghostBtn, "shrink-0 px-2 py-[3px] text-[11px]")} onClick={() => onUndo(action.id)}>
                    Undo
                  </button>
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
        </section>
      )}
    </aside>
  );
}
