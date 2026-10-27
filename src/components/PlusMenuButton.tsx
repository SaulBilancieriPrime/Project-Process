import { useEffect, useRef } from "react";
import type { ArrowStyle } from "../types";
import { cx, plusMenuBox, toolBtn, toolOn } from "../styles";
import PlusMenu from "./PlusMenu";

type Props = {
  open: boolean;
  armed: boolean;
  onOpen: (open: boolean) => void;
  onAddNode: () => void;
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

  return (
    <div className="plus-wrap absolute top-3 left-3 z-[9]" ref={wrapRef}>
      <button
        type="button"
        className={cx(
          toolBtn,
          "h-9 w-9 rounded-[10px] p-0 text-[22px] leading-none font-medium",
          (open || armed) && toolOn,
        )}
        aria-label="Add"
        aria-expanded={open}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(!open);
        }}
      >
        +
      </button>
      {open && (
        <div className={cx("plus-menu absolute top-[calc(100%+6px)] left-0", plusMenuBox)}>
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
