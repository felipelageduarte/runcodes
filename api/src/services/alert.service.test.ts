import { describe, it, expect, vi } from "vitest";
import { AlertService } from "./alert.service.js";
import { ForbiddenError, NotFoundError } from "../domain/errors.js";
import type { AlertRepository, AlertRecord } from "../repositories/alert.repository.js";
import { UserType } from "../lib/constants.js";

const ALERT: AlertRecord = {
  id: 1,
  type: 0,
  offeringId: null,
  recipients: 2,
  userEmail: "prof@x.com",
  valid: new Date(),
  title: "Maintenance",
  message: "Downtime tonight",
};

function makeRepo(): AlertRepository {
  return {
    create: vi.fn().mockResolvedValue(ALERT),
    findById: vi.fn().mockResolvedValue(ALERT),
    listActive: vi.fn().mockResolvedValue([ALERT]),
    list: vi.fn().mockResolvedValue({ total: 1, alerts: [ALERT] }),
    update: vi.fn().mockResolvedValue({ ...ALERT, title: "Updated" }),
    delete: vi.fn().mockResolvedValue(true),
  };
}

const STUDENT = { email: "student@x.com", type: 0 };
const ASSISTANT = { email: "a@x.com", type: UserType.ASSISTANT };

describe("AlertService — writes require staff+ (not the legacy any-authenticated-user gap)", () => {
  it("is forbidden for a plain student to create", async () => {
    const repo = makeRepo();
    const service = new AlertService(repo);

    await expect(
      service.create(STUDENT, { type: 0, offeringId: null, recipients: 2, valid: new Date(), title: "t", message: "m" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("allows staff+ to create", async () => {
    const repo = makeRepo();
    const service = new AlertService(repo);

    await expect(
      service.create(ASSISTANT, {
        type: 0,
        offeringId: null,
        recipients: 2,
        valid: new Date(),
        title: "t",
        message: "m",
      }),
    ).resolves.toEqual(ALERT);
  });

  it("is forbidden for a plain student to update/delete", async () => {
    const repo = makeRepo();
    const service = new AlertService(repo);

    await expect(service.update(1, { title: "x" }, STUDENT)).rejects.toThrow(ForbiddenError);
    await expect(service.delete(1, STUDENT)).rejects.toThrow(ForbiddenError);
  });
});

describe("AlertService.listActive", () => {
  it("is open to anyone (no staff check)", async () => {
    const repo = makeRepo();
    const service = new AlertService(repo);

    await expect(service.listActive()).resolves.toEqual([ALERT]);
  });
});

describe("AlertService.getById", () => {
  it("throws NotFoundError when missing", async () => {
    const repo = makeRepo();
    repo.findById = vi.fn().mockResolvedValue(null);
    const service = new AlertService(repo);

    await expect(service.getById(999)).rejects.toThrow(NotFoundError);
  });
});
