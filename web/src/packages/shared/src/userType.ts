// Mirrors runcodes-api's src/lib/constants.ts UserType — kept in sync by
// hand (small enough that generating it isn't worth the tooling yet).
export const UserType = {
  STUDENT: 0,
  ASSISTANT: 1,
  PROFESSOR: 2,
  ADMIN: 3,
  DEVELOPER: 4,
} as const;

export type UserTypeValue = (typeof UserType)[keyof typeof UserType];

export function userTypeLabel(type: number): string {
  switch (type) {
    case UserType.STUDENT:
      return "Aluno";
    case UserType.ASSISTANT:
      return "Assistente";
    case UserType.PROFESSOR:
      return "Professor";
    case UserType.ADMIN:
      return "Admin";
    case UserType.DEVELOPER:
      return "Desenvolvedor";
    default:
      return "—";
  }
}
