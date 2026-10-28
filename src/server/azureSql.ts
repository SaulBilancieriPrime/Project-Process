import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import sql from "mssql";

const TOKEN_SCOPE = "https://database.windows.net/.default";
const DATABASE = process.env.AZURE_SQL_DATABASE?.trim() || "atg-requirements";
const SERVERS = [
  process.env.AZURE_SQL_SERVER?.trim(),
  "sql-primeae-eastus2.database.windows.net",
  "sql-prime-it.database.windows.net",
].filter((value): value is string => Boolean(value));

export const MAP_SCHEMA = "projectprocess";

// mssql ships without complete types in this toolchain
type SqlPool = any;

let pool: SqlPool | null = null;

function inAzure() {
  return Boolean(process.env.WEBSITE_INSTANCE_ID || process.env.IDENTITY_ENDPOINT || process.env.MSI_ENDPOINT);
}

async function accessToken() {
  const cred = inAzure() ? new ManagedIdentityCredential() : new DefaultAzureCredential();
  const token = await cred.getToken(TOKEN_SCOPE);
  if (!token?.token) throw new Error("No Azure SQL access token");
  return token.token;
}

export async function sqlPool() {
  if (pool?.connected) return pool;
  if (pool) {
    try {
      await pool.close();
    } catch {
      /* stale pool */
    }
    pool = null;
  }

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
        options: { token },
      },
    });
    try {
      pool = await next.connect();
      return pool;
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

export { sql };
