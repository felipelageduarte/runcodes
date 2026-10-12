import { describe, it, expect, vi } from "vitest";
import { AllowedFileService } from "./allowed-file.service.js";
import { NotFoundError } from "../domain/errors.js";
import type { AllowedFileRepository, AllowedFileRecord } from "../repositories/allowed-file.repository.js";

const PY: AllowedFileRecord = {
  id: 1,
  name: "Python 3",
  extension: "py",
  compilable: true,
  compileCommand: null,
  runCommand: null,
  available: true,
};

function makeRepo(): AllowedFileRepository {
  return {
    list: vi.fn().mockResolvedValue([PY]),
    findById: vi.fn().mockResolvedValue(PY),
    findByIds: vi.fn(),
    create: vi.fn().mockResolvedValue(PY),
    update: vi.fn().mockResolvedValue(PY),
  };
}

describe("AllowedFileService.getById", () => {
  it("throws NotFoundError when missing", async () => {
    const repo = makeRepo();
    repo.findById = vi.fn().mockResolvedValue(null);
    const service = new AllowedFileService(repo);

    await expect(service.getById(999)).rejects.toThrow(NotFoundError);
  });

  it("returns the file type when found", async () => {
    const repo = makeRepo();
    const service = new AllowedFileService(repo);

    await expect(service.getById(1)).resolves.toEqual(PY);
  });
});

describe("AllowedFileService.update", () => {
  it("throws NotFoundError for a missing file type", async () => {
    const repo = makeRepo();
    repo.update = vi.fn().mockResolvedValue(null);
    const service = new AllowedFileService(repo);

    await expect(service.update(999, { available: false })).rejects.toThrow(NotFoundError);
  });

  it("updates and returns the result", async () => {
    const repo = makeRepo();
    const service = new AllowedFileService(repo);

    await expect(service.update(1, { available: false })).resolves.toEqual(PY);
  });
});
