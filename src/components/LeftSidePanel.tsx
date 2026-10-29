import type { CSSProperties } from "react";
import { nodeColor } from "../graph/colors";
import type { WorkflowStatus } from "../graph/workflowStatus";
import { handleOverlayWheel } from "../lib/overlayScroll";
import { cx } from "../styles";
import type { ColorBy, GraphGroup, GraphNode, GraphSettings } from "../types";
import EditNodePanel, { type NodeEditPatch } from "./EditNodePanel";
import FilterPanel from "./FilterPanel";

type Props = {
  search: string;
  statusFilters: WorkflowStatus[];
  employeeFilter: string | null;
  groups: GraphGroup[];
  groupFilters: string[];
  nodes: GraphNode[];
  settings: GraphSettings;
  colorBy: ColorBy;
  editingNode: GraphNode | null;
  onSearch: (v: string) => void;
  onStatusFilters: (v: WorkflowStatus[]) => void;
  onEmployeeFilter: (v: string | null) => void;
  onGroupFilters: (v: string[]) => void;
  onSettings: (patch: Partial<GraphSettings>) => void;
  onResetSettings: () => void;
  onFit: () => void;
  onReorg: () => void;
  onTogglePhysics: () => void;
  onToggleCards: () => void;
  onNodeSave: (patch: Partial<NodeEditPatch>) => void;
  onCreateGroup: (title: string) => void;
};

export default function LeftSidePanel({
  search,
  statusFilters,
  employeeFilter,
  groups,
  groupFilters,
  nodes,
  settings,
  colorBy,
  editingNode,
  onSearch,
  onStatusFilters,
  onEmployeeFilter,
  onGroupFilters,
  onSettings,
  onResetSettings,
  onFit,
  onReorg,
  onTogglePhysics,
  onToggleCards,
  onNodeSave,
  onCreateGroup,
}: Props) {
  const accent = editingNode ? nodeColor(editingNode, colorBy) : undefined;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--card)]">
      <div
        className={cx(
          "left-panel-top overflow-hidden p-2",
          editingNode ? "shrink-0" : "min-h-0 flex-1",
        )}
        onWheel={handleOverlayWheel}
      >
        <FilterPanel
          nodes={nodes}
          colorBy={colorBy}
          settings={settings}
          search={search}
          statusFilters={statusFilters}
          employeeFilter={employeeFilter}
          groups={groups}
          groupFilters={groupFilters}
          onSearch={onSearch}
          onStatusFilters={onStatusFilters}
          onEmployeeFilter={onEmployeeFilter}
          onGroupFilters={onGroupFilters}
          onSettings={onSettings}
          onResetSettings={onResetSettings}
          onFit={onFit}
          onReorg={onReorg}
          onTogglePhysics={onTogglePhysics}
          onToggleCards={onToggleCards}
        />
      </div>
      {editingNode ? (
        <div
          className={cx(
            "left-panel-bottom flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--line)] bg-[var(--card)]",
            "is-tinted",
          )}
          style={accent ? ({ ["--edit-accent" as string]: accent } as CSSProperties) : undefined}
          onWheel={handleOverlayWheel}
        >
          <EditNodePanel
            key={editingNode.id}
            embedded
            node={editingNode}
            nodes={nodes}
            groups={groups}
            colorBy={colorBy}
            onSave={onNodeSave}
            onCreateGroup={onCreateGroup}
          />
        </div>
      ) : null}
    </div>
  );
}
