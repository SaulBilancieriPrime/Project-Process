import type { ArrowStyle, GraphNode } from "../types";
import { ctxBox, cx, dangerText, menuItem } from "../styles";
import LinkMenuOptions from "./LinkMenuOptions";

type Props = {
  node: GraphNode;
  x: number;
  y: number;
  onAddChild: () => void;
  onLink: (arrows: ArrowStyle) => void;
  onTogglePin: () => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onDeleteBranch: () => void;
};

export default function NodeContextMenu({
  node,
  x,
  y,
  onAddChild,
  onLink,
  onTogglePin,
  onToggleCollapse,
  onDelete,
  onDeleteBranch,
}: Props) {
  return (
    <div className={cx("ctx", ctxBox)} style={{ left: x, top: y }}>
      <button type="button" className={menuItem} onClick={onAddChild}>
        Add child
      </button>
      <div className="ctx-flyout relative">
        <button type="button" className={cx(menuItem, "ctx-flyout-trigger justify-between gap-3")}>
          Link
          <span className="ctx-flyout-caret text-sm leading-none text-[var(--muted)]" aria-hidden>
            ›
          </span>
        </button>
        <div className="ctx-sub ctx-sub-link absolute top-0 left-[calc(100%+4px)] z-[1] hidden min-w-44 rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-1.5 shadow-[var(--shadow)]">
          <LinkMenuOptions onLink={onLink} />
        </div>
      </div>
      <button type="button" className={menuItem} onClick={onTogglePin}>
        {node.pinned ? "Unpin" : "Pin"}
      </button>
      <button type="button" className={menuItem} onClick={onToggleCollapse}>
        {node.collapsed ? "Expand branch" : "Collapse branch"}
      </button>
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
