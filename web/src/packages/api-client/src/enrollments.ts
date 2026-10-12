import { apiFetch } from "./http";

export interface EnrollmentRecord {
  id: number;
  offeringId: number;
  userEmail: string;
  role: number;
  banned: boolean;
}

export function enrollByCode(enrollmentCode: string): Promise<EnrollmentRecord> {
  return apiFetch("/enrollments", {
    method: "POST",
    body: JSON.stringify({ enrollment_code: enrollmentCode }),
  });
}
