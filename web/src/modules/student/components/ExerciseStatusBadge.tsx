import { Badge } from "@runcodes/ui";
import { isApprovedScore, isCommitError, isCommitInProgress } from "@runcodes/shared";
import type { CommitRecord } from "@runcodes/api-client";

export function ExerciseStatusBadge({ commit }: { commit: CommitRecord | null }) {
  if (!commit) return <Badge variant="neutral">Não entregue</Badge>;
  if (isCommitInProgress(commit.status)) return <Badge variant="info">Em processamento</Badge>;
  if (isCommitError(commit.status)) return <Badge variant="danger">Erro</Badge>;
  if (isApprovedScore(commit.score)) return <Badge variant="success">Aprovado</Badge>;
  return <Badge variant="warning">Reprovado</Badge>;
}
