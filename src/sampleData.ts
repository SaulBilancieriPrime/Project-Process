import { LEVEL_COLORS } from "./graph/colors";
import { DEFAULT_SETTINGS, type GraphDocument, type GraphLink, type GraphNode, type NodeKind } from "./types";

const SAMPLE_RED = LEVEL_COLORS[0];

type WorkflowBranch = {
  id: string;
  title: string;
  workflows: { id: string; title: string }[];
};

const MAJOR_WORKFLOWS: WorkflowBranch[] = [
  {
    id: "pursuit",
    title: "1.0 Pursuit (Win Work)",
    workflows: [
      { id: "1.1", title: "1.1 Pursue Opportunity" },
      { id: "1.2", title: "1.2 Develop Proposal" },
      { id: "1.3", title: "1.3 Contract & Risk" },
    ],
  },
  {
    id: "delivery",
    title: "2.0 Delivery (Deliver Work)",
    workflows: [
      { id: "2.1", title: "2.1 Set Up Project" },
      { id: "2.2", title: "2.2 Plan Project" },
      { id: "2.3", title: "2.3 Execute Project" },
      { id: "2.4", title: "2.4 Manage Client" },
      { id: "2.5", title: "2.5 Manage Quality" },
      { id: "2.6", title: "2.6 Manage Changes" },
      { id: "2.7", title: "2.7 Close Project" },
    ],
  },
  {
    id: "business",
    title: "3.0 Business (Run the Business)",
    workflows: [
      { id: "3.1", title: "3.1 Manage Financials" },
      { id: "3.2", title: "3.2 Manage Risk" },
      { id: "3.3", title: "3.3 Manage Client Relationships" },
      { id: "3.4", title: "3.4 Grow the Business" },
    ],
  },
  {
    id: "leadership",
    title: "4.0 Leadership (Lead People)",
    workflows: [
      { id: "4.1", title: "4.1 Manage Team" },
      { id: "4.2", title: "4.2 Communication" },
      { id: "4.3", title: "4.3 Culture" },
    ],
  },
];

function node(
  id: string,
  title: string,
  description: string,
  level: number,
  parentId: string | null,
  x: number,
  y: number,
  type: NodeKind,
  size: number,
): GraphNode {
  return {
    id,
    title,
    description,
    level,
    parentId,
    type,
    color: SAMPLE_RED,
    employee: "",
    size,
    x,
    y,
  };
}

function link(source: string, target: string): GraphLink {
  return { id: `${source}->${target}`, source, target, kind: "parent", arrows: "one" };
}

function branchHeight(branch: WorkflowBranch, row: number) {
  return Math.max(branch.workflows.length, 1) * row;
}

export function createSampleDocument(): GraphDocument {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const rootId = "prime-pm-root";
  const xRoot = 0;
  const xL1 = 280;
  const xL2 = 580;
  const row = 56;
  const gap = row * 1.6;

  let yCursor = 0;
  const starts: number[] = [];
  for (const branch of MAJOR_WORKFLOWS) {
    starts.push(yCursor);
    yCursor += branchHeight(branch, row) + gap;
  }
  const rootY = (starts[0] + (yCursor - gap)) / 2;

  nodes.push(
    node(
      rootId,
      "PRIME PM",
      "What are the major workflows?",
      0,
      null,
      xRoot,
      rootY,
      "concept",
      1.55,
    ),
  );

  MAJOR_WORKFLOWS.forEach((branch, index) => {
    const height = branchHeight(branch, row);
    const branchY = starts[index] + height / 2 - row / 2;
    nodes.push(node(branch.id, branch.title, branch.title, 1, rootId, xL1, branchY, "category", 1.35));
    links.push(link(rootId, branch.id));

    branch.workflows.forEach((wf, i) => {
      const y = starts[index] + i * row;
      nodes.push(node(wf.id, wf.title, wf.title, 2, branch.id, xL2, y, "task", 1.18));
      links.push(link(branch.id, wf.id));
    });
  });

  return {
    nodes,
    links,
    settings: {
      ...DEFAULT_SETTINGS,
      physics: false,
      radial: false,
      colorBy: "custom",
      enlarge: 1.05,
      cardInfo: false,
    },
  };
}
