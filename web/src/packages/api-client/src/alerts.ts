import { apiFetch } from "./http";

export interface AlertRecord {
  id: number;
  type: number;
  offeringId: number | null;
  recipients: number;
  userEmail: string;
  valid: string;
  title: string;
  message: string;
}

export interface AlertInput {
  type: number;
  offeringId: number | null;
  recipients: number;
  valid: string;
  title: string;
  message: string;
}

export function listActiveAlerts(offeringId?: number): Promise<AlertRecord[]> {
  const qs = offeringId !== undefined ? `?offeringId=${offeringId}` : "";
  return apiFetch(`/alerts${qs}`);
}

export function listAllAlerts(
  page = 1,
  pageSize = 20,
): Promise<{ total: number; page: number; pageSize: number; alerts: AlertRecord[] }> {
  return apiFetch(`/alerts/all?page=${page}&pageSize=${pageSize}`);
}

export function getAlert(id: number): Promise<AlertRecord> {
  return apiFetch(`/alerts/${id}`);
}

/** Escrita exige type >= ASSISTANT (decisão do runcodes-api, diferente
 * do legado que não checava nada — ver alert.service.ts). */
export function createAlert(input: AlertInput): Promise<AlertRecord> {
  return apiFetch("/alerts", { method: "POST", body: JSON.stringify(input) });
}

export function updateAlert(id: number, input: Partial<AlertInput>): Promise<AlertRecord> {
  return apiFetch(`/alerts/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteAlert(id: number): Promise<void> {
  return apiFetch(`/alerts/${id}`, { method: "DELETE" });
}
