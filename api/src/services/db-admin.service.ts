import type { AuditRepository } from "../repositories/audit.repository.js";
import type { DbAdminRepository, QueryResult } from "../repositories/db-admin.repository.js";
import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from "../domain/errors.js";

const WRITE_KEYWORDS = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "GRANT",
  "REVOKE",
  "REPLACE",
  "MERGE",
]);
const READ_KEYWORDS = new Set(["SELECT", "WITH", "EXPLAIN", "SHOW", "TABLE", "VALUES"]);

export const SQL_CONSOLE_PATH = "/api/admin/db/query";
/** Status da linha de auditoria gravada ANTES de executar: 102 (Processing)
 * marca "tentativa registrada, resultado ainda desconhecido". O resultado
 * vem na linha normal da requisição, com o mesmo `request_id`. */
export const SQL_ATTEMPT_STATUS = 102;

export const SQL_CONSOLE_LIMITS = {
  maxSqlChars: 10_000,
  maxRows: 1000,
  readTimeoutMs: 5000,
  writeTimeoutMs: 30_000,
} as const;

export type StatementClass = "read" | "write" | "other";

export interface SqlStatementInfo {
  /** Primeira palavra-chave do comando, em maiúsculas (`SELECT`, `UPDATE`). */
  keyword: string;
  class: StatementClass;
  /** Quantos comandos separados por `;` o texto traz. */
  statements: number;
  chars: number;
}

/** Só metadados: nada daqui carrega o SQL nem literais, por isso pode ir
 * para a auditoria. A classe NÃO é barreira de segurança: tudo que não for
 * `write` roda em transação `READ ONLY`, então um comando mal classificado
 * (comentário na frente, CTE com DELETE) falha no banco. */
export function describeSql(sql: string): SqlStatementInfo {
  const trimmed = sql.trim();
  const keyword = (/^[A-Za-z]+/.exec(trimmed)?.[0] ?? "").toUpperCase();
  const statements = trimmed.split(";").filter((part) => part.trim().length > 0).length;
  const cls: StatementClass = WRITE_KEYWORDS.has(keyword) ? "write" : READ_KEYWORDS.has(keyword) ? "read" : "other";
  return { keyword: cls === "other" ? "OTHER" : keyword, class: cls, statements, chars: trimmed.length };
}

export interface SqlConsoleActor {
  email: string;
  /** Tipo real da conta e, em "ver como", o tipo simulado. */
  type: number;
  viewAsType: number | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export interface SqlQueryInput {
  sql: string;
  confirm: boolean;
  password?: string;
}

export interface DbAdminDeps {
  audit: Pick<AuditRepository, "create">;
  verifyPassword: (email: string, password: string) => Promise<boolean>;
  /** Flag de ambiente `DB_CONSOLE_WRITE_ENABLED`. */
  writeEnabled: boolean;
}

/** Console SQL do admin (spec admin-e-separacao-front, F5).
 *
 * - Leitura por padrão: transação `READ ONLY` com `statement_timeout`.
 * - Escrita só com a flag de ambiente ligada, `confirm: true` e a senha de
 *   quem executa.
 * - Toda tentativa vai para a auditoria ANTES de executar, só com
 *   metadados. Se a auditoria falhar, o comando não roda. */
export class DbAdminService {
  constructor(
    private readonly db: DbAdminRepository,
    private readonly deps: DbAdminDeps,
  ) {}

  health() {
    return this.db.health();
  }

  schema() {
    return this.db.schema();
  }

  /** O que a tela precisa saber para montar o console. */
  consoleInfo() {
    return { writeEnabled: this.deps.writeEnabled, ...SQL_CONSOLE_LIMITS };
  }

  async runQuery(input: SqlQueryInput, actor: SqlConsoleActor): Promise<QueryResult> {
    const trimmed = input.sql.trim();
    if (!trimmed) throw new ValidationError("Query vazia", "empty_query");

    const info = describeSql(trimmed);
    await this.recordAttempt(info, input, actor);

    if (info.chars > SQL_CONSOLE_LIMITS.maxSqlChars) {
      throw new ValidationError("Query grande demais", "query_too_long");
    }
    if (info.statements > 1) {
      throw new ValidationError("Execute um comando por vez", "multiple_statements");
    }

    if (info.class !== "write") {
      return this.db.runSelect(trimmed, {
        timeoutMs: SQL_CONSOLE_LIMITS.readTimeoutMs,
        maxRows: SQL_CONSOLE_LIMITS.maxRows,
      });
    }

    if (!this.deps.writeEnabled) {
      throw new ForbiddenError("Console em modo somente leitura", "write_mode_disabled");
    }
    if (!input.confirm || !input.password) {
      throw new ConflictError("This statement changes data and needs confirmation", "requires_confirmation");
    }
    if (!(await this.deps.verifyPassword(actor.email, input.password))) {
      throw new UnauthorizedError("Current password is incorrect", "invalid_current_password");
    }
    return this.db.runMutation(trimmed, { timeoutMs: SQL_CONSOLE_LIMITS.writeTimeoutMs });
  }

  private recordAttempt(info: SqlStatementInfo, input: SqlQueryInput, actor: SqlConsoleActor) {
    return this.deps.audit.create({
      actorEmail: actor.email,
      actorType: actor.type,
      viewAsType: actor.viewAsType,
      method: "POST",
      path: SQL_CONSOLE_PATH,
      route: SQL_CONSOLE_PATH,
      status: SQL_ATTEMPT_STATUS,
      durationMs: null,
      ip: actor.ip,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
      targetType: "sql_console",
      requestBody: {
        sqlConsole: {
          phase: "attempt",
          keyword: info.keyword,
          class: info.class,
          statements: info.statements,
          chars: info.chars,
          confirm: input.confirm,
          passwordProvided: Boolean(input.password),
          writeEnabled: this.deps.writeEnabled,
        },
      },
    });
  }
}
