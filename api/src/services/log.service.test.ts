import { describe, it, expect, vi } from "vitest";
import { LogService } from "./log.service.js";
import type { LogRepository, LogRecord } from "../repositories/log.repository.js";

const LOG: LogRecord = { id: 1, userEmail: "a@x.com", datetime: new Date(), ip: "127.0.0.1", action: "Login" };

describe("LogService.list", () => {
  it("wraps the repository result with pagination metadata", async () => {
    const repo: LogRepository = {
      list: vi.fn().mockResolvedValue({ total: 1, logs: [LOG] }),
      create: vi.fn(),
    };
    const service = new LogService(repo);

    const result = await service.list({ page: 2, pageSize: 50 });

    expect(result).toEqual({ total: 1, page: 2, pageSize: 50, logs: [LOG] });
  });
});
