import { useEffect, useRef } from "react";
import type { ArrowStyle } from "../types";

type Props = {
  physics: boolean;
  cardInfo: boolean;
  plusOpen: boolean;
  armed: boolean;
  onPlusOpen: (open: boolean) => void;
  onAddNode: () => void;
  onLink: (arrows: ArrowStyle) => void;
  onFit: () => void;
  onReorg: () => void;
  onPhysics: () => void;
  onSave: () => void;
  onCardInfo: () => void;
};

function ArrowIcon({ kind }: { kind: ArrowStyle }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden>
      {kind !== "none" && kind !== "one" ? (
        <path d="M4 5 L1 5 L2.6 2.6 M1 5 L2.6 7.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : null}
      <path d="M3 5 H19" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {kind !== "none" ? (
        <path d="M18 5 L21 5 L19.4 2.6 M21 5 L19.4 7.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

export default function CanvasTools({
  physics,
  cardInfo,
  plusOpen,
  armed,
  onPlusOpen,
  onAddNode,
  onLink,
  onFit,
  onReorg,
  onPhysics,
  onSave,
  onCardInfo,
}: Props) {
  const plusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plusOpen) return;
    const close = (e: MouseEvent) => {
      if (!plusRef.current?.contains(e.target as Node)) onPlusOpen(false);
    };
    const timer = window.setTimeout(() => window.addEventListener("mousedown", close), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", close);
    };
  }, [plusOpen, onPlusOpen]);

  return (
    <>
      <div className="plus-wrap" ref={plusRef}>
        <button
          type="button"
          className={`plus-btn${plusOpen || armed ? " is-on" : ""}`}
          aria-label="Add"
          aria-expanded={plusOpen}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPlusOpen(!plusOpen);
          }}
        >
          +
        </button>
        {plusOpen && (
          <div className="plus-menu">
            <button
              type="button"
              onClick={() => {
                onAddNode();
                onPlusOpen(false);
              }}
            >
              Add node
            </button>
            <div className="plus-label">Link</div>
            {([
              ["none", "No arrow"],
              ["one", "One arrow"],
              ["both", "Two arrows"],
            ] as const).map(([arrows, label]) => (
              <button
                key={arrows}
                type="button"
                className="plus-connect"
                onClick={() => {
                  onLink(arrows);
                  onPlusOpen(false);
                }}
              >
                <ArrowIcon kind={arrows} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="canvas-tools">
        <button type="button" onClick={onFit}>Fit</button>
        <button type="button" onClick={onReorg}>Reorg</button>
        <button type="button" className={physics ? "is-on" : ""} onClick={onPhysics}>
          {physics ? "Physics on" : "Physics off"}
        </button>
        <button type="button" onClick={onSave}>Save</button>
        <button
          type="button"
          className={cardInfo ? "is-on" : ""}
          aria-pressed={cardInfo}
          onClick={onCardInfo}
        >
          Cards
        </button>
      </div>
    </>
  );
}
