import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { ArrowStyle, GraphLink, LinkKind } from "../types";

type Draft = { arrows: ArrowStyle; kind: LinkKind };

function toDraft(link: GraphLink): Draft {
  return { arrows: link.arrows, kind: link.kind };
}

function isDirty(link: GraphLink, draft: Draft) {
  return draft.arrows !== link.arrows || draft.kind !== link.kind;
}

type Props = {
  link: GraphLink;
  style: CSSProperties;
  saveRef: MutableRefObject<(() => void) | null>;
  onDirty: (dirty: boolean) => void;
  onSave: (patch: Draft) => void;
  onClose: () => void;
  onDelete: () => void;
};

export default function EditLinkPanel({
  link,
  style,
  saveRef,
  onDirty,
  onSave,
  onClose,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(link));
  const dirty = isDirty(link, draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setDraft(toDraft(link));
  }, [link.id]);

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

  return (
    <div className="edit-float" style={style}>
      <h3>Edit connection Modal</h3>
      <label>Arrows</label>
      <div className="chip-row">
        {([
          ["none", "None"],
          ["one", "One"],
          ["both", "Two"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip${draft.arrows === value ? " on" : ""}`}
            onClick={() => setDraft((prev) => ({ ...prev, arrows: value }))}
          >
            {label}
          </button>
        ))}
      </div>
      <label>Type</label>
      <div className="chip-row">
        <button
          type="button"
          className={`chip${draft.kind === "parent" ? " on" : ""}`}
          onClick={() => setDraft((prev) => ({ ...prev, kind: "parent" }))}
        >
          Hierarchy
        </button>
        <button
          type="button"
          className={`chip${draft.kind === "cross" ? " on" : ""}`}
          onClick={() => setDraft((prev) => ({ ...prev, kind: "cross" }))}
        >
          Cross
        </button>
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
