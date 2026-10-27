import type { CSSProperties } from "react";
import { nodeColor, SIZE_PRESETS } from "../graph/colors";
import { employeeColor, employeeInitials } from "../graph/employee";
import { editFloat, fieldLabel } from "../styles";
import type { ColorBy, GraphNode } from "../types";

type Props = {
  node: GraphNode;
  colorBy: ColorBy;
  style: CSSProperties;
};

function nearestDot(size: number) {
  return SIZE_PRESETS.reduce((best, preset) =>
    Math.abs(preset.value - size) < Math.abs(best.value - size) ? preset : best,
  ).dot;
}

export default function NodePreviewPanel({ node, colorBy, style }: Props) {
  const accent = nodeColor(node, colorBy);
  const employee = node.employee?.trim() ?? "";
  const dot = nearestDot(node.size);

  return (
    <div
      className={`${editFloat} is-tinted`}
      style={{ ...style, ["--edit-accent" as string]: accent }}
    >
      <h3 className="mt-0 mb-2 text-[13px]">{node.title || "Untitled"}</h3>
      <label className={fieldLabel}>Color</label>
      <div className="flex min-h-8 items-center">
        <span
          className="edit-size-node pointer-events-none block rounded-full bg-[var(--edit-accent,var(--accent))]"
          style={{ width: dot, height: dot }}
          title={accent}
          aria-label="Node color"
        />
      </div>
      <label className={fieldLabel}>Assigned employee</label>
      <div className="flex min-h-8 items-center">
        {employee ? (
          <span
            className="inline-flex size-7 items-center justify-center rounded-full text-[10px] leading-none font-bold text-white"
            style={{ background: employeeColor(employee) }}
            title={employee}
            aria-label={employee}
          >
            {employeeInitials(employee)}
          </span>
        ) : (
          <span
            className="inline-flex size-7 rounded-full border border-dashed border-[var(--muted)] bg-transparent"
            aria-label="No assigned employee"
          />
        )}
      </div>
    </div>
  );
}
