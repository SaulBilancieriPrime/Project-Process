import type { ArrowStyle } from "../types";

type Props = {
  onAddNode: () => void;
  onLink: (arrows: ArrowStyle) => void;
  onClose: () => void;
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

export default function PlusMenu({ onAddNode, onLink, onClose }: Props) {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          onAddNode();
          onClose();
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
            onClose();
          }}
        >
          <ArrowIcon kind={arrows} />
          <span>{label}</span>
        </button>
      ))}
    </>
  );
}
