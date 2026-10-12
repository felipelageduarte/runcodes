import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCommitContent, listCommitsForExercise, type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { normalizeExtension } from "@runcodes/shared";
import { Button, Skeleton } from "@runcodes/ui";
import { CodeEditor, useDraft, useUnsavedChangesGuard } from "@runcodes/editor";
import { useSubmitCommitMutation } from "../hooks/useSubmitCommitMutation";

export function EditorSubmissionMode({
  exercise,
  onSubmitted,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
}) {
  const extension = normalizeExtension(exercise.allowedFiles[0].extension);
  const { value, setValue, clearDraft } = useDraft(exercise.id, "");
  const [preloaded, setPreloaded] = useState(false);

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

  const mutation = useSubmitCommitMutation(exercise, (commit) => {
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
    <div>
      <div className="overflow-hidden rounded-md border border-border">
        {loadingPreload ? (
          <Skeleton className="h-[60vh] w-full rounded-none" />
        ) : (
          <CodeEditor value={value} onChange={setValue} extension={extension} />
        )}
      </div>
      <Button className="mt-4 w-full" disabled={!value.trim()} loading={mutation.isPending} onClick={handleSubmit}>
        Enviar submissão
      </Button>
    </div>
  );
}
