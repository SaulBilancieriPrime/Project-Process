import { handleOverlayWheel } from "../lib/overlayScroll";
import { ghostBtn } from "../styles";
import HelpTab from "./HelpTab";

type Props = { open: boolean; onClose: () => void };

export default function InfoPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <aside
      className="info-panel fixed top-14 right-3 z-[70] flex h-[calc(100vh-68px)] w-[min(360px,calc(100vw-280px))] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-[var(--shadow)]"
      role="dialog"
      aria-labelledby="infoTitle"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h2 id="infoTitle" className="m-0 text-sm font-semibold text-[var(--accent)]">
          Help
        </h2>
        <button type="button" className={ghostBtn} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3" onWheel={handleOverlayWheel}>
        <HelpTab />
      </div>
    </aside>
  );
}
