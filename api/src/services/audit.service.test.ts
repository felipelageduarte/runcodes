import { describe, it, expect, vi } from "vitest";
import { AuditService, AUDIT_RETENTION_DAYS } from "./audit.service.js";
import type { AuditRepository } from "../repositories/audit.repository.js";

function makeRepo(): AuditRepository {
  return {
    create: vi.fn(),
    feed: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    stats: vi.fn().mockResolvedValue({ days: 7, total: 0 }),
    purgeOlderThan: vi.fn().mockResolvedValue(3),
  };
}

describe("AuditService", () => {
  it("clamps limit to 200 and offset to >= 0, echoing them back", async () => {
    const repo = makeRepo();
    const result = await new AuditService(repo).feed({ limit: 999, offset: -5 });
    expect(repo.feed).toHaveBeenCalledWith({ limit: 200, offset: 0 });
    expect(result).toEqual({ total: 0, limit: 200, offset: 0, items: [] });
  });

  it("clamps stats window to 90 days", async () => {
    const repo = makeRepo();
    await new AuditService(repo).stats(400);
    expect(repo.stats).toHaveBeenCalledWith(90);
  });

  it("purges with the 180-day retention by default", async () => {
    const repo = makeRepo();
    await expect(new AuditService(repo).purgeExpired()).resolves.toBe(3);
    expect(repo.purgeOlderThan).toHaveBeenCalledWith(AUDIT_RETENTION_DAYS);
    expect(AUDIT_RETENTION_DAYS).toBe(180);
  });
});
