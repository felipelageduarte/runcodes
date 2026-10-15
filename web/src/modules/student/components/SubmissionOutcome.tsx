import type { CommitCaseResult, CommitRecord } from "@runcodes/api-client";
import { commitSignalMessage, commitStatusLabel, isCommitError, isCommitInProgress } from "@runcodes/shared";
import { Badge } from "@runcodes/ui";
import { CommitCasesList } from "./CommitCasesList";

/** Badge de status compartilhada entre o console ao vivo do editor e o
 * histórico de commits — mesma lógica de cor em ambos os lugares. */
export function SubmissionStatusBadge({ status }: { status: CommitRecord["status"] }) {
  return <Badge variant={isCommitInProgress(status) ? "info" : "neutral"}>{commitStatusLabel(status)}</Badge>;
}

/** Corpo do resultado de uma submissão (erro de compilação/execução +
 * casos de teste) — compartilhado entre `EditorSubmissionMode` (console
 * ao vivo) e `CommitCard` (histórico). */
export function SubmissionOutcome({ commit, cases }: { commit: CommitRecord; cases?: CommitCaseResult[] }) {
  return (
    <>
      {isCommitError(commit.status) && (commit.compiledMessage || commit.compiledSignal) && (
        <div className="space-y-2 p-4 text-sm">
          {commit.compiledSignal && (
            <p className="text-danger">
              <span className="font-mono font-medium">{commit.compiledSignal}</span> —{" "}
              {commitSignalMessage(commit.compiledSignal)}
            </p>
          )}
          {commit.compiledMessage && (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
              {commit.compiledMessage}
            </pre>
          )}
        </div>
      )}
      {cases ? <CommitCasesList cases={cases} /> : null}
    </>
  );
}
