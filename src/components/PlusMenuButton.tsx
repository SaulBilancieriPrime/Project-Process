import { useEffect, useRef } from "react";
import type { ArrowStyle } from "../types";
import { cx } from "../styles";
import PlusMenu from "./PlusMenu";

type Props = {
  open: boolean;
  armed: boolean;
  onOpen: (open: boolean) => void;
  onAddNode: (size: number) => void;
  onLink: (arrows: ArrowStyle) => void;
};

const HOVER_CLOSE_MS = 120;

export default function PlusMenuButton({ open, armed, onOpen, onAddNode, onLink }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearHoverClose() {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }

  function hoverOpen() {
    clearHoverClose();
    onOpen(true);
  }

  function hoverClose() {
    clearHoverClose();
    hoverCloseTimer.current = setTimeout(() => onOpen(false), HOVER_CLOSE_MS);
  }

  useEffect(() => {
    return () => clearHoverClose();
  }, []);

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
      onMouseEnter={hoverOpen}
      onMouseLeave={hoverClose}
    >
      <button
        type="button"
        className={cx(
          "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border pb-1 text-[22px] leading-none font-medium transition-[filter] hover:brightness-110",
          open || armed
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--input)]"
            : "border-[var(--line)] bg-[var(--text)] text-[var(--input)]",
        )}
        aria-label="Add"
        aria-expanded={open}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={openMenu}
        onContextMenu={openMenu}
      >
        <span>+</span>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 z-40 w-[196px] pt-1.5"
          onMouseEnter={hoverOpen}
          onMouseLeave={hoverClose}
        >
          <div className="plus-menu rounded-lg border border-[var(--line)] bg-[var(--card)] p-1 shadow-[var(--shadow)]">
            <PlusMenu
              onAddNode={onAddNode}
              onLink={onLink}
              onClose={() => onOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
