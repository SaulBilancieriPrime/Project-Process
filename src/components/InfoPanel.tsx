import { ghostBtn } from "../styles";
import HelpTab from "./HelpTab";

type Props = { open: boolean; onClose: () => void };

export default function InfoPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <aside
      className="info-panel fixed top-[58px] right-3 z-[70] max-h-[calc(100vh-80px)] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 pt-3.5 pb-[18px] shadow-[var(--shadow)] [width:min(420px,calc(100vw-24px))]"
      role="dialog"
      aria-labelledby="infoTitle"
    >
      <div className="mb-2.5 flex justify-between gap-2.5">
        <h2 id="infoTitle" className="m-0 text-base text-[var(--accent)]">How to use Project Process</h2>
        <button type="button" className={ghostBtn} onClick={onClose}>Close</button>
      </div>
      <HelpTab />
    </aside>
  );
}
