import type { CSSProperties } from "react";
import { nodeColor } from "../graph/colors";
import { employeeColor, employeeInitials } from "../graph/employee";
import { cx } from "../styles";
import type { ColorBy, GraphNode } from "../types";

type Props = {
  node: GraphNode;
  colorBy: ColorBy;
  style: CSSProperties;
};

/** Fixed swatch size in the hover card (not tied to node size on the graph). */
const COLOR_SWATCH_PX = 14;

const previewLabel =
  "mb-0.5 block text-[9px] font-bold tracking-wide text-[var(--muted)] uppercase";

export default function NodePreviewPanel({ node, colorBy, style }: Props) {
  const accent = nodeColor(node, colorBy);
  const employee = node.employee?.trim() ?? "";
  return (
    <div
      className={cx(
        "edit-float is-tinted fixed z-[86] w-[min(240px,calc(100vw-24px))] rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-2 shadow-[var(--shadow)]",
      )}
      style={{ ...style, ["--edit-accent" as string]: accent }}
    >
      <h3 className="mt-0 mb-2 text-[15px] leading-snug font-bold text-[var(--text)]">
        {node.title || "Untitled"}
      </h3>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className={previewLabel}>Color</span>
          <div className="flex min-h-6 items-center">
            <span
              className="edit-size-node pointer-events-none block rounded-full bg-[var(--edit-accent,var(--accent))]"
              style={{ width: COLOR_SWATCH_PX, height: COLOR_SWATCH_PX }}
              title={accent}
              aria-label="Node color"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <span className={previewLabel}>Assigned employee</span>
          <div className="flex min-h-6 items-center">
            {employee ? (
              <span
                className="inline-flex size-6 items-center justify-center rounded-full text-[9px] leading-none font-bold text-white"
                style={{ background: employeeColor(employee) }}
                title={employee}
                aria-label={employee}
              >
                {employeeInitials(employee)}
              </span>
            ) : (
              <span
                className="inline-flex size-6 rounded-full border border-dashed border-[var(--muted)] bg-transparent"
                aria-label="No assigned employee"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
