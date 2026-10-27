import { LEVEL_COLORS } from "../graph/colors";
import { KIND_LABEL } from "../graph/ops";
import type { GraphNode, NodeKind } from "../types";
import { NODE_KINDS } from "../types";

const SIZE_PRESETS = [
  { value: 0.7, label: "S", dot: 8 },
  { value: 1, label: "M", dot: 11 },
  { value: 1.45, label: "L", dot: 14 },
  { value: 2, label: "XL", dot: 18 },
] as const;

type Props = {
  node: GraphNode;
  x: number;
  y: number;
  onEdit: () => void;
  onAddChild: () => void;
  onLink: (arrows: "none" | "one" | "both") => void;
  onTogglePin: () => void;
  onToggleCollapse: () => void;
  onType: (kind: NodeKind) => void;
  onColor: (color: string) => void;
  onSize: (size: number) => void;
  onDelete: () => void;
  onDeleteBranch: () => void;
};

export default function NodeContextMenu({
  node,
  x,
  y,
  onEdit,
  onAddChild,
  onLink,
  onTogglePin,
  onToggleCollapse,
  onType,
  onColor,
  onSize,
  onDelete,
  onDeleteBranch,
}: Props) {
  const activeColor = node.color;
  const activeSize = node.size;

  return (
    <div className="ctx" style={{ left: x, top: y }}>
      <button type="button" onClick={onEdit}>
        Edit
      </button>
      <button type="button" onClick={onAddChild}>
        Add child
      </button>
      <button type="button" onClick={() => onLink("none")}>
        Link ·
      </button>
      <button type="button" onClick={() => onLink("one")}>
        Link →
      </button>
      <button type="button" onClick={() => onLink("both")}>
        Link ↔
      </button>
      <button type="button" onClick={onTogglePin}>
        {node.pinned ? "Unpin" : "Pin"}
      </button>
      <button type="button" onClick={onToggleCollapse}>
        {node.collapsed ? "Expand branch" : "Collapse branch"}
      </button>
      <div className="sep" />
      <div className="ctx-flyout">
        <button type="button" className="ctx-flyout-trigger">
          Type: {KIND_LABEL[node.type]}
          <span className="ctx-flyout-caret" aria-hidden>
            ›
          </span>
        </button>
        <div className="ctx-sub">
          {NODE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={node.type === kind ? "is-active" : ""}
              onClick={() => onType(kind)}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      </div>
      <div className="sep" />
      <div className="swatch-row ctx-picker-row">
        {LEVEL_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${activeColor === c ? " on" : ""}`}
            style={{ background: c }}
            title="Color"
            aria-label="Set color"
            onClick={() => onColor(c)}
          />
        ))}
      </div>
      <div className="sep" />
      <div className="size-row ctx-picker-row">
        {SIZE_PRESETS.map(({ value, label, dot }) => (
          <button
            key={label}
            type="button"
            className={`size-dot${Math.abs(activeSize - value) < 0.06 ? " on" : ""}`}
            title={`Size ${label}`}
            aria-label={`Size ${label}`}
            onClick={() => onSize(value)}
          >
            <span
              className="size-dot-inner"
              style={{ width: dot, height: dot }}
            />
          </button>
        ))}
      </div>
      <div className="sep" />
      <button type="button" className="danger" onClick={onDelete}>
        Delete
      </button>
      <button type="button" className="danger" onClick={onDeleteBranch}>
        Delete branch
      </button>
    </div>
  );
}
