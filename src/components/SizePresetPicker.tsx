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
  onSelect: (size: number) => void;
};

export default function SizePresetPicker({ value, accent, onSelect }: Props) {
  const selected = value !== undefined ? nearestSizeLabel(value) : null;
  return (
    <div
      className="flex min-h-12 items-end justify-between gap-3"
      style={accent ? { ["--edit-accent" as string]: accent } : undefined}
    >
      {SIZE_PRESETS.map(({ value: size, label, dot }) => (
        <button
          key={label}
          type="button"
          className={cx(
            "edit-size-btn flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-1.5 border-0 bg-transparent pt-1",
            selected === label && "on",
          )}
          title={`Size ${label}`}
          aria-label={`Size ${label}`}
          aria-pressed={selected === label}
          onClick={() => onSelect(size)}
        >
          <span
            className="edit-size-node pointer-events-none block rounded-full bg-[var(--edit-accent,var(--accent))]"
            style={{ width: dot, height: dot }}
          />
          <span className={cx("text-[9px] leading-none font-bold tracking-wide text-[var(--muted)]", selected === label && "text-[var(--text)]")}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
