import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCommitContent, listCommitsForExercise, type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { normalizeExtension } from "@runcodes/shared";
import { Button, Skeleton } from "@runcodes/ui";
import { CodeEditor, languageForExtension, useDraft, useUnsavedChangesGuard } from "@runcodes/editor";
import { Play } from "lucide-react";
import { useEditorSubmission } from "../hooks/useEditorSubmission";
import { IdeExpandButton, IdeSurface } from "./IdeSurface";
import { ResizableConsole } from "./ResizableConsole";
import { SubmissionOutcome, SubmissionStatusBadge } from "./SubmissionOutcome";

export function SingleFileEditorMode({
  exercise,
  onSubmitted,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
}) {
  const extension = normalizeExtension(exercise.allowedFiles[0].extension);
  const { value, setValue, clearDraft } = useDraft(exercise.id, "");
  const [preloaded, setPreloaded] = useState(false);
  // Abre direto em tela cheia — a reclamação original era a área útil
  // de edição pequena; o modo embutido fica a um Esc de distância.
  const [expanded, setExpanded] = useState(true);

  // Só pré-carrega a última submissão se ainda não existe rascunho local
  // — o rascunho local tem prioridade (é o que o aluno estava editando).
  const commitsQuery = useQuery({
    queryKey: ["exercise-commits", exercise.id],
    queryFn: () => listCommitsForExercise(exercise.id),
    enabled: !preloaded && value === "",
  });
  const lastCommitId = commitsQuery.data?.[0]?.id;
  const contentQuery = useQuery({
    queryKey: ["commit-content", lastCommitId],
    queryFn: () => getCommitContent(lastCommitId!),
    enabled: !preloaded && value === "" && lastCommitId !== undefined,
  });

  useEffect(() => {
    if (preloaded || value !== "") return;
    if (contentQuery.data) {
      setValue(contentQuery.data.content);
      setPreloaded(true);
    } else if (commitsQuery.isSuccess && !lastCommitId) {
      setPreloaded(true); // nunca submeteu nada — nada pra pré-carregar
    }
  }, [contentQuery.data, commitsQuery.isSuccess, lastCommitId, preloaded, value, setValue]);

  const { mutation, activeCommitId, activeCommit, casesQuery } = useEditorSubmission(exercise, (commit) => {
    onSubmitted(commit);
    clearDraft();
  });

  useUnsavedChangesGuard(value.trim().length > 0 && !mutation.isPending);

  function handleSubmit() {
    const file = new File([value], `solution.${extension}`, { type: "text/plain" });
    mutation.mutate(file);
  }

  const loadingPreload = !preloaded && value === "" && (commitsQuery.isLoading || contentQuery.isFetching);

  return (
    <IdeSurface
      expanded={expanded}
      onCollapse={() => setExpanded(false)}
      statusItems={[`solution.${extension}`, languageForExtension(extension), `${value.split("\n").length} linhas`]}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">solution.{extension}</span>
        <div className="flex items-center gap-2">
          {activeCommit && <SubmissionStatusBadge status={activeCommit.status} />}
          <Button size="sm" disabled={!value.trim()} loading={mutation.isPending} onClick={handleSubmit}>
            <Play className="size-3.5" />
            Enviar submissão
          </Button>
          <IdeExpandButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {loadingPreload ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <CodeEditor value={value} onChange={setValue} extension={extension} />
        )}
      </div>

      {activeCommitId !== null && (
        <ResizableConsole>
          {activeCommit ? (
            <SubmissionOutcome commit={activeCommit} cases={casesQuery.data} />
          ) : (
            <p className="p-3 text-xs text-muted-foreground">Carregando resultado...</p>
          )}
        </ResizableConsole>
      )}
    </IdeSurface>
  );
}
