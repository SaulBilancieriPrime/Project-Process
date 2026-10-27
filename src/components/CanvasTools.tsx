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
  );
}
