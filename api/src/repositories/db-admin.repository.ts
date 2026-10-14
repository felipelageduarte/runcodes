import { Prisma, type PrismaClient } from "@prisma/client";

export interface DbHealth {
  connections: number;
  maxConnections: number;
  connectionsByState: { state: string | null; count: number }[];
  databaseSizeBytes: number;
  uptimeSeconds: number;
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

export type QueryResult =
  | { kind: "rows"; columns: string[]; rows: Record<string, unknown>[] }
  | { kind: "mutation"; rowsAffected: number };

export interface DbAdminRepository {
  health(): Promise<DbHealth>;
  schema(): Promise<DbSchema>;
  runSelect(sql: string): Promise<QueryResult>;
  runMutation(sql: string): Promise<QueryResult>;
}

/** Reads `public` schema metadata straight from Postgres catalogs
 * (information_schema/pg_catalog) rather than parsing schema.prisma —
 * reflects what's actually in the database, including anything a
 * migration added outside Prisma. Backs both the SQL console's table
 * sidebar and the ERD tab (see db-admin.routes.ts). */
export class PrismaDbAdminRepository implements DbAdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async health(): Promise<DbHealth> {
    const [summary] = await this.prisma.$queryRaw<
      { connections: bigint; max_connections: number; database_size_bytes: bigint; uptime_seconds: bigint }[]
    >(Prisma.sql`
      SELECT
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
        pg_database_size(current_database()) AS database_size_bytes,
        extract(epoch FROM (now() - pg_postmaster_start_time()))::bigint AS uptime_seconds
    `);
    const byState = await this.prisma.$queryRaw<{ state: string | null; count: bigint }[]>(Prisma.sql`
      SELECT state, count(*) AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
      ORDER BY count DESC
    `);

    return {
      connections: Number(summary?.connections ?? 0),
      maxConnections: summary?.max_connections ?? 0,
      connectionsByState: byState.map((r) => ({ state: r.state, count: Number(r.count) })),
      databaseSizeBytes: Number(summary?.database_size_bytes ?? 0),
      uptimeSeconds: Number(summary?.uptime_seconds ?? 0),
    };
  }

  async schema(): Promise<DbSchema> {
    const columns = await this.prisma.$queryRaw<
      { table_name: string; column_name: string; data_type: string; is_nullable: string; is_primary_key: boolean }[]
    >(Prisma.sql`
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
        ) AS is_primary_key
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `);

    const rowEstimates = await this.prisma.$queryRaw<{ relname: string; estimate: number }[]>(Prisma.sql`
      SELECT relname, n_live_tup AS estimate
      FROM pg_stat_user_tables
    `);
    const estimateByTable = new Map(rowEstimates.map((r) => [r.relname, Number(r.estimate)]));

    const foreignKeys = await this.prisma.$queryRaw<ForeignKey[]>(Prisma.sql`
      SELECT
        tc.table_name AS table,
        kcu.column_name AS column,
        ccu.table_name AS "refTable",
        ccu.column_name AS "refColumn"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `);

    const tables = new Map<string, SchemaTable>();
    for (const c of columns) {
      const table = tables.get(c.table_name) ?? {
        name: c.table_name,
        rowEstimate: estimateByTable.get(c.table_name) ?? 0,
        columns: [],
      };
      table.columns.push({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === "YES",
        isPrimaryKey: c.is_primary_key,
      });
      tables.set(c.table_name, table);
    }

    return { tables: [...tables.values()], foreignKeys };
  }

  async runSelect(sql: string): Promise<QueryResult> {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { kind: "rows", columns, rows };
  }

  async runMutation(sql: string): Promise<QueryResult> {
    const rowsAffected = await this.prisma.$executeRawUnsafe(sql);
    return { kind: "mutation", rowsAffected };
  }
}
