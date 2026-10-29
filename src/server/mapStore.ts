import { createSampleDocument } from "../sampleData";
import { parseGraphDocument, type GraphDocument, type GraphGroup, type GraphLink, type GraphNode } from "../schema/graph";
import { MAP_SCHEMA, sql, sqlPool } from "./azureSql";

type SqlRequest = any;
type SqlTransaction = any;
type SqlPool = any;
type Row = Record<string, unknown>;

export type VersionMap = Record<string, number>;
export type EntityVersions = { nodes: VersionMap; links: VersionMap; groups: VersionMap };

export type NodePosition = { id: string; x: number; y: number };

export type MapTxInput = {
  actor?: string;
  clientId?: string;
  label?: string;
  upsertNodes?: GraphNode[];
  deleteNodeIds?: string[];
  upsertLinks?: GraphLink[];
  deleteLinkIds?: string[];
  upsertGroups?: GraphGroup[];
  deleteGroupIds?: string[];
  positions?: NodePosition[];
  baseVersions?: Partial<EntityVersions>;
  replace?: GraphDocument;
};

export type MapTxResult = { revision: number; versions: EntityVersions };

export type SharedNodeRow = GraphNode & { version: number };
export type SharedLinkRow = GraphLink & { version: number };
export type SharedGroupRow = GraphGroup & { version: number };

export type SharedMap = {
  revision: number;
  nodes: SharedNodeRow[];
  links: SharedLinkRow[];
  groups: SharedGroupRow[];
};

export type DeltaRow<T> = T & { version: number; deleted: boolean; client: string | null };

export type ChangeLogEntry = { revision: number; by: string; label: string; at: string; client: string | null };

export type MapDelta = {
  revision: number;
  nodes: DeltaRow<GraphNode>[];
  links: DeltaRow<GraphLink>[];
  groups: DeltaRow<GraphGroup>[];
  log: ChangeLogEntry[];
};

export class MapConflictError extends Error {
  constructor(
    readonly nodeIds: string[],
    readonly linkIds: string[],
    readonly groupIds: string[] = [],
  ) {
    super("Map write conflict");
  }
}

const S = MAP_SCHEMA;
const GROUP = `${S}.[Group]`;
const DELTA_ROW_LIMIT = 2000;
const DELTA_LOG_LIMIT = 50;
const CHANGELOG_RETENTION_DAYS = 90;
const RETENTION_SWEEP_MS = 6 * 60 * 60 * 1000;

let lastRetentionSweep = 0;

function actorName(value?: string) {
  const next = (value ?? "").trim();
  return (next || "editor").slice(0, 200);
}

function clientName(value?: string) {
  const next = (value ?? "").trim();
  return next ? next.slice(0, 64) : null;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function linkEnds(link: GraphLink) {
  const source = typeof link.source === "string" ? link.source : String(link.source);
  const target = typeof link.target === "string" ? link.target : String(link.target);
  return { source, target };
}

function nodeJson(node: GraphNode) {
  return {
    id: node.id.slice(0, 160),
    title: (node.title || "Untitled").slice(0, 400),
    description: node.description ?? "",
    level: Math.trunc(node.level ?? 0),
    parentId: node.parentId ? String(node.parentId).slice(0, 160) : null,
    type: (node.type || "concept").slice(0, 20),
    color: node.color ? node.color.slice(0, 32) : null,
    employee: (node.employee ?? "").slice(0, 200),
    employeeEmail: (node.employeeEmail ?? "").slice(0, 200),
    size: finite(node.size) ?? 1,
    groupId: node.groupId ? String(node.groupId).slice(0, 160) : null,
    x: finite(node.x),
    y: finite(node.y),
  };
}

function groupJson(group: GraphGroup) {
  return {
    id: group.id.slice(0, 160),
    title: (group.title || "Untitled group").slice(0, 400),
  };
}

function linkJson(link: GraphLink) {
  const ends = linkEnds(link);
  return {
    id: (link.id || `${ends.source}->${ends.target}`).slice(0, 160),
    source: ends.source.slice(0, 160),
    target: ends.target.slice(0, 160),
    kind: (link.kind || "parent").slice(0, 20),
    arrows: (link.arrows || "none").slice(0, 20),
  };
}

function rowNode(row: Row): GraphNode {
  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled"),
    description: String(row.description ?? ""),
    level: Number(row.level ?? 0),
    parentId: row.parent_id == null ? null : String(row.parent_id),
    type: (row.type as GraphNode["type"]) || "concept",
    color: row.color == null ? undefined : String(row.color),
    employee: String(row.employee ?? ""),
    employeeEmail: String(row.employee_email ?? ""),
    size: Number(row.size ?? 1),
    groupId: row.group_id == null ? null : String(row.group_id),
    x: row.x == null ? undefined : Number(row.x),
    y: row.y == null ? undefined : Number(row.y),
  };
}

function rowGroup(row: Row): GraphGroup {
  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled group"),
  };
}

function rowLink(row: Row): GraphLink {
  return {
    id: String(row.id),
    source: String(row.source_id),
    target: String(row.target_id),
    kind: (row.kind as GraphLink["kind"]) || "parent",
    arrows: (row.arrows as GraphLink["arrows"]) || "none",
  };
}

function versionsFrom(rows: Row[]): VersionMap {
  const out: VersionMap = {};
  for (const row of rows) out[String(row.id)] = Number(row.version);
  return out;
}

async function readRevision(req: SqlRequest) {
  const result = await req.query(`SELECT revision FROM ${S}.Map WHERE id = 1`);
  return Number(result.recordset[0]?.revision ?? 0);
}

async function ensureMapRow(pool: SqlPool, actor: string) {
  const req = pool.request();
  req.input("updated_at", sql.DateTime2, new Date());
  req.input("updated_by", sql.NVarChar(200), actor);
  await req.query(`
    IF NOT EXISTS (SELECT 1 FROM ${S}.Map WHERE id = 1)
    INSERT INTO ${S}.Map (id, revision, updated_at, updated_by)
    VALUES (1, 0, @updated_at, @updated_by)
  `);
}

async function bumpRevision(req: SqlRequest, actor: string, now: Date) {
  req.input("updated_by", sql.NVarChar(200), actor);
  req.input("updated_at", sql.DateTime2, now);
  const result = await req.query(`
    UPDATE ${S}.Map
    SET revision = revision + 1, updated_at = @updated_at, updated_by = @updated_by
    OUTPUT INSERTED.revision
    WHERE id = 1
  `);
  return Number(result.recordset[0]?.revision ?? 0);
}

type Stamp = { revision: number; actor: string; client: string | null; now: Date };

function stampInputs(req: SqlRequest, stamp: Stamp) {
  req.input("rev", sql.BigInt, stamp.revision);
  req.input("client", sql.NVarChar(64), stamp.client);
  req.input("updated_at", sql.DateTime2, stamp.now);
  req.input("updated_by", sql.NVarChar(200), stamp.actor);
  return req;
}

async function writeLog(req: SqlRequest, stamp: Stamp, action: string, payload: unknown) {
  req.input("log_revision", sql.BigInt, stamp.revision);
  req.input("log_at", sql.DateTime2, stamp.now);
  req.input("log_by", sql.NVarChar(200), stamp.actor);
  req.input("log_action", sql.NVarChar(40), action.slice(0, 40));
  req.input("log_payload", sql.NVarChar(sql.MAX), JSON.stringify({ client: stamp.client, ...(payload as object) }));
  await req.query(`
    INSERT INTO ${S}.ChangeLog (revision, changed_at, changed_by, action, target, target_id, payload_json)
    VALUES (@log_revision, @log_at, @log_by, @log_action, N'map', N'1', @log_payload)
  `);
}

function tableSql(table: "Node" | "Link" | "Group") {
  return table === "Group" ? GROUP : `${S}.${table}`;
}

function isMissingGroupTable(err: unknown) {
  const anyErr = err as { number?: number; message?: string };
  return anyErr?.number === 208 || /Invalid object name.*Group/i.test(String(anyErr?.message ?? err ?? ""));
}

async function queryGroupRows(req: SqlRequest, text: string) {
  try {
    return await req.query(text);
  } catch (err) {
    if (isMissingGroupTable(err)) return { recordset: [] as Row[] };
    throw err;
  }
}

async function findConflicts(tx: SqlTransaction, table: "Node" | "Link" | "Group", ids: string[], base: VersionMap) {
  if (!ids.length) return [];
  const req = tx.request();
  req.input("ids", sql.NVarChar(sql.MAX), JSON.stringify(ids));
  const result = await req.query(`
    SELECT t.id, t.version
    FROM ${tableSql(table)} AS t WITH (UPDLOCK, HOLDLOCK)
    JOIN OPENJSON(@ids) AS j ON t.id = CAST(j.value AS nvarchar(160))
  `);
  const actual = versionsFrom(result.recordset);
  return ids.filter((id) => (actual[id] ?? 0) !== (base[id] ?? 0));
}

async function upsertNodes(tx: SqlTransaction, nodes: GraphNode[], stamp: Stamp): Promise<VersionMap> {
  if (!nodes.length) return {};
  const req = stampInputs(tx.request(), stamp);
  req.input("rows", sql.NVarChar(sql.MAX), JSON.stringify(nodes.map(nodeJson)));
  const result = await req.query(`
    MERGE ${S}.Node WITH (HOLDLOCK) AS t
    USING (
      SELECT * FROM OPENJSON(@rows) WITH (
        id nvarchar(160) '$.id',
        title nvarchar(400) '$.title',
        description nvarchar(max) '$.description',
        level int '$.level',
        parent_id nvarchar(160) '$.parentId',
        type nvarchar(20) '$.type',
        color nvarchar(32) '$.color',
        employee nvarchar(200) '$.employee',
        employee_email nvarchar(200) '$.employeeEmail',
        size float '$.size',
        group_id nvarchar(160) '$.groupId',
        x float '$.x',
        y float '$.y'
      )
    ) AS s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET
      title = s.title, description = s.description, level = s.level, parent_id = s.parent_id,
      type = s.type, color = s.color, employee = s.employee, employee_email = s.employee_email,
      size = s.size, group_id = s.group_id, x = s.x, y = s.y, version = t.version + 1, is_deleted = 0,
      updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by
    WHEN NOT MATCHED THEN INSERT (
      id, title, description, level, parent_id, type, color, employee, employee_email,
      size, group_id, x, y, version, is_deleted, updated_rev, updated_client, updated_at, updated_by
    ) VALUES (
      s.id, s.title, s.description, s.level, s.parent_id, s.type, s.color, s.employee, s.employee_email,
      s.size, s.group_id, s.x, s.y, 1, 0, @rev, @client, @updated_at, @updated_by
    )
    OUTPUT INSERTED.id, INSERTED.version;
  `);
  return versionsFrom(result.recordset);
}

async function upsertLinks(tx: SqlTransaction, links: GraphLink[], stamp: Stamp): Promise<VersionMap> {
  if (!links.length) return {};
  const req = stampInputs(tx.request(), stamp);
  req.input("rows", sql.NVarChar(sql.MAX), JSON.stringify(links.map(linkJson)));
  const result = await req.query(`
    MERGE ${S}.Link WITH (HOLDLOCK) AS t
    USING (
      SELECT * FROM OPENJSON(@rows) WITH (
        id nvarchar(160) '$.id',
        source_id nvarchar(160) '$.source',
        target_id nvarchar(160) '$.target',
        kind nvarchar(20) '$.kind',
        arrows nvarchar(20) '$.arrows'
      )
    ) AS s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET
      source_id = s.source_id, target_id = s.target_id, kind = s.kind, arrows = s.arrows,
      version = t.version + 1, is_deleted = 0,
      updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by
    WHEN NOT MATCHED THEN INSERT (
      id, source_id, target_id, kind, arrows, version, is_deleted, updated_rev, updated_client, updated_at, updated_by
    ) VALUES (
      s.id, s.source_id, s.target_id, s.kind, s.arrows, 1, 0, @rev, @client, @updated_at, @updated_by
    )
    OUTPUT INSERTED.id, INSERTED.version;
  `);
  return versionsFrom(result.recordset);
}

async function upsertGroups(tx: SqlTransaction, groups: GraphGroup[], stamp: Stamp): Promise<VersionMap> {
  if (!groups.length) return {};
  const req = stampInputs(tx.request(), stamp);
  req.input("rows", sql.NVarChar(sql.MAX), JSON.stringify(groups.map(groupJson)));
  const result = await req.query(`
    MERGE ${GROUP} WITH (HOLDLOCK) AS t
    USING (
      SELECT * FROM OPENJSON(@rows) WITH (
        id nvarchar(160) '$.id',
        title nvarchar(400) '$.title'
      )
    ) AS s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET
      title = s.title, version = t.version + 1, is_deleted = 0,
      updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by
    WHEN NOT MATCHED THEN INSERT (
      id, title, version, is_deleted, updated_rev, updated_client, updated_at, updated_by
    ) VALUES (
      s.id, s.title, 1, 0, @rev, @client, @updated_at, @updated_by
    )
    OUTPUT INSERTED.id, INSERTED.version;
  `);
  return versionsFrom(result.recordset);
}

async function softDelete(tx: SqlTransaction, table: "Node" | "Link" | "Group", ids: string[], stamp: Stamp): Promise<VersionMap> {
  if (!ids.length) return {};
  const req = stampInputs(tx.request(), stamp);
  req.input("ids", sql.NVarChar(sql.MAX), JSON.stringify(ids));
  const result = await req.query(`
    UPDATE t SET
      is_deleted = 1, version = t.version + 1,
      updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by
    OUTPUT INSERTED.id, INSERTED.version
    FROM ${tableSql(table)} AS t
    JOIN OPENJSON(@ids) AS j ON t.id = CAST(j.value AS nvarchar(160))
    WHERE t.is_deleted = 0
  `);
  return versionsFrom(result.recordset);
}

async function sweepEmptyGroups(tx: SqlTransaction, stamp: Stamp): Promise<VersionMap> {
  const req = stampInputs(tx.request(), stamp);
  try {
    const result = await req.query(`
      UPDATE g SET
        is_deleted = 1, version = g.version + 1,
        updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by
      OUTPUT INSERTED.id, INSERTED.version
      FROM ${GROUP} AS g
      WHERE g.is_deleted = 0
        AND NOT EXISTS (
          SELECT 1 FROM ${S}.Node AS n
          WHERE n.group_id = g.id AND n.is_deleted = 0
        )
    `);
    return versionsFrom(result.recordset);
  } catch (err) {
    if (isMissingGroupTable(err)) return {};
    throw err;
  }
}

async function movePositions(tx: SqlTransaction, positions: NodePosition[], stamp: Stamp) {
  if (!positions.length) return;
  const req = stampInputs(tx.request(), stamp);
  req.input("rows", sql.NVarChar(sql.MAX), JSON.stringify(positions));
  await req.query(`
    UPDATE t SET
      x = j.x, y = j.y,
      updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by
    FROM ${S}.Node AS t
    JOIN OPENJSON(@rows) WITH (id nvarchar(160) '$.id', x float '$.x', y float '$.y') AS j ON t.id = j.id
    WHERE t.is_deleted = 0
  `);
}

async function sweepChangeLog(pool: SqlPool) {
  if (Date.now() - lastRetentionSweep < RETENTION_SWEEP_MS) return;
  lastRetentionSweep = Date.now();
  try {
    const req = pool.request();
    req.input("days", sql.Int, CHANGELOG_RETENTION_DAYS);
    await req.query(`DELETE FROM ${S}.ChangeLog WHERE changed_at < DATEADD(day, -@days, SYSUTCDATETIME())`);
  } catch (err) {
    console.error("[mapStore] ChangeLog retention sweep failed", err);
  }
}

export async function loadSharedMap(): Promise<SharedMap> {
  const pool = await sqlPool();
  await ensureMapRow(pool, "seed");
  const count = await pool.request().query(`SELECT COUNT(*) AS n FROM ${S}.Node WHERE is_deleted = 0`);
  if (!Number(count.recordset[0]?.n)) {
    await applyMapTx({ actor: "seed", label: "Seeded shared map", replace: createSampleDocument() });
  }
  const [map, nodes, links, groups] = await Promise.all([
    pool.request().query(`SELECT revision FROM ${S}.Map WHERE id = 1`),
    pool.request().query(`SELECT * FROM ${S}.Node WHERE is_deleted = 0`),
    pool.request().query(`SELECT * FROM ${S}.Link WHERE is_deleted = 0`),
    queryGroupRows(pool.request(), `SELECT * FROM ${GROUP} WHERE is_deleted = 0`),
  ]);
  const doc = parseGraphDocument({
    nodes: nodes.recordset.map(rowNode),
    links: links.recordset.map(rowLink),
    groups: groups.recordset.map(rowGroup),
  });
  const nodeVersions = versionsFrom(nodes.recordset);
  const linkVersions = versionsFrom(links.recordset);
  const groupVersions = versionsFrom(groups.recordset);
  return {
    revision: Number(map.recordset[0]?.revision ?? 0),
    nodes: doc.nodes.map((n) => ({ ...n, version: nodeVersions[n.id] ?? 1 })),
    links: doc.links.map((l) => ({ ...l, version: linkVersions[l.id] ?? 1 })),
    groups: doc.groups.map((g) => ({ ...g, version: groupVersions[g.id] ?? 1 })),
  };
}

export async function mapRevision(): Promise<number> {
  const pool = await sqlPool();
  return readRevision(pool.request());
}

/** Returns null when the caller should do a full reload instead. */
export async function loadMapDelta(since: number): Promise<MapDelta | null> {
  const pool = await sqlPool();
  const revision = await readRevision(pool.request());
  if (since > revision) return null;
  if (since === revision) return { revision, nodes: [], links: [], groups: [], log: [] };
  const withSince = () => {
    const req = pool.request();
    req.input("since", sql.BigInt, since);
    return req;
  };
  const [nodes, links, groups, log] = await Promise.all([
    withSince().query(`SELECT TOP (${DELTA_ROW_LIMIT + 1}) * FROM ${S}.Node WHERE updated_rev > @since`),
    withSince().query(`SELECT TOP (${DELTA_ROW_LIMIT + 1}) * FROM ${S}.Link WHERE updated_rev > @since`),
    queryGroupRows(withSince(), `SELECT TOP (${DELTA_ROW_LIMIT + 1}) * FROM ${GROUP} WHERE updated_rev > @since`),
    withSince().query(`
      SELECT TOP (${DELTA_LOG_LIMIT}) revision, changed_at, changed_by, action, payload_json
      FROM ${S}.ChangeLog WHERE revision > @since ORDER BY revision
    `),
  ]);
  if (
    nodes.recordset.length > DELTA_ROW_LIMIT ||
    links.recordset.length > DELTA_ROW_LIMIT ||
    groups.recordset.length > DELTA_ROW_LIMIT
  ) {
    return null;
  }
  return {
    revision,
    nodes: nodes.recordset.map((row: Row) => ({
      ...rowNode(row),
      version: Number(row.version),
      deleted: Boolean(row.is_deleted),
      client: row.updated_client == null ? null : String(row.updated_client),
    })),
    links: links.recordset.map((row: Row) => ({
      ...rowLink(row),
      version: Number(row.version),
      deleted: Boolean(row.is_deleted),
      client: row.updated_client == null ? null : String(row.updated_client),
    })),
    groups: groups.recordset.map((row: Row) => ({
      ...rowGroup(row),
      version: Number(row.version),
      deleted: Boolean(row.is_deleted),
      client: row.updated_client == null ? null : String(row.updated_client),
    })),
    log: log.recordset.map((row: Row) => {
      let client: string | null = null;
      try {
        const payload = JSON.parse(String(row.payload_json ?? "{}")) as { client?: unknown };
        client = typeof payload.client === "string" ? payload.client : null;
      } catch {
        /* legacy payload */
      }
      return {
        revision: Number(row.revision),
        by: String(row.changed_by ?? ""),
        label: String(row.action ?? ""),
        at: new Date(row.changed_at as string).toISOString(),
        client,
      };
    }),
  };
}

export async function applyMapTx(input: MapTxInput): Promise<MapTxResult> {
  const actor = actorName(input.actor);
  const pool = await sqlPool();
  await ensureMapRow(pool, actor);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const now = new Date();
    const revision = await bumpRevision(tx.request(), actor, now);
    const stamp: Stamp = { revision, actor, client: clientName(input.clientId), now };

    if (input.replace) {
      const doc = parseGraphDocument(input.replace);
      const wipe = stampInputs(tx.request(), stamp);
      await wipe.query(`
        UPDATE ${S}.Node SET is_deleted = 1, version = version + 1, updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by WHERE is_deleted = 0;
        UPDATE ${S}.Link SET is_deleted = 1, version = version + 1, updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by WHERE is_deleted = 0;
      `);
      try {
        const wipeGroups = stampInputs(tx.request(), stamp);
        await wipeGroups.query(`
          UPDATE ${GROUP} SET is_deleted = 1, version = version + 1, updated_rev = @rev, updated_client = @client, updated_at = @updated_at, updated_by = @updated_by WHERE is_deleted = 0;
        `);
      } catch (err) {
        if (!isMissingGroupTable(err)) throw err;
      }
      const nodes = await upsertNodes(tx, uniqueById(doc.nodes), stamp);
      const links = await upsertLinks(tx, uniqueById(doc.links), stamp);
      const groups = await upsertGroups(tx, uniqueById(doc.groups), stamp);
      await writeLog(tx.request(), stamp, input.label || "replace", {
        nodes: doc.nodes.length,
        links: doc.links.length,
        groups: doc.groups.length,
      });
      await tx.commit();
      void sweepChangeLog(pool);
      return { revision, versions: { nodes, links, groups } };
    }

    const upNodes = uniqueById(input.upsertNodes ?? []);
    const upLinks = uniqueById((input.upsertLinks ?? []).map((l) => ({ ...l, id: linkJson(l).id })));
    const upGroups = uniqueById(input.upsertGroups ?? []);
    const upNodeIds = new Set(upNodes.map((n) => n.id));
    const upLinkIds = new Set(upLinks.map((l) => l.id));
    const upGroupIds = new Set(upGroups.map((g) => g.id));
    const delNodeIds = [...new Set(input.deleteNodeIds ?? [])].filter((id) => !upNodeIds.has(id));
    const delLinkIds = [...new Set(input.deleteLinkIds ?? [])].filter((id) => !upLinkIds.has(id));
    const delGroupIds = [...new Set(input.deleteGroupIds ?? [])].filter((id) => !upGroupIds.has(id));
    const positions = uniqueById(input.positions ?? []).filter(
      (p) => !upNodeIds.has(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y),
    );

    const base = {
      nodes: input.baseVersions?.nodes ?? {},
      links: input.baseVersions?.links ?? {},
      groups: input.baseVersions?.groups ?? {},
    };
    const nodeConflicts = await findConflicts(tx, "Node", [...upNodeIds, ...delNodeIds], base.nodes);
    const linkConflicts = await findConflicts(tx, "Link", [...upLinkIds, ...delLinkIds], base.links);
    const groupConflicts = await findConflicts(tx, "Group", [...upGroupIds, ...delGroupIds], base.groups);
    if (nodeConflicts.length || linkConflicts.length || groupConflicts.length) {
      throw new MapConflictError(nodeConflicts, linkConflicts, groupConflicts);
    }

    const nodes = {
      ...(await upsertNodes(tx, upNodes, stamp)),
      ...(await softDelete(tx, "Node", delNodeIds, stamp)),
    };
    const links = {
      ...(await upsertLinks(tx, upLinks, stamp)),
      ...(await softDelete(tx, "Link", delLinkIds, stamp)),
    };
    const groups = {
      ...(await upsertGroups(tx, upGroups, stamp)),
      ...(await softDelete(tx, "Group", delGroupIds, stamp)),
      ...(await sweepEmptyGroups(tx, stamp)),
    };
    await movePositions(tx, positions, stamp);

    await writeLog(tx.request(), stamp, input.label || "update", {
      upsertNodes: [...upNodeIds],
      deleteNodeIds: delNodeIds,
      upsertLinks: [...upLinkIds],
      deleteLinkIds: delLinkIds,
      upsertGroups: [...upGroupIds],
      deleteGroupIds: delGroupIds,
      positions: positions.length,
    });
    await tx.commit();
    void sweepChangeLog(pool);
    return { revision, versions: { nodes, links, groups } };
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      /* already closed */
    }
    throw err;
  }
}
