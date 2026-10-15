import type { AlertRepository, AlertRecord, AlertPatch } from "../repositories/alert.repository.js";
import { UserType } from "../lib/constants.js";
import { NotFoundError, ForbiddenError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export interface NewAlertInput {
  type: number;
  offeringId: number | null;
  recipients: number;
  valid: Date;
  title: string;
  message: string;
}

/**
 * Mirrors AlertsController functionally, not literally: the legacy
 * controller has no isAuthorized() override, which means it inherits
 * AppController's default (`return true`) — any authenticated user,
 * including a student, can publish/edit/delete alerts site-wide. That
 * reads as an oversight, not an intentional product decision, so this
 * gates writes behind staff+ (type >= ASSISTANT) instead. Reading
 * active alerts stays open to anyone authenticated.
 */
export class AlertService {
  constructor(private readonly alerts: AlertRepository) {}

  private requireStaff(requester: Requester): void {
    if (requester.type < UserType.ASSISTANT) throw new ForbiddenError();
  }

  listActive(offeringId?: number): Promise<AlertRecord[]> {
    return this.alerts.listActive(offeringId);
  }

  async list(page: number, pageSize: number, requester: Requester) {
    this.requireStaff(requester);
    const { total, alerts } = await this.alerts.list(page, pageSize);
    return { total, page, pageSize, alerts };
  }

  async getById(id: number): Promise<AlertRecord> {
    const alert = await this.alerts.findById(id);
    if (!alert) throw new NotFoundError("Alert not found");
    return alert;
  }

  async create(requester: Requester, input: NewAlertInput): Promise<AlertRecord> {
    this.requireStaff(requester);
    return this.alerts.create({ ...input, userEmail: requester.email });
  }

  async update(id: number, patch: AlertPatch, requester: Requester): Promise<AlertRecord> {
    this.requireStaff(requester);
    const updated = await this.alerts.update(id, patch);
    if (!updated) throw new NotFoundError("Alert not found");
    return updated;
  }

  async delete(id: number, requester: Requester): Promise<void> {
    this.requireStaff(requester);
    if (!(await this.alerts.delete(id))) throw new NotFoundError("Alert not found");
  }
}
