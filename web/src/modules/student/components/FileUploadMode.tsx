import { useRef, useState } from "react";
import { type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { extensionOfFilename, maxUploadSizeFor, normalizeExtension } from "@runcodes/shared";
import { Button } from "@runcodes/ui";
import { Upload } from "lucide-react";
import { useSubmitCommitMutation } from "../hooks/useSubmitCommitMutation";

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

export function FileUploadMode({
  exercise,
  onSubmitted,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useSubmitCommitMutation(exercise, (commit) => {
    onSubmitted(commit);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  });

  function handleFileChange(selected: File | undefined) {
    if (!selected) return;
    const error = validateFile(exercise, selected);
    setValidationError(error);
    setFile(error ? null : selected);
  }

  return (
    <div>
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
    </div>
  );
}
