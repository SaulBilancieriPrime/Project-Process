import { DEFAULT_SETTINGS, type GraphDocument, type GraphLink, type GraphNode, type NodeKind } from "./types";

export const LIFECYCLE_ORANGE = "#e67e22";

const PURSUIT = "#9333ea";
const DELIVERY = "#ca8a04";
const BUSINESS = "#dc2626";
const LEADERSHIP = "#ea580c";
const ROOT_COLOR = "#64748b";

type WorkflowBranch = {
  id: string;
  title: string;
  color: string;
  workflows: { id: string; title: string; activities: string[] }[];
};

const PRIME_PM_TREE: WorkflowBranch[] = [
  {
    id: "pursuit",
    title: "1.0 Pursuit (Win Work)",
    color: PURSUIT,
    workflows: [
      {
        id: "1.1",
        title: "1.1 Pursue Opportunity",
        activities: [
          "Market Awareness",
          "Lead Identification",
          "Client Engagement",
          "Opportunity Qualification",
          "Go / No-Go Decision",
          "Pursuit Strategy",
        ],
      },
      {
        id: "1.2",
        title: "1.2 Develop Proposal",
        activities: [
          "Scope Development",
          "Fee Development",
          "Schedule Development",
          "Resource Planning",
          "Proposal Writing",
          "Proposal Submission",
          "Proposal Review",
        ],
      },
      {
        id: "1.3",
        title: "1.3 Contract & Risk",
        activities: [
          "Contract Review",
          "Contract Execution",
          "Terms & Conditions",
          "Subconsultant Agreements",
          "Risk Assessment",
          "Insurance Requirements",
          "Legal Coordination",
        ],
      },
    ],
  },
  {
    id: "delivery",
    title: "2.0 Delivery (Deliver Work)",
    color: DELIVERY,
    workflows: [
      {
        id: "2.1",
        title: "2.1 Set Up Project",
        activities: [
          "Project Setup Form",
          "Project Kickoff Preparation",
          "Project Number Creation",
          "Contact List Creation",
          "BST Setup",
          "Team Assignment",
          "File Structure Setup",
        ],
      },
      {
        id: "2.2",
        title: "2.2 Plan Project",
        activities: [
          "Scope Planning",
          "Project Management Plan",
          "WBS Development",
          "Risk Planning",
          "Schedule Development",
          "Budget Planning",
          "Resource Planning",
        ],
      },
      {
        id: "2.3",
        title: "2.3 Execute Project",
        activities: [
          "Deliverable Management",
          "Issue Resolution",
          "Schedule Management",
          "Progress Monitoring",
          "Resource Management",
          "Stakeholder Coordination",
          "Subconsultant Management",
        ],
      },
      {
        id: "2.4",
        title: "2.4 Manage Client",
        activities: [
          "Client Communication",
          "Client Meetings",
          "Expectation Management",
          "Decision Tracking",
          "Action Item Management",
          "Escalation Management",
          "Client Satisfaction",
        ],
      },
      {
        id: "2.5",
        title: "2.5 Manage Quality",
        activities: [
          "QA Planning",
          "QC Reviews",
          "Independent Reviews",
          "Deliverable Compliance",
          "Standards Compliance",
          "Comment Resolution",
          "Quality Documentation",
        ],
      },
      {
        id: "2.6",
        title: "2.6 Manage Changes",
        activities: [
          "Scope Changes",
          "Schedule Changes",
          "Budget Changes",
          "Contract Amendments",
          "Risk Evaluation",
          "Approval Management",
          "Change Documentation",
        ],
      },
      {
        id: "2.7",
        title: "2.7 Close Project",
        activities: [
          "Contract Closeout",
          "Client Feedback",
          "Financial Closeout",
          "Team Debrief",
          "Final Deliverables",
          "Lessons Learned",
          "Archive Project Records",
        ],
      },
    ],
  },
  {
    id: "business",
    title: "3.0 Business (Run the Business)",
    color: BUSINESS,
    workflows: [
      {
        id: "3.1",
        title: "3.1 Manage Financials",
        activities: [
          "Budget Monitoring",
          "ETC Management",
          "Revenue Recognition",
          "Invoicing",
          "Accounts Receivable",
          "Writeups / Writeoffs",
          "Forecasting",
          "Profitability Management",
        ],
      },
      {
        id: "3.2",
        title: "3.2 Manage Risk",
        activities: [
          "Contract Risk",
          "Scope Risk",
          "Schedule Risk",
          "Financial Risk",
          "Technical Risk",
          "Safety Risk",
          "Risk Register Management",
          "Risk Mitigation Planning",
        ],
      },
      {
        id: "3.3",
        title: "3.3 Manage Client Relationships",
        activities: [
          "Strategic Account Planning",
          "Client Retention",
          "Executive Engagement",
          "Client Satisfaction Reviews",
          "Relationship Mapping",
          "Repeat Work Strategy",
          "Cross-Selling Opportunities",
          "Client Development Planning",
        ],
      },
      {
        id: "3.4",
        title: "3.4 Grow the Business",
        activities: [
          "Market Development",
          "Business Development",
          "Opportunity Pipeline",
          "CRM Management",
          "Networking",
          "Brand Representation",
          "Capture Planning",
          "Growth Strategy",
        ],
      },
    ],
  },
  {
    id: "leadership",
    title: "4.0 Leadership (Lead People)",
    color: LEADERSHIP,
    workflows: [
      {
        id: "4.1",
        title: "4.1 Manage Team",
        activities: [
          "Recruiting & Hiring",
          "Workforce Planning",
          "Onboarding",
          "Resource Planning",
          "Performance Management",
          "Employee Development",
          "Recognition & Retention",
          "Succession Planning",
        ],
      },
      {
        id: "4.2",
        title: "4.2 Communication",
        activities: [
          "Team Communication",
          "Client Communication",
          "Meeting Management",
          "Executive Communication",
          "Difficult Conversations",
          "Conflict Resolution",
          "Presentation Skills",
          "Documentation Standards",
        ],
      },
      {
        id: "4.3",
        title: "4.3 Culture",
        activities: [
          "Accountability",
          "Ownership",
          "Collaboration",
          "Professional Development",
          "Business Builder Mindset",
          "Ethics & Integrity",
          "Knowledge Sharing",
          "Continuous Improvement",
        ],
      },
    ],
  },
];

function slug(prefix: string, title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${base}`.slice(0, 64);
}

function node(
  id: string,
  title: string,
  description: string,
  level: number,
  x: number,
  y: number,
  color: string,
  type: NodeKind = "task",
  size = 1.15,
): GraphNode {
  return {
    id,
    title,
    description,
    level,
    parentId: null,
    type,
    color,
    size,
    pinned: false,
    collapsed: false,
    x,
    y,
    fx: x,
    fy: y,
  };
}

function link(source: string, target: string): GraphLink {
  return { id: `${source}->${target}`, source, target, kind: "parent", arrows: "one" };
}

export function createSampleDocument(): GraphDocument {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const rootId = "prime-pm-root";
  const xRoot = 0;
  const xL1 = 300;
  const xL2 = 620;
  const xL3 = 940;
  const row = 52;

  let yCursor = 0;
  const branchYs: number[] = [];

  for (const branch of PRIME_PM_TREE) {
    branchYs.push(yCursor);
    let branchHeight = 0;
    for (const wf of branch.workflows) {
      branchHeight += Math.max(wf.activities.length, 1) * row;
    }
    branchHeight += (branch.workflows.length - 1) * row * 0.35;
    yCursor += branchHeight + row * 2;
  }

  const rootY = (branchYs[0] + (yCursor - row * 2)) / 2;
  nodes.push(
    node(
      rootId,
      "PRIME PM",
      "What activities make up each workflow?",
      0,
      xRoot,
      rootY,
      ROOT_COLOR,
      "concept",
      1.55,
    ),
  );

  yCursor = 0;
  for (const branch of PRIME_PM_TREE) {
    const branchId = branch.id;
    const branchCenterY = yCursor + countBranchHeight(branch, row) / 2;
    nodes.push(
      node(branchId, branch.title, branch.title, 1, xL1, branchCenterY, branch.color, "category", 1.35),
    );
    links.push(link(rootId, branchId));

    let wfY = yCursor;
    for (const wf of branch.workflows) {
      const wfId = wf.id;
      const wfCenterY = wfY + (wf.activities.length * row) / 2 - row / 2;
      nodes.push(node(wfId, wf.title, wf.title, 2, xL2, wfCenterY, branch.color, "task", 1.22));
      links.push(link(branchId, wfId));

      wf.activities.forEach((activity, i) => {
        const actId = slug(wfId, activity);
        const y = wfY + i * row;
        nodes.push(node(actId, activity, activity, 3, xL3, y, branch.color, "info", 1.05));
        links.push(link(wfId, actId));
      });

      wfY += wf.activities.length * row + row * 0.35;
    }

    yCursor += countBranchHeight(branch, row) + row * 2;
  }

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

function countBranchHeight(branch: WorkflowBranch, row: number) {
  let h = 0;
  for (const wf of branch.workflows) {
    h += wf.activities.length * row;
  }
  h += (branch.workflows.length - 1) * row * 0.35;
  return h;
}
