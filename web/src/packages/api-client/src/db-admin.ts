import { apiFetch } from "./http";

export interface DbHealth {
  connections: number;
  maxConnections: number;
  connectionsByState: { state: string | null; count: number }[];
  databaseSizeBytes: number;
  uptimeSeconds: number;
}

export function getDbHealth(): Promise<DbHealth> {
  return apiFetch("/admin/db/health");
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface SchemaTable {
  name: string;
  rowEstimate: number;
  columns: SchemaColumn[];
}

export interface ForeignKey {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
}

export interface DbSchema {
  tables: SchemaTable[];
  foreignKeys: ForeignKey[];
}

export function getDbSchema(): Promise<DbSchema> {
  return apiFetch("/admin/db/schema");
}

export type QueryResult =
  | { kind: "rows"; columns: string[]; rows: Record<string, unknown>[] }
  | { kind: "mutation"; rowsAffected: number };

/** `confirm: true` only after the UI has shown the user a destructive-
 * statement warning — see DbAdminService.runQuery on the backend,
 * which rejects a mutating statement without it (code
 * "requires_confirmation"). */
export function runDbQuery(sql: string, confirm = false): Promise<QueryResult> {
  return apiFetch("/admin/db/query", { method: "POST", body: JSON.stringify({ sql, confirm }) });
}
