// Mirrors runcodes-api's src/lib/constants.ts CommitStatus.
export const CommitStatus = {
  IN_QUEUE: 0,
  COMPILING: 1,
  COMPILED: 2,
  RUNNING: 3,
  UNCOMPLETED: 4,
  COMPLETED: 5,
  ERROR: 6,
  SUBMITTED: 7,
  PLAGIARISM: 8,
  SERVER_ERROR: 9,
} as const;

const IN_PROGRESS = new Set<number>([
  CommitStatus.IN_QUEUE,
  CommitStatus.COMPILING,
  CommitStatus.COMPILED,
  CommitStatus.RUNNING,
]);

const ERROR_STATUSES = new Set<number>([CommitStatus.ERROR, CommitStatus.SERVER_ERROR]);

export function isCommitInProgress(status: number): boolean {
  return IN_PROGRESS.has(status);
}

export function isCommitError(status: number): boolean {
  return ERROR_STATUSES.has(status);
}

// Mesmo limiar que OfferingsController::infographic() / MarketplaceStats
// já usam pra "aprovado" — reaproveitado aqui pra consistência, não uma
// regra nova inventada no cliente.
export function isApprovedScore(score: string | null): boolean {
  return score !== null && Number(score) > 5;
}

export function commitStatusLabel(status: number): string {
  switch (status) {
    case CommitStatus.IN_QUEUE:
      return "Na fila";
    case CommitStatus.COMPILING:
      return "Compilando";
    case CommitStatus.COMPILED:
      return "Compilado";
    case CommitStatus.RUNNING:
      return "Executando";
    case CommitStatus.UNCOMPLETED:
      return "Incompleto";
    case CommitStatus.COMPLETED:
      return "Corrigido";
    case CommitStatus.ERROR:
      return "Erro de compilação";
    case CommitStatus.SUBMITTED:
      return "Enviado";
    case CommitStatus.PLAGIARISM:
      return "Sob revisão (plágio)";
    case CommitStatus.SERVER_ERROR:
      return "Erro no servidor";
    default:
      return "—";
  }
}
