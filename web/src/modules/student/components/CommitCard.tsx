import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCommitCases, getCommitContent, type CommitRecord } from "@runcodes/api-client";
import { Badge, Button, Card } from "@runcodes/ui";
import { commitSignalMessage, commitStatusLabel, formatDateTime, isCommitError, isCommitInProgress } from "@runcodes/shared";
import { CommitCasesList } from "./CommitCasesList";

/** Ver o código de qualquer submissão do histórico, não só a mais
 * recente — o backend já aceitava isso (dono ou staff), só faltava a
 * UI consumir pra um commit que não fosse o último (ver
 * docs/roadmap/gap-audit-2026-10.md item 15). Sob demanda, clique por
 * clique, pra não disparar um request por commit só de abrir o card. */
function CommitCode({ commitId }: { commitId: number }) {
  const [show, setShow] = useState(false);
  const query = useQuery({
    queryKey: ["commit-content", commitId],
    queryFn: () => getCommitContent(commitId),
    enabled: show,
  });

  if (!show) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setShow(true)}>
        Ver código enviado
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      {query.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : query.data ? (
        <>
          <p className="text-xs text-muted-foreground">{query.data.filename}</p>
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {query.data.content}
          </pre>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Não foi possível carregar o código dessa submissão.</p>
      )}
    </div>
  );
}

export function CommitCard({ commit, defaultOpen = false }: { commit: CommitRecord; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const inProgress = isCommitInProgress(commit.status);

  const casesQuery = useQuery({
    queryKey: ["commit-cases", commit.id],
    queryFn: () => getCommitCases(commit.id),
    enabled: open,
    refetchInterval: open && inProgress ? 2000 : false,
  });

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="text-sm text-muted-foreground">{formatDateTime(commit.commitTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          {commit.score !== null && (
            <span className="text-sm font-medium text-foreground">Nota: {commit.score}</span>
          )}
          <Badge variant={inProgress ? "info" : "neutral"}>{commitStatusLabel(commit.status)}</Badge>
        </div>
      </button>
      {open && (
        <div className="border-t border-border">
          {commit.awsKey && (
            <div className="p-4 pb-0">
              <CommitCode commitId={commit.id} />
            </div>
          )}
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
          {casesQuery.data ? <CommitCasesList cases={casesQuery.data} /> : null}
        </div>
      )}
    </Card>
  );
}
