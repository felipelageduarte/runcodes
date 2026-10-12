import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getExercise, listExerciseFiles, exerciseFileDownloadUrl } from "@runcodes/api-client";
import { Badge, Button, EmptyState, Skeleton } from "@runcodes/ui";
import { formatRelativeDeadline, googleCalendarUrl, MarkdownContent } from "@runcodes/shared";
import { CalendarPlus, Eye, EyeOff, FileDown } from "lucide-react";
import { SubmissionPanel } from "./components/SubmissionPanel";
import { CommitHistory } from "./components/CommitHistory";
import { LanguageAgreements } from "./components/LanguageAgreements";

export function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const exerciseId = Number(id);
  const [showDescription, setShowDescription] = useState(true);

  const exerciseQuery = useQuery({
    queryKey: ["exercise", exerciseId],
    queryFn: () => getExercise(exerciseId),
    enabled: Number.isInteger(exerciseId),
  });

  const filesQuery = useQuery({
    queryKey: ["exercise-files", exerciseId],
    queryFn: () => listExerciseFiles(exerciseId),
    enabled: Number.isInteger(exerciseId),
  });

  if (exerciseQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-2 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (exerciseQuery.isError || !exerciseQuery.data) {
    return (
      <div className="p-6">
        <EmptyState title="Não foi possível carregar este exercício" />
      </div>
    );
  }

  const exercise = exerciseQuery.data;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">{exercise.title}</h1>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDescription((v) => !v)}>
            {showDescription ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showDescription ? "Esconder enunciado" : "Mostrar enunciado"}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={googleCalendarUrl(exercise.title, exercise.deadline)} target="_blank" rel="noreferrer">
              <CalendarPlus className="size-4" />
              Google Calendar
            </a>
          </Button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Badge variant={exercise.isOpen ? "success" : "neutral"}>
          {exercise.isOpen ? formatRelativeDeadline(exercise.deadline) : "Fechado"}
        </Badge>
        {exercise.casesCount > 0 && (
          <Badge variant="neutral">
            {exercise.casesCount} caso{exercise.casesCount > 1 ? "s" : ""} de teste
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {showDescription && (
            <div className="mb-6">
              {exercise.description ? (
                exercise.markdown ? (
                  <MarkdownContent content={exercise.description} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-foreground">{exercise.description}</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Sem enunciado.</p>
              )}
            </div>
          )}

          <LanguageAgreements allowedFiles={exercise.allowedFiles} />

          {exercise.allowedFiles.length > 0 && (
            <p className="mb-4 text-xs text-muted-foreground">
              Tipos aceitos: {exercise.allowedFiles.map((f) => f.name).join(", ")}
            </p>
          )}

          {filesQuery.data && filesQuery.data.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Arquivos de apoio</h2>
              <ul className="space-y-1">
                {filesQuery.data.map((file) => (
                  <li key={file.id}>
                    <a
                      href={exerciseFileDownloadUrl(file.id)}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:underline"
                    >
                      <FileDown className="size-4" />
                      {file.path}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Enviar submissão</h2>
          <SubmissionPanel exercise={exercise} onSubmitted={() => {}} />

          <h2 className="mb-2 mt-6 text-sm font-medium text-muted-foreground">Suas submissões</h2>
          <CommitHistory exerciseId={exercise.id} />
        </div>
      </div>
    </div>
  );
}
