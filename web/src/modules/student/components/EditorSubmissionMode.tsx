import { type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { normalizeExtension } from "@runcodes/shared";
import { ProjectEditorMode } from "./ProjectEditorMode";
import { SingleFileEditorMode } from "./SingleFileEditorMode";

/** Dispatcher: exercício que aceita extensão "zip" vira projeto
 * multi-arquivo (`ProjectEditorMode`); qualquer outra extensão é o
 * editor de arquivo único de sempre. Decisão fica só na extensão
 * configurada pro exercício (admin já cadastra "zip" como tipo de
 * arquivo livremente, sem precisar de mudança de schema). */
export function EditorSubmissionMode({
  exercise,
  onSubmitted,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
}) {
  const extension = normalizeExtension(exercise.allowedFiles[0].extension);

  if (extension === "zip") {
    return <ProjectEditorMode exercise={exercise} onSubmitted={onSubmitted} />;
  }
  return <SingleFileEditorMode exercise={exercise} onSubmitted={onSubmitted} />;
}
