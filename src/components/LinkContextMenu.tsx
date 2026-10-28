import { ctxBox, cx, dangerText, menuItem } from "../styles";
import LinkMenuOptions from "./LinkMenuOptions";
import type { ArrowStyle } from "../types";

type Props = {
  x: number;
  y: number;
  arrows: ArrowStyle;
  onArrows: (arrows: ArrowStyle) => void;
  onFlip: () => void;
  onInsert: () => void;
  onDelete: () => void;
};

export default function LinkContextMenu({ x, y, arrows, onArrows, onFlip, onInsert, onDelete }: Props) {
  return (
    <div className={cx("ctx", ctxBox, "w-[196px] min-w-0 rounded-lg p-1")} style={{ left: x, top: y }}>
      <LinkMenuOptions compact heading="Link type" active={arrows} onLink={onArrows} onFlip={onFlip} />
      <div className="sep mx-1 my-1 h-px bg-[var(--line)]" />
      <div className="grid grid-cols-2 gap-0.5">
        <button
          type="button"
          title="Split this connection with a new node."
          className={cx(menuItem, "flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center")}
          onClick={onInsert}
        >
          <svg width="24" height="16" viewBox="0 0 28 20" aria-hidden>
            <circle cx="5" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="23" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7.4 10 H11.2 M16.8 10 H20.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="14" cy="10" r="2.8" fill="currentColor" />
            <path d="M14 8.4 V11.6 M12.4 10 H15.6" fill="none" stroke="var(--card)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="text-[9px] font-semibold leading-none">Insert node</span>
        </button>
        <button
          type="button"
          title="Remove this connection."
          className={cx(menuItem, dangerText, "flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center")}
          onClick={onDelete}
        >
          <svg width="24" height="16" viewBox="0 0 28 20" aria-hidden>
            <circle cx="6" cy="10" r="2.4" fill="currentColor" />
            <circle cx="22" cy="10" r="2.4" fill="currentColor" />
            <path d="M8.6 10 H19.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M12.2 6.8 L15.8 13.2 M15.8 6.8 L12.2 13.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="text-[9px] font-semibold leading-none">Delete</span>
        </button>
      </div>
    </div>
  );
}
