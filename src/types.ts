export type NodeKind = "concept" | "category" | "task" | "info";
export type ColorBy = "level" | "type" | "custom";
export type ArrowStyle = "none" | "one" | "both";
export type LinkKind = "parent" | "cross";

export interface GraphNode {
  id: string;
  title: string;
  description: string;
  level: number;
  parentId?: string | null;
  type: NodeKind;
  color?: string;
  employee?: string;
  employeeEmail?: string;
  size: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  kind: LinkKind;
  arrows: ArrowStyle;
}

export interface GraphSettings {
  physics: boolean;
  charge: number;
  linkDistance: number;
  collide: number;
  radial: boolean;
  colorBy: ColorBy;
  cardInfo: boolean;
  enlarge: number;
}

export interface GraphDocument {
  nodes: GraphNode[];
  links: GraphLink[];
  settings: GraphSettings;
}

export const DEFAULT_SETTINGS: GraphSettings = {
  physics: true,
  charge: -220,
  linkDistance: 56,
  collide: 10,
  radial: true,
  colorBy: "level",
  cardInfo: false,
  enlarge: 1,
};
