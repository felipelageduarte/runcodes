import { describe, it, expect, vi } from "vitest";
import { UniversityService } from "./university.service.js";
import { NotFoundError, ConflictError } from "../domain/errors.js";
import type { UniversityRepository, UniversityRecord } from "../repositories/university.repository.js";

const USP: UniversityRecord = {
  id: 1,
  abbreviation: "USP",
  name: "Universidade de São Paulo",
  studentIdentifierText: "Número USP",
  type: 1,
  state: "SP",
};

function makeRepo(): UniversityRepository {
  return {
    findByIds: vi.fn(),
    findById: vi.fn().mockResolvedValue(USP),
    list: vi.fn().mockResolvedValue([USP]),
    existsByAbbreviation: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue(USP),
    update: vi.fn().mockResolvedValue(USP),
  };
}

describe("UniversityService.getById", () => {
  it("throws NotFoundError when missing", async () => {
    const repo = makeRepo();
    repo.findById = vi.fn().mockResolvedValue(null);
    const service = new UniversityService(repo);

    await expect(service.getById(999)).rejects.toThrow(NotFoundError);
  });

  it("returns the university when found", async () => {
    const repo = makeRepo();
    const service = new UniversityService(repo);

    await expect(service.getById(1)).resolves.toEqual(USP);
  });
});

describe("UniversityService.create", () => {
  it("rejects a duplicate abbreviation", async () => {
    const repo = makeRepo();
    repo.existsByAbbreviation = vi.fn().mockResolvedValue(true);
    const service = new UniversityService(repo);

    await expect(
      service.create({ abbreviation: "USP", name: "X", studentIdentifierText: null, type: 1, state: "SP" }),
    ).rejects.toThrow(ConflictError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("creates when the abbreviation is free", async () => {
    const repo = makeRepo();
    const service = new UniversityService(repo);

    await expect(
      service.create({ abbreviation: "UNI", name: "X", studentIdentifierText: null, type: 1, state: "SP" }),
    ).resolves.toEqual(USP);
  });
});

describe("UniversityService.update", () => {
  it("throws NotFoundError for a missing university", async () => {
    const repo = makeRepo();
    repo.update = vi.fn().mockResolvedValue(null);
    const service = new UniversityService(repo);

    await expect(service.update(999, { name: "New name" })).rejects.toThrow(NotFoundError);
  });

  it("allows keeping the same abbreviation on update", async () => {
    const repo = makeRepo();
    repo.existsByAbbreviation = vi.fn().mockResolvedValue(true); // it's USP's own
    const service = new UniversityService(repo);

    await expect(service.update(1, { abbreviation: "USP" })).resolves.toEqual(USP);
  });

  it("rejects switching to an abbreviation already used by another university", async () => {
    const repo = makeRepo();
    repo.existsByAbbreviation = vi.fn().mockResolvedValue(true);
    repo.findById = vi.fn().mockResolvedValue({ ...USP, abbreviation: "OTHER" });
    const service = new UniversityService(repo);

    await expect(service.update(1, { abbreviation: "USP" })).rejects.toThrow(ConflictError);
  });
});
