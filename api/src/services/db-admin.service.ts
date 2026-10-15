import type { DbAdminRepository, QueryResult } from "../repositories/db-admin.repository.js";
import { ConflictError, ValidationError } from "../domain/errors.js";

const MUTATING_RE = /^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|REPLACE)\b/i;
const MULTI_STATEMENT_RE = /;\s*\S/; // a non-whitespace char after a `;` means more than one statement

/** Admin-only raw SQL console. Mirrors emboabaDuarte's query.html
 * safety net: a destructive statement (anything but SELECT) is
 * rejected with a distinct error code unless the caller explicitly
 * passes `confirm: true`, so the UI can show one extra "are you sure"
 * step instead of running it blind. */
export class DbAdminService {
  constructor(private readonly db: DbAdminRepository) {}

  health() {
    return this.db.health();
  }

  schema() {
    return this.db.schema();
  }

  async runQuery(sql: string, confirm: boolean): Promise<QueryResult> {
    const trimmed = sql.trim();
    if (!trimmed) throw new ValidationError("Query vazia", "empty_query");
    if (MULTI_STATEMENT_RE.test(trimmed)) {
      throw new ValidationError("Execute um comando por vez", "multiple_statements");
    }

    const isMutating = MUTATING_RE.test(trimmed);
    if (isMutating && !confirm) {
      throw new ConflictError(
        "This statement changes data and needs confirmation",
        "requires_confirmation",
      );
    }

    return isMutating ? this.db.runMutation(trimmed) : this.db.runSelect(trimmed);
  }
}
