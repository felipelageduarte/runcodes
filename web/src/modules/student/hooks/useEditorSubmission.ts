import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCommit, getCommitCases, type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { isCommitInProgress } from "@runcodes/shared";
import { useSubmitCommitMutation } from "./useSubmitCommitMutation";

/** Console ao vivo do editor (toolbar + painel de resultado) — polling
 * do commit recém-enviado até sair de in-progress. Compartilhado entre
 * o modo de arquivo único e o modo de projeto multi-arquivo, que só
 * diferem em como montam o `File` enviado. */
export function useEditorSubmission(exercise: ExerciseDetail, onSubmitted: (commit: CommitRecord) => void) {
  const [activeCommitId, setActiveCommitId] = useState<number | null>(null);

  const mutation = useSubmitCommitMutation(exercise, (commit) => {
    onSubmitted(commit);
    setActiveCommitId(commit.id);
  });

  const activeCommitQuery = useQuery({
    queryKey: ["commit", activeCommitId],
    queryFn: () => getCommit(activeCommitId!),
    enabled: activeCommitId !== null,
    refetchInterval: (q) => (q.state.data && isCommitInProgress(q.state.data.status) ? 2000 : false),
  });
  const activeCommit = activeCommitQuery.data;

  const casesQuery = useQuery({
    queryKey: ["commit-cases", activeCommitId],
    queryFn: () => getCommitCases(activeCommitId!),
    enabled: activeCommitId !== null,
    refetchInterval: activeCommit && isCommitInProgress(activeCommit.status) ? 2000 : false,
  });

  return { mutation, activeCommitId, activeCommit, casesQuery };
}
