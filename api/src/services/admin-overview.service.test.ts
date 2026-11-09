import { describe, it, expect, vi } from "vitest";
import { AdminOverviewService } from "./admin-overview.service.js";
import type { AdminOverviewRepository, OverviewSnapshot } from "../repositories/admin-overview.repository.js";
import type { DbHealth } from "../repositories/db-admin.repository.js";

const snapshot: OverviewSnapshot = {
  usersByType: [
    { type: 0, count: 120 },
    { type: 2, count: 7 },
    { type: 3, count: 1 },
  ],
  commitsQueued: 4,
  commitsStuck: 1,
  compilationErrors24h: 9,
  serverErrors24h: 0,
  ticketsOpen: 2,
  alertsActive: 1,
};

const health: DbHealth = {
  connections: 3,
  maxConnections: 100,
  connectionsByState: [{ state: "idle", count: 3 }],
  databaseSizeBytes: 1024,
  uptimeSeconds: 3600,
};

function makeRepo(): AdminOverviewRepository {
  return { snapshot: vi.fn().mockResolvedValue(snapshot) };
}

function makeService(repo = makeRepo(), dbHealth = vi.fn().mockResolvedValue(health)) {
  let clock = 1_000_000;
  const now = () => clock;
  const advance = (ms: number) => {
    clock += ms;
  };
  const service = new AdminOverviewService(repo, { health: dbHealth }, 30_000, now);
  return { service, repo, dbHealth, advance };
}

describe("AdminOverviewService.get", () => {
  it("aggregates the snapshot with database health and the window used", async () => {
    const { service, repo, dbHealth } = makeService();

    const result = await service.get(15);

    expect(repo.snapshot).toHaveBeenCalledWith(15);
    expect(dbHealth).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ...snapshot,
      stuckMinutes: 15,
      database: { ok: true, health },
    });
    expect(result.generatedAt).toBe(new Date(1_000_000).toISOString());
  });

  it("defaults the stuck window to 15 minutes", async () => {
    const { service, repo } = makeService();

    const result = await service.get();

    expect(repo.snapshot).toHaveBeenCalledWith(15);
    expect(result.stuckMinutes).toBe(15);
  });

  it("serves from cache for 30 s and re-reads after the TTL", async () => {
    const { service, repo, dbHealth, advance } = makeService();

    const first = await service.get(15);
    advance(29_999);
    const second = await service.get(15);

    expect(second).toBe(first);
    expect(repo.snapshot).toHaveBeenCalledTimes(1);
    expect(dbHealth).toHaveBeenCalledTimes(1);

    advance(1);
    const third = await service.get(15);

    expect(third).not.toBe(first);
    expect(repo.snapshot).toHaveBeenCalledTimes(2);
  });

  it("caches per stuck-window value", async () => {
    const { service, repo } = makeService();

    await service.get(15);
    await service.get(30);
    await service.get(15);

    expect(repo.snapshot).toHaveBeenCalledTimes(2);
    expect(repo.snapshot).toHaveBeenNthCalledWith(2, 30);
  });

  it("keeps the counters when database health fails", async () => {
    const { service } = makeService(makeRepo(), vi.fn().mockRejectedValue(new Error("pg_stat_activity: permission denied")));

    const result = await service.get(15);

    expect(result.commitsQueued).toBe(4);
    expect(result.database).toEqual({ ok: false, error: "pg_stat_activity: permission denied" });
  });

  it("propagates a failure of the aggregated query", async () => {
    const repo: AdminOverviewRepository = { snapshot: vi.fn().mockRejectedValue(new Error("boom")) };
    const { service } = makeService(repo);

    await expect(service.get(15)).rejects.toThrow("boom");
  });

  it("invalidate() forces the next read to hit the repository", async () => {
    const { service, repo } = makeService();

    await service.get(15);
    service.invalidate();
    await service.get(15);

    expect(repo.snapshot).toHaveBeenCalledTimes(2);
  });
});
