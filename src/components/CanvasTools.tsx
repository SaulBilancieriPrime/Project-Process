import { toolBtn, toolBtnOn } from "../styles";

type Props = {
  physics: boolean;
  cardInfo: boolean;
  onFit: () => void;
  onReorg: () => void;
  onPhysics: () => void;
  onCardInfo: () => void;
};

export default function CanvasTools({
  physics,
  cardInfo,
  onFit,
  onReorg,
  onPhysics,
  onCardInfo,
}: Props) {
  return (
    <div className="canvas-tools flex w-full shrink-0 flex-wrap gap-1.5 rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] p-1.5 shadow-[var(--shadow)] backdrop-blur-[10px]">
      <button type="button" className={toolBtn} onClick={onFit}>Fit</button>
      <button type="button" className={toolBtn} onClick={onReorg}>Reorg</button>
      <button
        type="button"
        className={physics ? toolBtnOn : toolBtn}
        aria-pressed={physics}
        onClick={onPhysics}
      >
        {physics ? "Physics on" : "Physics off"}
      </button>
      <button
        type="button"
        className={cardInfo ? toolBtnOn : toolBtn}
        aria-pressed={cardInfo}
        onClick={onCardInfo}
      >
        Cards
      </button>
    </div>
  );
}
