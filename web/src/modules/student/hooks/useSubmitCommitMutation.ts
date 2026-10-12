import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitCommit, ApiError, type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { toast } from "@runcodes/ui";

/** Compartilhado entre o upload de arquivo e o editor Monaco — os dois
 * convergem no mesmo endpoint, só a origem do `File` muda (ver
 * docs/frontend/code-editor.md#fluxo-de-uso). */
export function useSubmitCommitMutation(exercise: ExerciseDetail, onSubmitted: (commit: CommitRecord) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => submitCommit(exercise.id, file),
    onSuccess: (commit) => {
      onSubmitted(commit);
      queryClient.invalidateQueries({ queryKey: ["exercise-commits", exercise.id] });
      toast.success("Enviado! Acompanhe o resultado abaixo.");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "file_type_not_allowed") {
        toast.error("Tipo de arquivo não aceito");
        return;
      }
      if (err instanceof ApiError && err.code === "file_too_large") {
        toast.error("Arquivo excede o limite de tamanho");
        return;
      }
      if (err instanceof ApiError && err.code === "exercise_closed") {
        toast.error("Este exercício está fechado para novas submissões");
        return;
      }
      toast.error("Não foi possível enviar sua submissão");
    },
  });
}
