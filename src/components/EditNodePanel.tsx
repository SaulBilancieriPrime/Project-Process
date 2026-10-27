import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { LEVEL_COLORS, nodeColor } from "../graph/colors";
import { KIND_LABEL } from "../graph/ops";
import { cx, dangerText, editFloat, field, fieldArea, fieldLabel, ghostBtn, primaryBtn, swatch, swatchOn } from "../styles";
import type { ColorBy, GraphNode, NodeKind } from "../types";
import SizePresetPicker from "./SizePresetPicker";

type Draft = {
  title: string;
  description: string;
  type: NodeKind;
  size: number;
  color?: string;
  employee: string;
};

function toDraft(node: GraphNode): Draft {
  return {
    title: node.title,
    description: node.description,
    type: node.type,
    size: node.size,
    color: node.color,
    employee: node.employee ?? "",
  };
}

function isDirty(node: GraphNode, draft: Draft) {
  return (
    draft.title !== node.title ||
    draft.description !== node.description ||
    draft.type !== node.type ||
    Math.abs(draft.size - node.size) > 0.001 ||
    (draft.color ?? "") !== (node.color ?? "") ||
    draft.employee !== (node.employee ?? "")
  );
}

type Props = {
  node: GraphNode;
  colorBy: ColorBy;
  style: CSSProperties;
  saveRef: MutableRefObject<(() => void) | null>;
  onDirty: (dirty: boolean) => void;
  onSave: (patch: Draft) => void;
  onClose: () => void;
  onDelete: () => void;
};

export default function EditNodePanel({
  node,
  colorBy,
  style,
  saveRef,
  onDirty,
  onSave,
  onClose,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(node));
  const dirty = isDirty(node, draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setDraft(toDraft(node));
  }, [node.id]);

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  useEffect(() => {
    saveRef.current = () => {
      if (!dirtyRef.current) return;
      onSave(draft);
    };
    return () => {
      saveRef.current = null;
    };
  }, [draft, onSave, saveRef]);

  function patch(partial: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  const accent = nodeColor({ ...node, ...draft }, colorBy);

  return (
    <div
      className={`${editFloat} is-tinted`}
      style={{ ...style, ["--edit-accent" as string]: accent }}
    >
      <h3 className="mt-0 mb-2 text-[13px]">Edit Node: {node.title}</h3>

      <label className={fieldLabel}>Status</label>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {LEVEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={cx(swatch, (draft.color === c || (!draft.color && nodeColor({ ...node, ...draft }, colorBy) === c)) && swatchOn)}
            style={{ background: c }}
            onClick={() => patch({ color: c })}
          />
        ))}
      </div>
      <label className={fieldLabel}>Title</label>
      <input
        className={field}
        autoFocus
        value={draft.title}
        onChange={(e) => patch({ title: e.target.value })}
      />
      <label className={fieldLabel}>Description</label>
      <textarea
        className={fieldArea}
        value={draft.description}
        onChange={(e) => patch({ description: e.target.value })}
      />
      <label className={fieldLabel}>Assigned employee</label>
      <input
        className={field}
        value={draft.employee}
        placeholder="Name"
        onChange={(e) => patch({ employee: e.target.value })}
      />
      <label className={fieldLabel}>Type</label>
      <select
        className={field}
        value={draft.type}
        onChange={(e) => patch({ type: e.target.value as NodeKind })}
      >
        {(["concept", "category", "task", "info"] as NodeKind[]).map((kind) => (
          <option key={kind} value={kind}>
            {KIND_LABEL[kind]}
          </option>
        ))}
      </select>
      <label className={fieldLabel}>Size</label>
      <SizePresetPicker value={draft.size} onSelect={(size) => patch({ size })} />

      <div className="mt-2.5 flex items-center justify-between gap-1.5 pt-3">
        {dirty ? (
          <button type="button" className={ghostBtn} onClick={onClose}>
            Cancel
          </button>
        ) : (
          <button type="button" className={cx(ghostBtn, dangerText)} onClick={onDelete}>
            Delete
          </button>
        )}
        {dirty ? (
          <button
            type="button"
            className={primaryBtn}
            onClick={() => onSave(draft)}
          >
            Save
          </button>
        ) : (
          <button type="button" className={ghostBtn} onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
