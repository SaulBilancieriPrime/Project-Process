import { DEFAULT_SETTINGS, type GraphDocument, type GraphLink, type GraphNode, type NodeKind } from "./types";

export const LIFECYCLE_ORANGE = "#e67e22";
const HIRE = "#5b9bd5";
const SOURCE = "#8b5cf6";
const WORK = "#e67e22";
const GROW = "#34d399";
const RISK = "#f43f5e";
const EXIT = "#94a3b8";

function dot(
  id: string,
  title: string,
  description: string,
  x: number,
  y: number,
  color: string,
  type: NodeKind = "task",
  size = 1.25,
): GraphNode {
  return {
    id,
    title,
    description,
    level: 1,
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

function arrow(source: string, target: string, kind: GraphLink["kind"] = "parent"): GraphLink {
  return { id: `${source}->${target}`, source, target, kind, arrows: "one" };
}

const STAGES: { id: string; title: string; description: string }[] = [
  { id: "long-lead", title: "Long lead", description: "Capture every opportunity and all related intelligence." },
  { id: "positioning", title: "Positioning & Go/No-go", description: "Leverage experience and insight to decide where to play." },
  { id: "proposal", title: "Proposal Development", description: "Build smarter proposals with the right content, people, and partners." },
  { id: "shortlist", title: "Shortlist & Selection", description: "Strengthen client relationships and positioning through selection." },
  { id: "negotiation", title: "Negotiation & Award", description: "Negotiate effectively and transition seamlessly to project setup." },
  { id: "setup", title: "Project Setup", description: "Stand up the project accurately and efficiently the first time." },
  { id: "staffing", title: "Staffing", description: "Find and engage the right people and partners for successful delivery." },
  { id: "execution", title: "Execution", description: "Deliver quality work. Manage performance, risk, and changes in real time." },
  { id: "invoice", title: "Invoice & Billing", description: "Bill accurately and promptly with full visibility into status." },
  { id: "collect", title: "Collect", description: "Accelerate cash collection and manage AR proactively." },
  { id: "closeout", title: "Closeout", description: "Close projects cleanly and capture final performance data." },
  { id: "knowledge", title: "Institutional Knowledge", description: "Capture lessons, insights, and intelligence to fuel the next opportunity." },
];

export function createSampleDocument(): GraphDocument {
  const loopCx = 3180;
  const loopCy = 40;
  const loopR = 250;
  const lifecycle = STAGES.map((stage, i) => {
    const angle = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
    return dot(
      stage.id,
      stage.title,
      stage.description,
      loopCx + Math.cos(angle) * loopR,
      loopCy + Math.sin(angle) * loopR,
      LIFECYCLE_ORANGE,
      "task",
      1.4,
    );
  });

  const y = 0;
  const hire: GraphNode[] = [
    dot("pm-req", "PM requisition", "Project manager requests a requisition to open a seat.", 0, y, HIRE, "task", 1.35),
    dot("ta", "Talent acquisition", "TA posts the role and works the market.", 180, y, HIRE),
    dot("source-referral", "Referral", "Someone known refers a candidate.", 360, y - 150, SOURCE, "info", 1.1),
    dot("source-board", "Job board", "Public posting brings a candidate in.", 360, y, SOURCE, "info", 1.15),
    dot("source-agency", "Agency", "A search partner submits a candidate.", 360, y + 150, SOURCE, "info", 1.1),
    dot("source", "Source", "The true origin of this process — where the person actually enters.", 560, y, SOURCE, "category", 1.45),
    dot("applicant", "Applicant", "A person is now in the hiring process.", 760, y, HIRE, "concept", 1.35),
    dot("recruiter-screen", "Recruiter screen", "TA reviews fit, pay, and interest.", 960, y, HIRE),
    dot("hm-review", "Hiring manager review", "The PM / hiring manager decides decline or move forward.", 1180, y, HIRE, "task", 1.35),
    dot("decline", "Decline", "Hiring manager passes. Process ends for this applicant.", 1180, y + 170, EXIT, "info", 1.1),
    dot("move-forward", "Move forward", "Hiring manager wants to meet them.", 1400, y, HIRE),
    dot("phone-screen", "Phone screen", "Optional first live conversation.", 1600, y - 150, HIRE, "task", 1.15),
    dot("first-interview", "First interview", "Hiring manager can start here instead of a phone call.", 1600, y + 150, HIRE, "task", 1.15),
    dot("further-interview", "Further interview", "Next round — panel, technical, or leadership.", 1820, y, HIRE),
    dot("offer", "Offer", "Compensation, start date, and written offer.", 2020, y, HIRE),
    dot("onboard", "Hired / onboard", "They accept and join the firm.", 2220, y, WORK, "task", 1.35),
    dot("work-under-pm", "Work under PM", "They deliver work under their project manager.", 2440, y, WORK, "category", 1.5),
    dot("perf-review", "Annual performance review", "Yearly review of goals, delivery, and feedback.", 2440, y - 170, GROW),
    dot("raise", "Annual raise / salary adjustment", "Comp moves with performance and market.", 2660, y - 170, GROW),
    dot("promotion", "Promotion", "They move up in role or level.", 2660, y, GROW, "task", 1.3),
    dot("become-pm", "Become project manager", "They take a PM seat and run the delivery loop.", 2880, y, WORK, "category", 1.45),
    dot("retire", "Retire", "They leave the firm at the end of a career.", 2440, y + 170, EXIT, "info"),
    dot("leave", "Leave", "They resign or otherwise exit.", 2660, y + 170, EXIT, "info"),
    dot("pip", "Performance improvement plan", "HR puts them on a PIP after performance issues.", 2440, y + 320, RISK, "task"),
    dot("misconduct", "Misconduct warning", "HR issues a warning before termination.", 2660, y + 320, RISK, "task"),
    dot("fired", "Fired", "Employment ends for performance or misconduct.", 2880, y + 320, RISK, "info", 1.2),
  ];

  const nodes = [...hire, ...lifecycle];

  const links: GraphLink[] = [
    arrow("pm-req", "ta"),
    arrow("ta", "source-referral"),
    arrow("ta", "source-board"),
    arrow("ta", "source-agency"),
    arrow("source-referral", "source"),
    arrow("source-board", "source"),
    arrow("source-agency", "source"),
    arrow("source", "applicant"),
    arrow("applicant", "recruiter-screen"),
    arrow("recruiter-screen", "hm-review"),
    arrow("hm-review", "decline"),
    arrow("hm-review", "move-forward"),
    arrow("move-forward", "phone-screen"),
    arrow("move-forward", "first-interview"),
    arrow("phone-screen", "further-interview"),
    arrow("first-interview", "further-interview"),
    arrow("further-interview", "offer"),
    arrow("offer", "onboard"),
    arrow("onboard", "work-under-pm"),
    arrow("work-under-pm", "perf-review"),
    arrow("work-under-pm", "raise"),
    arrow("work-under-pm", "promotion"),
    arrow("work-under-pm", "become-pm"),
    arrow("work-under-pm", "retire"),
    arrow("work-under-pm", "leave"),
    arrow("work-under-pm", "pip"),
    arrow("work-under-pm", "misconduct"),
    arrow("perf-review", "work-under-pm", "cross"),
    arrow("perf-review", "raise"),
    arrow("perf-review", "pip"),
    arrow("raise", "work-under-pm", "cross"),
    arrow("promotion", "work-under-pm", "cross"),
    arrow("promotion", "become-pm"),
    arrow("become-pm", "pm-req", "cross"),
    arrow("become-pm", "long-lead"),
    arrow("pip", "work-under-pm", "cross"),
    arrow("pip", "fired"),
    arrow("misconduct", "work-under-pm", "cross"),
    arrow("misconduct", "fired"),
    ...STAGES.map((stage, i) => {
      const next = STAGES[(i + 1) % STAGES.length];
      return arrow(stage.id, next.id);
    }),
  ];

  return {
    nodes,
    links,
    settings: {
      ...DEFAULT_SETTINGS,
      physics: false,
      radial: false,
      colorBy: "custom",
      enlarge: 1.1,
      cardInfo: false,
    },
  };
}
