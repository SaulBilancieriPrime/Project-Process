import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { chip, chipOn, cx, dangerText, editFloat, fieldLabel, ghostBtn, primaryBtn } from "../styles";
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
    <div className={editFloat} style={style}>
      <h3 className="mt-0 mb-2 text-[13px]">Edit connection Modal</h3>
      <label className={fieldLabel}>Arrows</label>
      <div className="flex flex-wrap gap-1.5">
        {([
          ["none", "None"],
          ["one", "One"],
          ["both", "Two"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={cx(chip, draft.arrows === value && chipOn)}
            onClick={() => setDraft((prev) => ({ ...prev, arrows: value }))}
          >
            {label}
          </button>
        ))}
      </div>
      <label className={fieldLabel}>Type</label>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={cx(chip, draft.kind === "parent" && chipOn)}
          onClick={() => setDraft((prev) => ({ ...prev, kind: "parent" }))}
        >
          Hierarchy
        </button>
        <button
          type="button"
          className={cx(chip, draft.kind === "cross" && chipOn)}
          onClick={() => setDraft((prev) => ({ ...prev, kind: "cross" }))}
        >
          Cross
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-1.5">
        {dirty ? (
          <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
        ) : (
          <button type="button" className={cx(ghostBtn, dangerText)} onClick={onDelete}>Delete</button>
        )}
        {dirty ? (
          <button type="button" className={primaryBtn} onClick={() => onSave(draft)}>Save</button>
        ) : (
          <button type="button" className={ghostBtn} onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
