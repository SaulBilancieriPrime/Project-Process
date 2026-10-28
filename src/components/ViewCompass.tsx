import { useRef, useState } from "react";
import { normalizeDeg } from "../graph/viewRotation";

type Props = {
  degrees: number;
  onChange: (degrees: number) => void;
  onHoldChange?: (holding: boolean) => void;
};

function angleAt(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  return Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2));
}

function unwrapDelta(from: number, to: number) {
  let d = to - from;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export default function ViewCompass({ degrees, onChange, onHoldChange }: Props) {
  const drag = useRef<{
    pointer: number;
    last: number;
    value: number;
    x: number;
    y: number;
    armed: boolean;
  } | null>(null);
  const [holding, setHolding] = useState(false);

  function endHold() {
    drag.current = null;
    setHolding(false);
    onHoldChange?.(false);
  }

  return (
    <button
      type="button"
      className={`view-compass pointer-events-auto absolute top-3 right-3 origin-top-right cursor-grab rounded-full border-0 bg-transparent p-0 select-none active:cursor-grabbing ${
        holding ? "z-[40] size-28" : "z-[12] size-10"
      }`}
      title="Hold and drag to spin your view. Release to keep that angle."
      aria-label="Rotate view"
      aria-pressed={holding}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        } catch {
          /* pointer may already be gone */
        }
        setHolding(true);
        onHoldChange?.(true);
        drag.current = {
          pointer: e.pointerId,
          last: 0,
          value: degrees,
          x: e.clientX,
          y: e.clientY,
          armed: false,
        };
      }}
      onPointerMove={(e) => {
        const it = drag.current;
        if (!it || it.pointer !== e.pointerId) return;
        e.stopPropagation();
        const el = e.currentTarget as HTMLButtonElement;
        if (!it.armed) {
          if (Math.hypot(e.clientX - it.x, e.clientY - it.y) < 5) return;
          it.armed = true;
          it.last = angleAt(el, e.clientX, e.clientY);
          return;
        }
        const next = angleAt(el, e.clientX, e.clientY);
        it.value = normalizeDeg(it.value + (unwrapDelta(it.last, next) * 180) / Math.PI);
        it.last = next;
        onChange(it.value);
      }}
      onPointerUp={endHold}
      onPointerCancel={endHold}
    >
      <svg width="100%" height="100%" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="18.4" fill="var(--card)" stroke="var(--line)" strokeWidth="1.2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((tick) => {
          const rad = (tick * Math.PI) / 180;
          const outer = 16.4;
          const inner = tick % 90 === 0 ? 13.2 : 14.6;
          return (
            <line
              key={tick}
              x1={20 + Math.sin(rad) * inner}
              y1={20 - Math.cos(rad) * inner}
              x2={20 + Math.sin(rad) * outer}
              y2={20 - Math.cos(rad) * outer}
              stroke="var(--muted)"
              strokeWidth={tick % 90 === 0 ? 1.4 : 1}
              strokeLinecap="round"
            />
          );
        })}
        <g style={{ transform: `rotate(${degrees}deg)`, transformOrigin: "20px 20px" }}>
          <path d="M20 7.2 L23.6 20 H16.4 Z" fill="#e24b4b" />
          <path d="M20 32.8 L23.6 20 H16.4 Z" fill="#c8c6c4" />
          <circle cx="20" cy="20" r="2.1" fill="var(--card)" stroke="var(--line)" strokeWidth="0.8" />
        </g>
      </svg>
    </button>
  );
}
