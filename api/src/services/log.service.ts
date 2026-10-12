import type { LogRepository, LogListFilter } from "../repositories/log.repository.js";

/** Admin-only read access enforced at the route layer (requireMinType). */
export class LogService {
  constructor(private readonly logs: LogRepository) {}

  async list(filter: LogListFilter) {
    const { total, logs } = await this.logs.list(filter);
    return { total, page: filter.page, pageSize: filter.pageSize, logs };
  }
}
