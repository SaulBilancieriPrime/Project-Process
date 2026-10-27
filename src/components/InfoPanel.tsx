import { ghostBtn } from "../styles";

type Props = { open: boolean; onClose: () => void };

export default function InfoPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <aside
      className="fixed top-[58px] right-3 z-[70] max-h-[calc(100vh-80px)] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 pt-3.5 pb-[18px] shadow-[var(--shadow)] [width:min(420px,calc(100vw-24px))]"
      role="dialog"
      aria-labelledby="infoTitle"
    >
      <div className="mb-2.5 flex justify-between gap-2.5">
        <h2 id="infoTitle" className="m-0 text-base text-[var(--accent)]">How to use Project Process</h2>
        <button type="button" className={ghostBtn} onClick={onClose}>Close</button>
      </div>
      <div>
        <h3 className="mt-3.5 mb-1 text-xs tracking-wide text-[var(--accent)] uppercase">Graph</h3>
        <p className="mt-0 mb-2 text-[13px] leading-normal text-[var(--muted)]">This is an editable Obsidian-style graph. Scroll to zoom. Drag empty canvas to box-select nodes, then drag a selected node or the box to move them together. Hold Space or Alt and drag to pan. Drag a single node to move it — nearby nodes settle with force physics.</p>
        <h3 className="mt-3.5 mb-1 text-xs tracking-wide text-[var(--accent)] uppercase">Edit</h3>
        <p className="mt-0 mb-2 text-[13px] leading-normal text-[var(--muted)]">Click a node or connection to select it; double-click to edit. Delete from the edit panel next to Done. The + in the top left or a right-click on empty canvas opens Add node (click the canvas to place it) or a link — none, one, or two arrowheads. After the first node, the link follows your cursor until the second click or Esc. Right-click a node for Add Node (pick a size, then click to place it), link, delete, or delete branch.</p>
        <h3 className="mt-3.5 mb-1 text-xs tracking-wide text-[var(--accent)] uppercase">Zoom</h3>
        <p className="mt-0 mb-2 text-[13px] leading-normal text-[var(--muted)]">The graph always stays dots. Labels stay a standard size. Turn on Cards in the bottom right and zoom in — cards appear on their own as you get closer. Enlarge in the panel scales type and bubbles.</p>
        <h3 className="mt-3.5 mb-1 text-xs tracking-wide text-[var(--accent)] uppercase">Save</h3>
        <p className="mt-0 mb-2 text-[13px] leading-normal text-[var(--muted)]">The graph writes itself to this browser as you work. Save snapshots on demand. Export / Import JSON to move a graph between machines. Sample reloads the PRIME PM activity workflow tree.</p>
      </div>
    </aside>
  );
}
