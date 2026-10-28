import { ctxBox, cx, dangerText, menuItem } from "../styles";
import AddGraphActions from "./AddGraphActions";
import type { ArrowStyle } from "../types";

type Props = {
  x: number;
  y: number;
  accent?: string;
  onAddNode: (size: number) => void;
  onLink: (arrows: ArrowStyle) => void;
  onDelete: () => void;
  onDeleteBranch: () => void;
};

export default function NodeContextMenu({
  x,
  y,
  accent,
  onAddNode,
  onLink,
  onDelete,
  onDeleteBranch,
}: Props) {
  return (
    <div className={cx("ctx", ctxBox, "w-[196px] min-w-0 rounded-lg p-1")} style={{ left: x, top: y }}>
      <AddGraphActions accent={accent} onAddNode={onAddNode} onLink={onLink} />
      <div className="sep mx-1 my-1 h-px bg-[var(--line)]" />
      <div className="grid grid-cols-2 gap-0.5">
        <button
          type="button"
          title="Remove this node only. Children stay."
          className={cx(menuItem, dangerText, "flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center")}
          onClick={onDelete}
        >
          <svg width="24" height="16" viewBox="0 0 28 20" aria-hidden>
            <circle cx="14" cy="6" r="3.4" fill="currentColor" />
            <path d="M11.4 3.4 L16.6 8.6 M16.6 3.4 L11.4 8.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="16" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="20" cy="16" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M14 9.4 V13.2 M10.4 14.6 H11.6 M16.4 14.6 H17.6" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
          </svg>
          <span className="text-[9px] font-semibold leading-none">Delete</span>
        </button>
        <button
          type="button"
          title="Remove this node and everything under it."
          className={cx(menuItem, dangerText, "flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center")}
          onClick={onDeleteBranch}
        >
          <svg width="24" height="16" viewBox="0 0 28 20" aria-hidden>
            <circle cx="14" cy="6" r="3.4" fill="currentColor" />
            <circle cx="8" cy="16" r="2.2" fill="currentColor" />
            <circle cx="20" cy="16" r="2.2" fill="currentColor" />
            <path d="M14 9.4 V13.2 M14 13.2 L8 14.2 M14 13.2 L20 14.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
            <path d="M11.4 3.4 L16.6 8.6 M16.6 3.4 L11.4 8.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="text-[9px] font-semibold leading-none">Delete branch</span>
        </button>
      </div>
    </div>
  );
}
