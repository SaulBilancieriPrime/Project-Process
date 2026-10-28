import { createSampleDocument } from "../sampleData";
import { parseGraphDocument, type GraphDocument, type GraphLink, type GraphNode, type GraphSettings } from "../schema/graph";
import { MAP_SCHEMA, sql, sqlPool } from "./azureSql";

type SqlRequest = any;
type SqlTransaction = any;
type SqlPool = any;

export type SharedMap = GraphDocument & { revision: number };

export type MapTxInput = {
  actor?: string;
  label?: string;
  settings?: GraphSettings;
  upsertNodes?: GraphNode[];
  deleteNodeIds?: string[];
  upsertLinks?: GraphLink[];
  deleteLinkIds?: string[];
  replace?: GraphDocument;
};

const S = MAP_SCHEMA;

const DDL = [
  `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'${S}') EXEC(N'CREATE SCHEMA ${S}')`,
  `IF OBJECT_ID(N'${S}.Map', N'U') IS NULL
   CREATE TABLE ${S}.Map (
     id int NOT NULL CONSTRAINT PK_projectprocess_Map PRIMARY KEY,
     settings_json nvarchar(max) NOT NULL,
     revision bigint NOT NULL CONSTRAINT DF_projectprocess_Map_rev DEFAULT (1),
     updated_at datetime2 NOT NULL,
     updated_by nvarchar(200) NULL
   )`,
  `IF OBJECT_ID(N'${S}.Node', N'U') IS NULL
   CREATE TABLE ${S}.Node (
     id nvarchar(160) NOT NULL CONSTRAINT PK_projectprocess_Node PRIMARY KEY,
     title nvarchar(400) NOT NULL,
     description nvarchar(max) NULL,
     level int NOT NULL CONSTRAINT DF_projectprocess_Node_level DEFAULT (0),
     parent_id nvarchar(160) NULL,
     type nvarchar(20) NOT NULL,
     color nvarchar(32) NULL,
     employee nvarchar(200) NULL,
     employee_email nvarchar(200) NULL,
     size float NOT NULL CONSTRAINT DF_projectprocess_Node_size DEFAULT (1),
     x float NULL, y float NULL, fx float NULL, fy float NULL,
     version int NOT NULL CONSTRAINT DF_projectprocess_Node_ver DEFAULT (1),
     is_deleted bit NOT NULL CONSTRAINT DF_projectprocess_Node_del DEFAULT (0),
     updated_at datetime2 NOT NULL,
     updated_by nvarchar(200) NULL
   )`,
  `IF OBJECT_ID(N'${S}.Link', N'U') IS NULL
   CREATE TABLE ${S}.Link (
     id nvarchar(160) NOT NULL CONSTRAINT PK_projectprocess_Link PRIMARY KEY,
     source_id nvarchar(160) NOT NULL,
     target_id nvarchar(160) NOT NULL,
     kind nvarchar(20) NOT NULL,
     arrows nvarchar(20) NOT NULL,
     is_deleted bit NOT NULL CONSTRAINT DF_projectprocess_Link_del DEFAULT (0),
     updated_at datetime2 NOT NULL,
     updated_by nvarchar(200) NULL
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_Link_ends' AND object_id = OBJECT_ID(N'${S}.Link'))
   CREATE INDEX IX_projectprocess_Link_ends ON ${S}.Link(source_id, target_id)`,
  `IF OBJECT_ID(N'${S}.ChangeLog', N'U') IS NULL
   CREATE TABLE ${S}.ChangeLog (
     change_id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_projectprocess_ChangeLog PRIMARY KEY,
     revision bigint NOT NULL,
     changed_at datetime2 NOT NULL,
     changed_by nvarchar(200) NULL,
     action nvarchar(40) NOT NULL,
     target nvarchar(20) NOT NULL,
     target_id nvarchar(160) NULL,
     payload_json nvarchar(max) NULL
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_ChangeLog_rev' AND object_id = OBJECT_ID(N'${S}.ChangeLog'))
   CREATE INDEX IX_projectprocess_ChangeLog_rev ON ${S}.ChangeLog(revision)`,
];

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  const pool = await sqlPool();
  for (const statement of DDL) {
    await pool.request().query(statement);
  }
  schemaReady = true;
}

function actorName(value?: string) {
  const next = (value ?? "").trim();
  return (next || "editor").slice(0, 200);
}

function linkEnds(link: GraphLink) {
  const source = typeof link.source === "string" ? link.source : String(link.source);
  const target = typeof link.target === "string" ? link.target : String(link.target);
  return { source, target };
}

function rowNode(row: Record<string, unknown>): GraphNode {
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
    x: row.x == null ? undefined : Number(row.x),
    y: row.y == null ? undefined : Number(row.y),
    fx: row.fx == null ? undefined : Number(row.fx),
    fy: row.fy == null ? undefined : Number(row.fy),
  };
}

function rowLink(row: Record<string, unknown>): GraphLink {
  return {
    id: String(row.id),
    source: String(row.source_id),
    target: String(row.target_id),
    kind: (row.kind as GraphLink["kind"]) || "parent",
    arrows: (row.arrows as GraphLink["arrows"]) || "none",
  };
}

async function readRevision(req: SqlRequest) {
  const result = await req.query(`SELECT revision FROM ${S}.Map WHERE id = 1`);
  return Number(result.recordset[0]?.revision ?? 0);
}

async function bumpRevision(req: SqlRequest, settingsJson: string | null, actor: string, now: Date) {
  if (settingsJson != null) {
    req.input("settings_json", sql.NVarChar(sql.MAX), settingsJson);
  }
  req.input("updated_by", sql.NVarChar(200), actor);
  req.input("updated_at", sql.DateTime2, now);
  const result = settingsJson != null
    ? await req.query(`
        UPDATE ${S}.Map
        SET revision = revision + 1, settings_json = @settings_json, updated_at = @updated_at, updated_by = @updated_by
        OUTPUT INSERTED.revision
        WHERE id = 1
      `)
    : await req.query(`
        UPDATE ${S}.Map
        SET revision = revision + 1, updated_at = @updated_at, updated_by = @updated_by
        OUTPUT INSERTED.revision
        WHERE id = 1
      `);
  return Number(result.recordset[0]?.revision ?? 0);
}

async function writeLog(
  req: SqlRequest,
  revision: number,
  actor: string,
  now: Date,
  action: string,
  target: string,
  targetId: string | null,
  payload: unknown,
) {
  req.input("log_revision", sql.BigInt, revision);
  req.input("log_at", sql.DateTime2, now);
  req.input("log_by", sql.NVarChar(200), actor);
  req.input("log_action", sql.NVarChar(40), action.slice(0, 40));
  req.input("log_target", sql.NVarChar(20), target.slice(0, 20));
  req.input("log_target_id", sql.NVarChar(160), targetId);
  req.input("log_payload", sql.NVarChar(sql.MAX), payload == null ? null : JSON.stringify(payload));
  await req.query(`
    INSERT INTO ${S}.ChangeLog (revision, changed_at, changed_by, action, target, target_id, payload_json)
    VALUES (@log_revision, @log_at, @log_by, @log_action, @log_target, @log_target_id, @log_payload)
  `);
}

async function upsertNode(tx: SqlTransaction, node: GraphNode, actor: string, now: Date) {
  const req = tx.request();
  req.input("id", sql.NVarChar(160), node.id.slice(0, 160));
  req.input("title", sql.NVarChar(400), (node.title || "Untitled").slice(0, 400));
  req.input("description", sql.NVarChar(sql.MAX), node.description ?? "");
  req.input("level", sql.Int, node.level ?? 0);
  req.input("parent_id", sql.NVarChar(160), node.parentId ? String(node.parentId).slice(0, 160) : null);
  req.input("type", sql.NVarChar(20), (node.type || "concept").slice(0, 20));
  req.input("color", sql.NVarChar(32), node.color ? node.color.slice(0, 32) : null);
  req.input("employee", sql.NVarChar(200), (node.employee ?? "").slice(0, 200));
  req.input("employee_email", sql.NVarChar(200), (node.employeeEmail ?? "").slice(0, 200));
  req.input("size", sql.Float, node.size ?? 1);
  req.input("x", sql.Float, node.x ?? null);
  req.input("y", sql.Float, node.y ?? null);
  req.input("fx", sql.Float, node.fx ?? null);
  req.input("fy", sql.Float, node.fy ?? null);
  req.input("updated_at", sql.DateTime2, now);
  req.input("updated_by", sql.NVarChar(200), actor);
  await req.query(`
    MERGE ${S}.Node AS t
    USING (SELECT @id AS id) AS s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET
      title = @title, description = @description, level = @level, parent_id = @parent_id,
      type = @type, color = @color, employee = @employee, employee_email = @employee_email,
      size = @size, x = @x, y = @y, fx = @fx, fy = @fy, version = t.version + 1,
      is_deleted = 0, updated_at = @updated_at, updated_by = @updated_by
    WHEN NOT MATCHED THEN INSERT (
      id, title, description, level, parent_id, type, color, employee, employee_email,
      size, x, y, fx, fy, version, is_deleted, updated_at, updated_by
    ) VALUES (
      @id, @title, @description, @level, @parent_id, @type, @color, @employee, @employee_email,
      @size, @x, @y, @fx, @fy, 1, 0, @updated_at, @updated_by
    );
  `);
}

async function softDeleteNode(tx: SqlTransaction, id: string, actor: string, now: Date) {
  const req = tx.request();
  req.input("id", sql.NVarChar(160), id.slice(0, 160));
  req.input("updated_at", sql.DateTime2, now);
  req.input("updated_by", sql.NVarChar(200), actor);
  await req.query(`
    UPDATE ${S}.Node
    SET is_deleted = 1, version = version + 1, updated_at = @updated_at, updated_by = @updated_by
    WHERE id = @id
  `);
}

async function upsertLink(tx: SqlTransaction, link: GraphLink, actor: string, now: Date) {
  const ends = linkEnds(link);
  const req = tx.request();
  req.input("id", sql.NVarChar(160), (link.id || `${ends.source}->${ends.target}`).slice(0, 160));
  req.input("source_id", sql.NVarChar(160), ends.source.slice(0, 160));
  req.input("target_id", sql.NVarChar(160), ends.target.slice(0, 160));
  req.input("kind", sql.NVarChar(20), (link.kind || "parent").slice(0, 20));
  req.input("arrows", sql.NVarChar(20), (link.arrows || "none").slice(0, 20));
  req.input("updated_at", sql.DateTime2, now);
  req.input("updated_by", sql.NVarChar(200), actor);
  await req.query(`
    MERGE ${S}.Link AS t
    USING (SELECT @id AS id) AS s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET
      source_id = @source_id, target_id = @target_id, kind = @kind, arrows = @arrows,
      is_deleted = 0, updated_at = @updated_at, updated_by = @updated_by
    WHEN NOT MATCHED THEN INSERT (id, source_id, target_id, kind, arrows, is_deleted, updated_at, updated_by)
    VALUES (@id, @source_id, @target_id, @kind, @arrows, 0, @updated_at, @updated_by);
  `);
}

async function softDeleteLink(tx: SqlTransaction, id: string, actor: string, now: Date) {
  const req = tx.request();
  req.input("id", sql.NVarChar(160), id.slice(0, 160));
  req.input("updated_at", sql.DateTime2, now);
  req.input("updated_by", sql.NVarChar(200), actor);
  await req.query(`
    UPDATE ${S}.Link SET is_deleted = 1, updated_at = @updated_at, updated_by = @updated_by WHERE id = @id
  `);
}

async function ensureMapRow(pool: SqlPool, settings: GraphSettings, actor: string) {
  const now = new Date();
  const req = pool.request();
  req.input("settings_json", sql.NVarChar(sql.MAX), JSON.stringify(settings));
  req.input("updated_at", sql.DateTime2, now);
  req.input("updated_by", sql.NVarChar(200), actor);
  await req.query(`
    IF NOT EXISTS (SELECT 1 FROM ${S}.Map WHERE id = 1)
    INSERT INTO ${S}.Map (id, settings_json, revision, updated_at, updated_by)
    VALUES (1, @settings_json, 0, @updated_at, @updated_by)
  `);
}

export async function loadSharedMap(): Promise<SharedMap> {
  await ensureSchema();
  const pool = await sqlPool();
  await ensureMapRow(pool, createSampleDocument().settings, "seed");
  const count = await pool.request().query(`SELECT COUNT(*) AS n FROM ${S}.Node WHERE is_deleted = 0`);
  if (!Number(count.recordset[0]?.n)) {
    await applyMapTx({ actor: "seed", label: "Seeded shared map", replace: createSampleDocument() });
  }
  const map = await pool.request().query(
    `SELECT settings_json, revision FROM ${S}.Map WHERE id = 1`,
  );
  const nodes = await pool.request().query(`SELECT * FROM ${S}.Node WHERE is_deleted = 0`);
  const links = await pool.request().query(`SELECT * FROM ${S}.Link WHERE is_deleted = 0`);
  const settingsRaw = map.recordset[0]?.settings_json;
  const parsed = parseGraphDocument({
    settings: settingsRaw ? JSON.parse(settingsRaw) : {},
    nodes: nodes.recordset.map((row: Record<string, unknown>) => rowNode(row)),
    links: links.recordset.map((row: Record<string, unknown>) => rowLink(row)),
  });
  return { ...parsed, revision: Number(map.recordset[0]?.revision ?? 1) };
}

export async function mapRevision(): Promise<number> {
  await ensureSchema();
  const pool = await sqlPool();
  return readRevision(pool.request());
}

export async function applyMapTx(input: MapTxInput): Promise<{ revision: number }> {
  await ensureSchema();
  const actor = actorName(input.actor);
  const now = new Date();
  const pool = await sqlPool();
  await ensureMapRow(pool, input.replace?.settings ?? input.settings ?? createSampleDocument().settings, actor);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    if (input.replace) {
      const doc = parseGraphDocument(input.replace);
      const wipe = tx.request();
      wipe.input("updated_at", sql.DateTime2, now);
      wipe.input("updated_by", sql.NVarChar(200), actor);
      await wipe.query(`
        UPDATE ${S}.Node SET is_deleted = 1, version = version + 1, updated_at = @updated_at, updated_by = @updated_by WHERE is_deleted = 0;
        UPDATE ${S}.Link SET is_deleted = 1, updated_at = @updated_at, updated_by = @updated_by WHERE is_deleted = 0;
      `);
      for (const node of doc.nodes) await upsertNode(tx, node, actor, now);
      for (const link of doc.links) await upsertLink(tx, link, actor, now);
      const revision = await bumpRevision(tx.request(), JSON.stringify(doc.settings), actor, now);
      await writeLog(tx.request(), revision, actor, now, input.label || "replace", "map", "1", {
        nodes: doc.nodes.length,
        links: doc.links.length,
      });
      await tx.commit();
      return { revision };
    }

    for (const node of input.upsertNodes ?? []) await upsertNode(tx, node, actor, now);
    for (const id of input.deleteNodeIds ?? []) await softDeleteNode(tx, id, actor, now);
    for (const link of input.upsertLinks ?? []) await upsertLink(tx, link, actor, now);
    for (const id of input.deleteLinkIds ?? []) await softDeleteLink(tx, id, actor, now);

    const settingsJson = input.settings ? JSON.stringify(input.settings) : null;
    const revision = await bumpRevision(tx.request(), settingsJson, actor, now);
    const summary = {
      upsertNodes: (input.upsertNodes ?? []).map((n) => n.id),
      deleteNodeIds: input.deleteNodeIds ?? [],
      upsertLinks: (input.upsertLinks ?? []).map((l) => l.id),
      deleteLinkIds: input.deleteLinkIds ?? [],
      settings: Boolean(input.settings),
    };
    await writeLog(tx.request(), revision, actor, now, input.label || "update", "map", "1", summary);
    await tx.commit();
    return { revision };
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      /* already closed */
    }
    throw err;
  }
}
