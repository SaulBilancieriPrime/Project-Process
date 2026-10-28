import graphPrimary from "./graphs/project-process-graph-default.json";
import graphSecondary from "./graphs/project-process-graph-hiring.json";
import {
  graphDocumentSchema,
  graphLinkSchema,
  graphNodeSchema,
  parseGraphDocument,
  type GraphDocument,
  type GraphLink,
  type GraphNode,
} from "../schema/graph";
import { markAllNodesIncomplete } from "../graph/workflowStatus";

/** Prefix for the second map so IDs never collide with the primary export. */
const SECONDARY_PREFIX = "copy-hiring:";

/** Primary PM map root ↔ hiring map hub (Applicant). */
const PRIMARY_ROOT_ID = "prime-pm-root";
const SECONDARY_HUB_ID = `${SECONDARY_PREFIX}applicant`;

function nodeXY(node: GraphNode) {
  return { x: node.x ?? 0, y: node.y ?? 0 };
}

function bounds(nodes: GraphNode[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const { x, y } = nodeXY(node);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!nodes.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return { minX, maxX, minY, maxY };
}

function offsetNodes(nodes: GraphNode[], dx: number, dy: number): GraphNode[] {
  return nodes.map((node) =>
    graphNodeSchema.parse({
      ...node,
      x: (node.x ?? 0) + dx,
      y: (node.y ?? 0) + dy,
      fx: node.fx != null ? node.fx + dx : undefined,
      fy: node.fy != null ? node.fy + dy : undefined,
      vx: undefined,
      vy: undefined,
    }),
  );
}

function remapWithPrefix(doc: GraphDocument, prefix: string): GraphDocument {
  const remapId = (id: string | null | undefined) => (id ? `${prefix}${id}` : null);
  return {
    settings: doc.settings,
    nodes: doc.nodes.map((node) =>
      graphNodeSchema.parse({
        ...node,
        id: remapId(node.id)!,
        parentId: remapId(node.parentId),
      }),
    ),
    links: doc.links.flatMap((link) => {
      const parsed = graphLinkSchema.safeParse({
        ...link,
        id: `${prefix}${link.id}`,
        source: remapId(link.source as string),
        target: remapId(link.target as string),
      });
      return parsed.success ? [parsed.data] : [];
    }),
  };
}

function bridgeNode(x: number, y: number): GraphNode {
  return graphNodeSchema.parse({
    id: "merged-map-bridge",
    title: "Map link",
    description: "Connects both imported graphs",
    level: 0,
    parentId: null,
    type: "info",
    color: "#12a8b8",
    employee: "",
    employeeEmail: "",
    size: 1.25,
    x,
    y,
  });
}

function bridgeLinks(leftRootId: string, rightRootId: string): GraphLink[] {
  const bridgeId = "merged-map-bridge";
  return [
    graphLinkSchema.parse({ id: "bridge-left", source: leftRootId, target: bridgeId, kind: "cross", arrows: "none" }),
    graphLinkSchema.parse({ id: "bridge-right", source: bridgeId, target: rightRootId, kind: "cross", arrows: "none" }),
  ];
}

export function createMergedGraphDocument(): GraphDocument {
  const left = parseGraphDocument(graphPrimary);
  const secondary = remapWithPrefix(parseGraphDocument(graphSecondary), SECONDARY_PREFIX);

  const leftBox = bounds(left.nodes);
  const rightBox = bounds(secondary.nodes);
  const gap = 280;
  const dx = leftBox.maxX - rightBox.minX + gap;
  const dy = (leftBox.minY + leftBox.maxY) / 2 - (rightBox.minY + rightBox.maxY) / 2;
  const shiftedSecondary = offsetNodes(secondary.nodes, dx, dy);

  const bridgeX = leftBox.maxX + gap / 2;
  const bridgeY = (leftBox.minY + leftBox.maxY) / 2;
  const bridge = bridgeNode(bridgeX, bridgeY);

  const hasSecondaryHub = shiftedSecondary.some((n) => n.id === SECONDARY_HUB_ID);
  const rightAnchor = hasSecondaryHub
    ? SECONDARY_HUB_ID
    : (shiftedSecondary.find((n) => n.type === "concept")?.id ?? shiftedSecondary[0]?.id);

  return markAllNodesIncomplete(
    graphDocumentSchema.parse({
      settings: {
        ...left.settings,
        physics: false,
        radial: false,
        charge: Math.min(-40, left.settings.charge ?? -320),
        linkDistance: Math.max(80, left.settings.linkDistance ?? 96),
        collide: Math.max(12, left.settings.collide ?? 14),
      },
      nodes: [...left.nodes, ...shiftedSecondary, bridge],
      links: [
        ...left.links,
        ...secondary.links,
        ...(rightAnchor ? bridgeLinks(PRIMARY_ROOT_ID, rightAnchor) : []),
      ],
    }),
  );
}
