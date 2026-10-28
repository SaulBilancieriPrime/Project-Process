import { useEffect, useRef } from "react";
import type { ArrowStyle } from "../types";
import { cx, toolBtn, toolBtnOn } from "../styles";
import PlusMenu from "./PlusMenu";

type Props = {
  open: boolean;
  armed: boolean;
  onOpen: (open: boolean) => void;
  onAddNode: (size: number) => void;
  onLink: (arrows: ArrowStyle) => void;
};

export default function PlusMenuButton({ open, armed, onOpen, onAddNode, onLink }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onOpen(false);
    };
    const timer = window.setTimeout(() => window.addEventListener("mousedown", close), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", close);
    };
  }, [open, onOpen]);

  function openMenu(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault();
    e.stopPropagation();
    onOpen(true);
  }

  return (
    <div
      className="plus-wrap relative z-[9] shrink-0"
      ref={wrapRef}
      onMouseEnter={() => onOpen(true)}
      onMouseLeave={() => onOpen(false)}
    >
      <button
        type="button"
        className={cx(
          open || armed ? toolBtnOn : toolBtn,
          "h-9 w-9 rounded-[10px] p-0 text-[22px] leading-none font-medium",
        )}
        aria-label="Add"
        aria-expanded={open}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={openMenu}
        onContextMenu={openMenu}
      >
        +
      </button>
      {open && (
        <div className="plus-menu absolute top-[calc(100%+6px)] left-0 z-40 w-[196px] rounded-lg border border-[var(--line)] bg-[var(--card)] p-1 shadow-[var(--shadow)]">
          <PlusMenu
            onAddNode={onAddNode}
            onLink={onLink}
            onClose={() => onOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
