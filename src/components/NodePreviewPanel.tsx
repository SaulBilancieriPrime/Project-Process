import type { CSSProperties } from "react";
import { nodeColor } from "../graph/colors";
import { cx } from "../styles";
import type { ColorBy, GraphNode } from "../types";
import PersonFace from "./PersonFace";

type Props = {
  node: GraphNode;
  colorBy: ColorBy;
  style: CSSProperties;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
};

const COLOR_SWATCH_PX = 10;

const previewLabel =
  "mb-0 block text-[8px] font-bold tracking-wide text-[var(--muted)] uppercase";

export default function NodePreviewPanel({ node, colorBy, style, onPointerEnter, onPointerLeave }: Props) {
  const accent = nodeColor(node, colorBy);
  const employee = node.employee?.trim() ?? "";
  const description = node.description?.trim() ?? "";

  return (
    <div
      className={cx(
        "edit-float is-tinted fixed z-[86] w-[min(220px,calc(100vw-24px))] rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 shadow-[var(--shadow)]",
      )}
      style={{ ...style, ["--edit-accent" as string]: accent }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <h3 className="mt-0 mb-0.5 line-clamp-2 text-[11px] leading-tight font-semibold text-[var(--text)]">
        {node.title || "Untitled"}
      </h3>
      {description ? (
        <p className="mt-0 mb-1.5 line-clamp-3 text-[10px] leading-snug text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 shrink-0">
          <span className={previewLabel}>Status</span>
          <div className="flex min-h-5 items-center">
            <span
              className="edit-size-node pointer-events-none block rounded-full bg-[var(--edit-accent,var(--accent))]"
              style={{ width: COLOR_SWATCH_PX, height: COLOR_SWATCH_PX }}
              title={accent}
              aria-label="Node status"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <span className={previewLabel}>Assignee</span>
          <div className="flex min-h-5 items-center justify-end">
            {employee ? (
              <span className="inline-flex size-5 overflow-hidden rounded-full" title={employee} aria-label={employee}>
                <PersonFace name={employee} email={node.employeeEmail} />
              </span>
            ) : (
              <span
                className="inline-flex size-5 rounded-full border border-dashed border-[var(--muted)] bg-transparent"
                aria-label="No assignee"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
