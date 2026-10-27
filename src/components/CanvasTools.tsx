import { cx, toolBtn, toolOn } from "../styles";

type Props = {
  physics: boolean;
  cardInfo: boolean;
  onFit: () => void;
  onReorg: () => void;
  onPhysics: () => void;
  onSave: () => void;
  onCardInfo: () => void;
};

export default function CanvasTools({
  physics,
  cardInfo,
  onFit,
  onReorg,
  onPhysics,
  onSave,
  onCardInfo,
}: Props) {
  return (
    <div className="canvas-tools absolute right-3 bottom-3 z-[8] flex gap-1.5 rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] p-1.5 shadow-[var(--shadow)] backdrop-blur-[10px] [.has-side_&]:right-[308px]">
      <button type="button" className={toolBtn} onClick={onFit}>Fit</button>
      <button type="button" className={toolBtn} onClick={onReorg}>Reorg</button>
      <button type="button" className={cx(toolBtn, physics && toolOn)} onClick={onPhysics}>
        {physics ? "Physics on" : "Physics off"}
      </button>
      <button type="button" className={toolBtn} onClick={onSave}>Save</button>
      <button
        type="button"
        className={cx(toolBtn, cardInfo && toolOn)}
        aria-pressed={cardInfo}
        onClick={onCardInfo}
      >
        Cards
      </button>
    </div>
  );
}
