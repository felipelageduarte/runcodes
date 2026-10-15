import { lazy, Suspense, useState } from "react";
import { type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { isCompilableExerciseType } from "@runcodes/shared";
import { Button, Card, CardContent, Skeleton } from "@runcodes/ui";
import { Code2, Upload } from "lucide-react";
import { FileUploadMode } from "./FileUploadMode";

// Code-split: Monaco (~1MB) só entra no bundle se o aluno realmente
// alternar pro modo editor — a maioria dos exercícios é 1 arquivo
// enviado do computador, não vale carregar o editor pra quem nunca abre.
const EditorSubmissionMode = lazy(() =>
  import("./EditorSubmissionMode").then((m) => ({ default: m.EditorSubmissionMode })),
);

export type SubmissionMode = "upload" | "editor";

/** Upload de arquivo e editor Monaco convergem no mesmo endpoint de
 * submissão — ver docs/frontend/code-editor.md. Modo é controlável de
 * fora (ExercisePage usa isso pra saber quando trocar pro layout de
 * IDE em tela cheia); sem o prop, funciona não-controlado como antes. */
export function SubmissionPanel({
  exercise,
  onSubmitted,
  mode: controlledMode,
  onModeChange,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
  mode?: SubmissionMode;
  onModeChange?: (mode: SubmissionMode) => void;
}) {
  const [internalMode, setInternalMode] = useState<SubmissionMode>("upload");
  const mode = controlledMode ?? internalMode;
  function setMode(next: SubmissionMode) {
    setInternalMode(next);
    onModeChange?.(next);
  }
  const canUseEditor = isCompilableExerciseType(exercise.type) && exercise.allowedFiles.length > 0;

  if (!exercise.isOpen) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Este exercício está fechado para novas submissões.
        </CardContent>
      </Card>
    );
  }

  const isIde = mode === "editor" && canUseEditor;

  return (
    <Card className={isIde ? "flex h-full flex-col" : undefined}>
      <CardContent className={isIde ? "flex min-h-0 flex-1 flex-col p-4" : "p-4"}>
        {canUseEditor && (
          <div className="mb-4 flex shrink-0 gap-2">
            <Button
              variant={mode === "upload" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("upload")}
            >
              <Upload className="size-4" />
              Enviar arquivo
            </Button>
            <Button
              variant={mode === "editor" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("editor")}
            >
              <Code2 className="size-4" />
              Escrever código
            </Button>
          </div>
        )}

        {isIde ? (
          <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
            <div className="min-h-0 flex-1">
              <EditorSubmissionMode exercise={exercise} onSubmitted={onSubmitted} />
            </div>
          </Suspense>
        ) : (
          <FileUploadMode exercise={exercise} onSubmitted={onSubmitted} />
        )}
      </CardContent>
    </Card>
  );
}
