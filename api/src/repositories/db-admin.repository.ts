import { Prisma, type PrismaClient } from "@prisma/client";
import { SqlConsoleError } from "../domain/errors.js";

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
  | { kind: "rows"; columns: string[]; rows: Record<string, unknown>[]; rowCount: number; truncated: boolean }
  | { kind: "mutation"; rowsAffected: number };

export interface SelectLimits {
  timeoutMs: number;
  maxRows: number;
}

export interface DbAdminRepository {
  health(): Promise<DbHealth>;
  schema(): Promise<DbSchema>;
  /** Roda em transação `READ ONLY` com `statement_timeout`: escrita falha
   * no banco, seja qual for o texto do comando. */
  runSelect(sql: string, limits: SelectLimits): Promise<QueryResult>;
  runMutation(sql: string, limits: { timeoutMs: number }): Promise<QueryResult>;
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

  async runSelect(sql: string, { timeoutMs, maxRows }: SelectLimits): Promise<QueryResult> {
    const rows = await this.inTransaction(timeoutMs, true, (tx) =>
      tx.$queryRawUnsafe<Record<string, unknown>[]>(sql),
    );
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      kind: "rows",
      columns,
      rows: rows.slice(0, maxRows),
      rowCount: rows.length,
      truncated: rows.length > maxRows,
    };
  }

  async runMutation(sql: string, { timeoutMs }: { timeoutMs: number }): Promise<QueryResult> {
    const rowsAffected = await this.inTransaction(timeoutMs, false, (tx) => tx.$executeRawUnsafe(sql));
    return { kind: "mutation", rowsAffected };
  }

  /** `SET TRANSACTION READ ONLY` precisa ser o primeiro comando da
   * transação; `SET LOCAL` morre com ela, então o timeout não vaza para a
   * conexão devolvida ao pool. */
  private async inTransaction<T>(
    timeoutMs: number,
    readOnly: boolean,
    run: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const ms = Math.max(1, Math.trunc(timeoutMs));
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (readOnly) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
          await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${ms}`);
          return run(tx);
        },
        { timeout: ms + 5000, maxWait: 5000 },
      );
    } catch (err) {
      throw toSqlConsoleError(err);
    }
  }
}

const PG_QUERY_CANCELED = "57014";

/** Erro do Postgres vira 422 com a mensagem do banco; o resto (conexão,
 * bug) segue como veio e termina em 500 sem detalhe. */
export function toSqlConsoleError(err: unknown): unknown {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return err;
  const meta = (err.meta ?? {}) as { code?: unknown; message?: unknown };
  const detail = typeof meta.message === "string" ? meta.message : err.message;
  if (meta.code === PG_QUERY_CANCELED || /statement timeout/i.test(detail)) {
    return new SqlConsoleError("query_timeout", "Consulta cancelada: passou do tempo limite");
  }
  // P2028: a transação interativa do Prisma estourou o próprio prazo.
  if (err.code === "P2028") {
    return new SqlConsoleError("query_timeout", "Consulta cancelada: passou do tempo limite");
  }
  return new SqlConsoleError("sql_error", detail.slice(0, 2000));
}
