import type { ChangeItem } from "../graph/history";
import { cx, historyKind, primaryBtn } from "../styles";

type Props = {
  changes: ChangeItem[];
  onClose: () => void;
};

export default function SyncChangesModal({ changes, onClose }: Props) {
  if (!changes.length) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(12,16,24,0.45)] p-5" role="presentation" onClick={onClose}>
      <div
        className="max-h-[min(80vh,640px)] w-[min(420px,calc(100vw-40px))] overflow-auto rounded-[14px] border border-[var(--line)] bg-[var(--card)] px-4 pt-4 pb-3.5 shadow-[var(--shadow)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="syncChangesTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="syncChangesTitle" className="mt-0 mb-1.5 text-base text-[var(--accent)]">
          New changes from sync
        </h2>
        <p className="mt-0 mb-3 text-[13px] leading-snug text-[var(--muted)]">
          {changes.length} update{changes.length === 1 ? "" : "s"} arrived from the shared map. The canvas is ready to edit again.
        </p>
        <ul className="mt-2.5 mb-0 flex max-h-80 list-none flex-col gap-2 overflow-auto p-0">
          {changes.map((item) => (
            <li key={item.id} className={cx("rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-2", historyKind(item.kind))}>
              <strong className="block text-xs">{item.title}</strong>
              {item.detail ? <p className="mt-1 mb-0 text-[11px] leading-snug text-[var(--muted)]">{item.detail}</p> : null}
            </li>
          ))}
        </ul>
        <div className="mt-3.5 flex justify-end">
          <button type="button" className={primaryBtn} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
