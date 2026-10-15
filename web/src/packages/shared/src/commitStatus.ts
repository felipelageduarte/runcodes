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

// Mirrors AppController::setCommitsMessages() do legado — só os sinais
// que de fato aparecem em código de aluno (erro de memória, timeout,
// abort), com texto mais curto e em pt-BR em vez da versão técnica
// completa do legado. Exposto pela primeira vez na Fase 11 (ver
// docs/roadmap/gap-audit-2026-10.md item 23) — o backend já guardava
// `compiledSignal`, mas nenhuma tela mostrava isso pro aluno.
const SIGNAL_MESSAGES: Record<string, string> = {
  SIGSEGV: "Acesso de memória inválido (segmentation fault) — provavelmente um ponteiro ou índice de array errado.",
  SIGABRT: "O programa chamou abort() — geralmente uma falha detectada pela própria linguagem/runtime (ex. assert).",
  SIGFPE: "Operação aritmética inválida, como divisão por zero.",
  SIGKILL: "Processo encerrado à força — provavelmente estourou o limite de tempo ou memória do exercício.",
  SIGBUS: "Erro de acesso à memória (endereço desalinhado ou inválido).",
  SIGTERM: "Processo recebeu pedido de encerramento — geralmente por estourar o tempo limite.",
  SIGILL: "O programa tentou executar uma instrução ilegal ou malformada.",
  SIGALRM: "Tempo limite de execução estourado.",
  SIGPIPE: "O programa tentou escrever num pipe sem leitor do outro lado.",
  SIGSTKFLT: "Erro de pilha (stack fault).",
};

/** null quando o commit não terminou por um sinal (não travou/estourou
 * limite) — a maioria dos commits de erro é erro de compilação comum,
 * não um sinal. */
export function commitSignalMessage(signal: string | null): string | null {
  if (!signal) return null;
  return SIGNAL_MESSAGES[signal] ?? `Processo encerrado pelo sinal ${signal}.`;
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
