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

type Mode = "upload" | "editor";

/** Upload de arquivo e editor Monaco convergem no mesmo endpoint de
 * submissão — ver docs/frontend/code-editor.md. */
export function SubmissionPanel({
  exercise,
  onSubmitted,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
}) {
  const [mode, setMode] = useState<Mode>("upload");
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

  return (
    <Card>
      <CardContent className="p-4">
        {canUseEditor && (
          <div className="mb-4 flex gap-2">
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

        {mode === "editor" && canUseEditor ? (
          <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
            <EditorSubmissionMode exercise={exercise} onSubmitted={onSubmitted} />
          </Suspense>
        ) : (
          <FileUploadMode exercise={exercise} onSubmitted={onSubmitted} />
        )}
      </CardContent>
    </Card>
  );
}
