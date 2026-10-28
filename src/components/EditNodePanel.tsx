import { type CSSProperties } from "react";
import { nodeColor } from "../graph/colors";
import {
  STATUS_COLORS,
  WORKFLOW_STATUS_META,
  nodeWorkflowStatus,
} from "../graph/workflowStatus";
import { handleOverlayWheel } from "../lib/overlayScroll";
import { cx, editFloat, field, fieldArea, fieldLabel, swatch, swatchOn } from "../styles";
import type { ColorBy, GraphNode } from "../types";
import EmployeePicker from "./EmployeePicker";
import SizePresetPicker from "./SizePresetPicker";

export type NodeEditPreview = {
  size: number;
  color?: string;
};

export type NodeEditPatch = {
  title: string;
  description: string;
  size: number;
  color?: string;
  employee: string;
  employeeEmail: string;
};

type Props = {
  node: GraphNode;
  colorBy: ColorBy;
  embedded?: boolean;
  style?: CSSProperties;
  onSave: (patch: Partial<NodeEditPatch>) => void;
};

export default function EditNodePanel({ node, colorBy, embedded = false, style, onSave }: Props) {
  const accent = nodeColor(node, colorBy);

  return (
    <div
      className={
        embedded
          ? "h-full overflow-auto p-3"
          : `${editFloat} is-tinted left-3 bottom-3 max-h-[calc(100vh-76px)] overflow-auto`
      }
      style={embedded ? style : { ...style, ["--edit-accent" as string]: accent }}
      onWheel={handleOverlayWheel}
    >
      <h3 className="mt-0 mb-2 text-lg font-bold">Modify Node</h3>

      <label className={fieldLabel}>Status</label>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {WORKFLOW_STATUS_META.map(({ id, label }) => {
          const c = STATUS_COLORS[id];
          const active = nodeWorkflowStatus(node, colorBy) === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              className={cx(swatch, active && swatchOn)}
              style={{ background: c }}
              onClick={() => onSave({ color: c })}
            />
          );
        })}
      </div>
      <label className={fieldLabel}>Title</label>
      <input className={field} value={node.title} onChange={(e) => onSave({ title: e.target.value })} />
      <label className={fieldLabel}>Description</label>
      <textarea
        className={fieldArea}
        value={node.description}
        onChange={(e) => onSave({ description: e.target.value })}
      />
      <label className={fieldLabel}>Assigned employee</label>
      <EmployeePicker
        name={node.employee ?? ""}
        email={node.employeeEmail ?? ""}
        onChange={(next) => onSave({ employee: next.name, employeeEmail: next.email })}
      />
      <label className={fieldLabel}>Size</label>
      <SizePresetPicker value={node.size} onSelect={(size) => onSave({ size })} />
    </div>
  );
}
