import { SIZE_PRESETS } from "../graph/colors";
import { cx } from "../styles";

function nearestSizeLabel(size: number) {
  return SIZE_PRESETS.reduce((best, preset) =>
    Math.abs(preset.value - size) < Math.abs(best.value - size) ? preset : best,
  ).label;
}

type Props = {
  value?: number;
  accent?: string;
  compact?: boolean;
  onSelect: (size: number) => void;
};

export default function SizePresetPicker({ value, accent, compact = false, onSelect }: Props) {
  const selected = value !== undefined ? nearestSizeLabel(value) : null;
  return (
    <div
      className={cx("flex items-end justify-between", compact ? "min-h-0 gap-0.5" : "min-h-12 gap-3")}
      style={accent ? { ["--edit-accent" as string]: accent } : undefined}
    >
      {SIZE_PRESETS.map(({ value: size, label, dot }) => {
        const px = compact ? Math.max(6, Math.round(dot * 0.62)) : dot;
        return (
          <button
            key={label}
            type="button"
            className={cx(
              "edit-size-btn flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-end border-0 bg-transparent",
              compact ? "gap-0.5 py-0.5" : "gap-1.5 pt-1",
              selected === label && "on",
            )}
            title={`Size ${label}`}
            aria-label={`Size ${label}`}
            aria-pressed={selected === label}
            onClick={() => onSelect(size)}
          >
            <span
              className="edit-size-node pointer-events-none block rounded-full bg-[var(--edit-accent,var(--accent))]"
              style={{ width: px, height: px }}
            />
            <span className={cx("leading-none font-bold tracking-wide text-[var(--muted)]", compact ? "text-[8px]" : "text-[9px]", selected === label && "text-[var(--text)]")}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
