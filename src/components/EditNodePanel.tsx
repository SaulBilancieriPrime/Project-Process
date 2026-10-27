import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { LEVEL_COLORS, nodeColor } from "../graph/colors";
import { KIND_LABEL } from "../graph/ops";
import type { ColorBy, GraphNode, NodeKind } from "../types";

type Draft = {
  title: string;
  description: string;
  type: NodeKind;
  size: number;
  color?: string;
};

function toDraft(node: GraphNode): Draft {
  return {
    title: node.title,
    description: node.description,
    type: node.type,
    size: node.size,
    color: node.color,
  };
}

function isDirty(node: GraphNode, draft: Draft) {
  return (
    draft.title !== node.title ||
    draft.description !== node.description ||
    draft.type !== node.type ||
    Math.abs(draft.size - node.size) > 0.001 ||
    (draft.color ?? "") !== (node.color ?? "")
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
      className="edit-float is-tinted"
      style={{ ...style, ["--edit-accent" as string]: accent }}
    >
      <h3>Edit node Modal</h3>
      <label>Title</label>
      <input autoFocus value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
      <label>Description</label>
      <textarea value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
      <label>Type</label>
      <select value={draft.type} onChange={(e) => patch({ type: e.target.value as NodeKind })}>
        {(["concept", "category", "task", "info"] as NodeKind[]).map((kind) => (
          <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
        ))}
      </select>
      <label>Size</label>
      <input
        type="range"
        min={0.55}
        max={2.4}
        step={0.05}
        value={draft.size}
        onChange={(e) => patch({ size: Number(e.target.value) })}
      />
      <div className="swatch-row" style={{ marginTop: 10 }}>
        {LEVEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${draft.color === c || (!draft.color && nodeColor({ ...node, ...draft }, colorBy) === c) ? " on" : ""}`}
            style={{ background: c }}
            onClick={() => patch({ color: c })}
          />
        ))}
      </div>
      <div className="edit-actions">
        {dirty ? (
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
        ) : (
          <button type="button" className="danger ghost" onClick={onDelete}>Delete</button>
        )}
        {dirty ? (
          <button type="button" className="primary-btn" onClick={() => onSave(draft)}>Save</button>
        ) : (
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
