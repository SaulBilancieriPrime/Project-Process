import { ctxBox, cx, dangerText, menuItem } from "../styles";
import LinkMenuOptions from "./LinkMenuOptions";
import SizePresetPicker from "./SizePresetPicker";
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
    <div className={cx("ctx", ctxBox)} style={{ left: x, top: y }}>
      <div className="ctx-flyout relative">
        <button type="button" className={cx(menuItem, "ctx-flyout-trigger justify-between gap-3")}>
          Add Node
          <span className="ctx-flyout-caret text-sm leading-none text-[var(--muted)]" aria-hidden>
            ›
          </span>
        </button>
        <div className="ctx-sub ctx-sub-size absolute bottom-0 left-[calc(100%+4px)] z-[1] hidden w-[12.5dvw] rounded-[10px] border border-[var(--line)] bg-[var(--card)] px-2 py-2 shadow-[var(--shadow)]">
          <div className="mx-1 mb-1 text-[10px] font-bold tracking-wider text-[var(--muted)] uppercase">Size</div>
          <SizePresetPicker accent={accent} onSelect={onAddNode} />
        </div>
      </div>
      <div className="ctx-flyout relative">
        <button type="button" className={cx(menuItem, "ctx-flyout-trigger justify-between gap-3")}>
          Add Link
          <span className="ctx-flyout-caret text-sm leading-none text-[var(--muted)]" aria-hidden>
            ›
          </span>
        </button>
        <div className="ctx-sub ctx-sub-link absolute top-0 left-[calc(100%+4px)] z-[1] hidden min-w-44 rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-1.5 shadow-[var(--shadow)]">
          <LinkMenuOptions onLink={onLink} />
        </div>
      </div>
      <div className="sep mx-0.5 my-1 h-px bg-[var(--line)]" />
      <button type="button" className={cx(menuItem, dangerText)} onClick={onDelete}>
        Delete
      </button>
      <button type="button" className={cx(menuItem, dangerText)} onClick={onDeleteBranch}>
        Delete branch
      </button>
    </div>
  );
}
