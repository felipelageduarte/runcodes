import type { OfferingSummary } from "@runcodes/api-client";

/** Papel por turma é independente do `type` global da conta — um aluno
 * pode ser assistente de UMA turma específica (ver
 * docs/backend/admin-and-support.md e offering-membership.service.ts).
 * Por isso a checagem de "é staff dessa turma" olha professors/assistants
 * do próprio offering, não `user.type`. */
export function isOfferingStaff(offering: OfferingSummary | undefined, email: string | undefined): boolean {
  if (!offering || !email) return false;
  return offering.professors.some((p) => p.email === email) || offering.assistants.some((a) => a.email === email);
}
