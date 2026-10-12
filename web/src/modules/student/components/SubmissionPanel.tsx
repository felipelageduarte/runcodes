import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitCommit, ApiError, type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { extensionOfFilename, maxUploadSizeFor, normalizeExtension } from "@runcodes/shared";
import { Button, Card, CardContent, toast } from "@runcodes/ui";
import { Upload } from "lucide-react";

function validateFile(exercise: ExerciseDetail, file: File): string | null {
  const allowed = exercise.allowedFiles.map((f) => normalizeExtension(f.extension));
  const ext = extensionOfFilename(file.name);
  if (allowed.length > 0 && !allowed.includes(ext)) {
    return `Tipo de arquivo não aceito. Aceitos: .${allowed.join(", .")}`;
  }
  const maxSize = maxUploadSizeFor(exercise.type);
  if (file.size > maxSize) {
    return `Arquivo muito grande (máximo ${Math.round(maxSize / 1_000_000)}MB)`;
  }
  return null;
}

/** Upload de arquivo — o editor Monaco (Fase 2, docs/frontend/code-editor.md)
 * entra como alternativa a este mesmo fluxo, convergindo no mesmo botão
 * de submissão. */
export function SubmissionPanel({
  exercise,
  onSubmitted,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (f: File) => submitCommit(exercise.id, f),
    onSuccess: (commit) => {
      onSubmitted(commit);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
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

  function handleFileChange(selected: File | undefined) {
    if (!selected) return;
    const error = validateFile(exercise, selected);
    setValidationError(error);
    setFile(error ? null : selected);
  }

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
        <label
          htmlFor="commit-file"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center hover:bg-muted"
        >
          <Upload className="size-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {file ? file.name : "Clique para escolher um arquivo"}
          </span>
          <input
            ref={inputRef}
            id="commit-file"
            type="file"
            className="sr-only"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
        </label>
        {validationError && <p className="mt-2 text-xs text-danger">{validationError}</p>}
        <Button
          className="mt-4 w-full"
          disabled={!file}
          loading={mutation.isPending}
          onClick={() => file && mutation.mutate(file)}
        >
          Enviar submissão
        </Button>
      </CardContent>
    </Card>
  );
}
