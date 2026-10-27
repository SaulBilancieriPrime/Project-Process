import { useEffect, useRef } from "react";
import type { ArrowStyle } from "../types";
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
    <div className="plus-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`plus-btn${open || armed ? " is-on" : ""}`}
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
        <div className="plus-menu">
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
