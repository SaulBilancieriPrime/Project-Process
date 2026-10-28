import type { CSSProperties } from "react";
import {
  STATUS_COLORS,
  WORKFLOW_STATUS_META,
  nodeWorkflowStatus,
  type WorkflowStatus,
} from "../graph/workflowStatus";
import { handleOverlayWheel } from "../lib/overlayScroll";
import { cx, dangerText, ghostBtn, swatch, swatchOn } from "../styles";
import type { ColorBy, GraphNode } from "../types";
import EmployeePicker from "./EmployeePicker";

type Props = {
  nodes: GraphNode[];
  colorBy: ColorBy;
  style: CSSProperties;
  onStatus: (status: WorkflowStatus, color: string) => void;
  onAssign: (next: { name: string; email: string }) => void;
  onDelete: () => void;
};

export default function SelectionPanel({ nodes, colorBy, style, onStatus, onAssign, onDelete }: Props) {
  const statuses = new Set(nodes.map((n) => nodeWorkflowStatus(n, colorBy)));
  const sharedStatus = statuses.size === 1 ? [...statuses][0] : null;
  const emails = new Set(nodes.map((n) => n.employeeEmail.trim().toLowerCase()));
  const names = new Set(nodes.map((n) => n.employee.trim()));
  const sharedEmail = emails.size === 1 ? nodes[0]?.employeeEmail ?? "" : "";
  const sharedName = names.size === 1 ? nodes[0]?.employee ?? "" : "";

  return (
    <div
      className="item-actions edit-float fixed z-[86] w-[220px] rounded-lg border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 shadow-[var(--shadow)]"
      style={style}
      onWheel={handleOverlayWheel}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <strong className="text-[11px] font-semibold text-[var(--text)]">{nodes.length} selected</strong>
        <button type="button" className={cx(ghostBtn, dangerText, "px-2 py-[3px] text-[11px]")} onClick={onDelete}>
          Delete
        </button>
      </div>
      <span className="mb-1 block text-[8px] font-bold tracking-wide text-[var(--muted)] uppercase">Status</span>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {WORKFLOW_STATUS_META.map(({ id, label }) => {
          const color = STATUS_COLORS[id];
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={sharedStatus === id}
              className={cx(swatch, sharedStatus === id && swatchOn)}
              style={{ background: color }}
              onClick={() => onStatus(id, color)}
            />
          );
        })}
      </div>
      <span className="mb-1 block text-[8px] font-bold tracking-wide text-[var(--muted)] uppercase">Assignee</span>
      <EmployeePicker name={sharedName} email={sharedEmail} onChange={onAssign} />
    </div>
  );
}
