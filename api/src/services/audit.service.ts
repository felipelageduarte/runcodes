import type { AuditRepository, AuditFeedFilter } from "../repositories/audit.repository.js";

export const AUDIT_FEED_MAX_LIMIT = 200;
export const AUDIT_STATS_MAX_DAYS = 90;
/** Retenção da trilha (spec F1, Q5): 180 dias. */
export const AUDIT_RETENTION_DAYS = 180;

/** Leitura admin-only, imposta na rota pela permissão `admin.audit:read`
 * do catálogo. A escrita é do middleware auditLog. */
export class AuditService {
  constructor(private readonly audit: AuditRepository) {}

  async feed(filter: AuditFeedFilter) {
    const limit = Math.min(Math.max(filter.limit, 1), AUDIT_FEED_MAX_LIMIT);
    const offset = Math.max(filter.offset, 0);
    const { total, items } = await this.audit.feed({ ...filter, limit, offset });
    return { total, limit, offset, items };
  }

  stats(days: number) {
    return this.audit.stats(Math.min(Math.max(days, 1), AUDIT_STATS_MAX_DAYS));
  }

  purgeExpired(days = AUDIT_RETENTION_DAYS) {
    return this.audit.purgeOlderThan(days);
  }
}
