import { describe, it, expect, vi } from "vitest";
import { DbAdminService } from "./db-admin.service.js";
import { ConflictError, ValidationError } from "../domain/errors.js";
import type { DbAdminRepository } from "../repositories/db-admin.repository.js";

function makeRepo(): DbAdminRepository {
  return {
    health: vi.fn(),
    schema: vi.fn(),
    runSelect: vi.fn().mockResolvedValue({ kind: "rows", columns: ["id"], rows: [{ id: 1 }] }),
    runMutation: vi.fn().mockResolvedValue({ kind: "mutation", rowsAffected: 1 }),
  };
}

describe("DbAdminService.runQuery", () => {
  it("runs a SELECT without requiring confirmation", async () => {
    const repo = makeRepo();
    const service = new DbAdminService(repo);

    const result = await service.runQuery("select * from users", false);

    expect(repo.runSelect).toHaveBeenCalledWith("select * from users");
    expect(result).toEqual({ kind: "rows", columns: ["id"], rows: [{ id: 1 }] });
  });

  it("rejects a destructive statement without confirm", async () => {
    const repo = makeRepo();
    const service = new DbAdminService(repo);

    await expect(service.runQuery("DELETE FROM users", false)).rejects.toThrow(ConflictError);
    expect(repo.runMutation).not.toHaveBeenCalled();
  });

  it("runs a destructive statement once confirmed", async () => {
    const repo = makeRepo();
    const service = new DbAdminService(repo);

    const result = await service.runQuery("DELETE FROM users WHERE email = 'x'", true);

    expect(repo.runMutation).toHaveBeenCalledWith("DELETE FROM users WHERE email = 'x'");
    expect(result).toEqual({ kind: "mutation", rowsAffected: 1 });
  });

  it("rejects an empty query", async () => {
    const repo = makeRepo();
    const service = new DbAdminService(repo);

    await expect(service.runQuery("   ", false)).rejects.toThrow(ValidationError);
  });

  it("rejects more than one statement", async () => {
    const repo = makeRepo();
    const service = new DbAdminService(repo);

    await expect(service.runQuery("SELECT 1; SELECT 2", false)).rejects.toThrow(ValidationError);
  });

  it("allows a trailing semicolon with nothing after it", async () => {
    const repo = makeRepo();
    const service = new DbAdminService(repo);

    await service.runQuery("select 1;", false);

    expect(repo.runSelect).toHaveBeenCalledWith("select 1;");
  });
});
