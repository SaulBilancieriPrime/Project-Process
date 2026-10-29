import {
  graphGroupSchema,
  graphLinkSchema,
  graphNodeSchema,
  type GraphDocument,
  type GraphGroup,
  type GraphLink,
  type GraphNode,
} from "../schema/graph";

export type VersionMap = Record<string, number>;
export type EntityVersions = { nodes: VersionMap; links: VersionMap; groups: VersionMap };
export type NodePosition = { id: string; x: number; y: number };

export type MapTx = {
  label?: string;
  upsertNodes?: GraphNode[];
  deleteNodeIds?: string[];
  upsertLinks?: GraphLink[];
  deleteLinkIds?: string[];
  upsertGroups?: GraphGroup[];
  deleteGroupIds?: string[];
  positions?: NodePosition[];
  baseVersions?: EntityVersions;
  replace?: GraphDocument;
};

export type ChangeLogEntry = { revision: number; by: string; label: string; at: string; client: string | null };

export type RemoteRow<T> = { item: T; version: number; deleted: boolean; client: string | null };

export type FullMap = {
  kind: "full";
  revision: number;
  you: string | null;
  nodes: GraphNode[];
  links: GraphLink[];
  groups: GraphGroup[];
  versions: EntityVersions;
};

export type MapDelta = {
  kind: "delta";
  revision: number;
  you: string | null;
  nodes: RemoteRow<GraphNode>[];
  links: RemoteRow<GraphLink>[];
  groups: RemoteRow<GraphGroup>[];
  log: ChangeLogEntry[];
};

export type MapFetch = FullMap | MapDelta;

export type TxResult =
  | { ok: true; revision: number; versions: EntityVersions }
  | { ok: false; kind: "conflict"; error: string; nodeIds: string[]; linkIds: string[]; groupIds: string[] }
  | { ok: false; kind: "rejected"; error: string; status: number }
  | { ok: false; kind: "retryable"; error: string; status: number };

export class MapFetchError extends Error {}

const ACTOR_KEY = "project-process.actor";
let clientIdCache: string | null = null;

export function mapActor() {
  try {
    const existing = localStorage.getItem(ACTOR_KEY)?.trim();
    if (existing) return existing;
    const next = `editor-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(ACTOR_KEY, next);
    return next;
  } catch {
    return "editor";
  }
}

/** Identifies this browser tab so its own writes can be recognised in deltas. */
export function mapClientId() {
  clientIdCache ??= crypto.randomUUID();
  return clientIdCache;
}

type RawRow = Record<string, unknown>;

function parseNode(raw: RawRow) {
  const parsed = graphNodeSchema.safeParse(raw);
  return parsed.success ? { ...parsed.data, fx: undefined, fy: undefined } : null;
}

function parseLink(raw: RawRow) {
  const parsed = graphLinkSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseGroup(raw: RawRow) {
  const parsed = graphGroupSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function rows(value: unknown): RawRow[] {
  return Array.isArray(value) ? (value as RawRow[]) : [];
}

export async function fetchMap(since?: number): Promise<MapFetch> {
  const query = since && since > 0 ? `?since=${since}` : "";
  const res = await fetch(`/api/map${query}`);
  const body = (await res.json().catch(() => null)) as RawRow | null;
  if (!res.ok || !body?.ok) {
    throw new MapFetchError(typeof body?.error === "string" ? body.error : `Map request failed (${res.status})`);
  }
  const revision = Number(body.revision) || 0;
  const you = typeof body.you === "string" ? body.you : null;
  if (body.full) {
    const versions: EntityVersions = { nodes: {}, links: {}, groups: {} };
    const nodes = rows(body.nodes).flatMap((raw) => {
      const node = parseNode(raw);
      if (!node) return [];
      versions.nodes[node.id] = Number(raw.version) || 1;
      return [node];
    });
    const links = rows(body.links).flatMap((raw) => {
      const link = parseLink(raw);
      if (!link) return [];
      versions.links[link.id] = Number(raw.version) || 1;
      return [link];
    });
    const groups = rows(body.groups).flatMap((raw) => {
      const group = parseGroup(raw);
      if (!group) return [];
      versions.groups[group.id] = Number(raw.version) || 1;
      return [group];
    });
    return { kind: "full", revision, you, nodes, links, groups, versions };
  }
  const remote = <T>(raw: RawRow, item: T | null): RemoteRow<T>[] =>
    item
      ? [
          {
            item,
            version: Number(raw.version) || 1,
            deleted: Boolean(raw.deleted),
            client: typeof raw.client === "string" ? raw.client : null,
          },
        ]
      : [];
  return {
    kind: "delta",
    revision,
    you,
    nodes: rows(body.nodes).flatMap((raw) => remote(raw, parseNode(raw))),
    links: rows(body.links).flatMap((raw) => remote(raw, parseLink(raw))),
    groups: rows(body.groups).flatMap((raw) => remote(raw, parseGroup(raw))),
    log: rows(body.log).map((raw) => ({
      revision: Number(raw.revision) || 0,
      by: String(raw.by ?? ""),
      label: String(raw.label ?? ""),
      at: String(raw.at ?? ""),
      client: typeof raw.client === "string" ? raw.client : null,
    })),
  };
}

export async function postMapTx(tx: MapTx): Promise<TxResult> {
  let res: Response;
  try {
    const { replace, ...rest } = tx;
    res = await fetch("/api/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rest,
        actor: mapActor(),
        clientId: mapClientId(),
        replace: replace
          ? { nodes: replace.nodes, links: replace.links, groups: replace.groups ?? [], settings: {} }
          : undefined,
      }),
    });
  } catch (err) {
    return { ok: false, kind: "retryable", status: 0, error: err instanceof Error ? err.message : "Network error" };
  }
  const body = (await res.json().catch(() => null)) as RawRow | null;
  const error = typeof body?.error === "string" ? body.error : `Map write failed (${res.status})`;
  if (res.ok && body?.ok) {
    const versions = (body.versions as EntityVersions | undefined) ?? { nodes: {}, links: {}, groups: {} };
    return { ok: true, revision: Number(body.revision) || 0, versions };
  }
  if (res.status === 409 && body?.conflict) {
    return {
      ok: false,
      kind: "conflict",
      error,
      nodeIds: Array.isArray(body.nodeIds) ? body.nodeIds.map(String) : [],
      linkIds: Array.isArray(body.linkIds) ? body.linkIds.map(String) : [],
      groupIds: Array.isArray(body.groupIds) ? body.groupIds.map(String) : [],
    };
  }
  if (res.status === 400 || res.status === 413) return { ok: false, kind: "rejected", status: res.status, error };
  return { ok: false, kind: "retryable", status: res.status, error };
}
