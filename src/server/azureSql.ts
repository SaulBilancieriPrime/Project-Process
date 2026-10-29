import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import sql from "mssql";

const TOKEN_SCOPE = "https://database.windows.net/.default";
const DATABASE = process.env.AZURE_SQL_DATABASE?.trim() || "atg-requirements";
const SERVERS = [
  process.env.AZURE_SQL_SERVER?.trim(),
  "sql-primeae-eastus2.database.windows.net",
  "sql-prime-it.database.windows.net",
].filter((value): value is string => Boolean(value));
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const RETIRED_POOL_CLOSE_MS = 30 * 1000;

export const MAP_SCHEMA = "projectprocess";

// mssql ships without complete types in this toolchain
type SqlPool = any;

let pool: SqlPool | null = null;
let poolExpiresAt = 0;
let connecting: Promise<SqlPool> | null = null;

function inAzure() {
  return Boolean(process.env.WEBSITE_INSTANCE_ID || process.env.IDENTITY_ENDPOINT || process.env.MSI_ENDPOINT);
}

async function accessToken() {
  const cred = inAzure() ? new ManagedIdentityCredential() : new DefaultAzureCredential();
  const token = await cred.getToken(TOKEN_SCOPE);
  if (!token?.token) throw new Error("No Azure SQL access token");
  return token;
}

function retire(stale: SqlPool) {
  setTimeout(() => {
    stale.close().catch(() => {
      /* already closed */
    });
  }, RETIRED_POOL_CLOSE_MS);
}

async function connect(): Promise<SqlPool> {
  const token = await accessToken();
  let last: unknown;
  for (const server of SERVERS) {
    const next = new sql.ConnectionPool({
      server,
      database: DATABASE,
      port: 1433,
      options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
      authentication: {
        type: "azure-active-directory-access-token",
        options: { token: token.token },
      },
    });
    try {
      const connected = await next.connect();
      const previous = pool;
      pool = connected;
      poolExpiresAt = token.expiresOnTimestamp;
      if (previous && previous !== connected) retire(previous);
      return connected;
    } catch (err) {
      last = err;
      try {
        await next.close();
      } catch {
        /* ignore */
      }
    }
  }
  throw last instanceof Error ? last : new Error(`Could not connect to Azure SQL ${DATABASE}`);
}

export async function sqlPool(): Promise<SqlPool> {
  const fresh = poolExpiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS;
  if (pool?.connected && fresh) return pool;
  if (!connecting) {
    connecting = connect().finally(() => {
      connecting = null;
    });
  }
  return connecting;
}

export { sql };
