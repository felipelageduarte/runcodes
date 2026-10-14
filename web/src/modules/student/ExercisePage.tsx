import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  exerciseCasesDownloadUrl,
  getExercise,
  listExerciseFiles,
  exerciseFileDownloadUrl,
} from "@runcodes/api-client";
import {
  Badge,
  Button,
  EmptyState,
  PageContainer,
  PageHeader,
  SectionHeader,
  Skeleton,
} from "@runcodes/ui";
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
      <PageContainer width="wide" className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </PageContainer>
    );
  }

  if (exerciseQuery.isError || !exerciseQuery.data) {
    return (
      <PageContainer width="wide">
        <EmptyState title="Não foi possível carregar este exercício" />
      </PageContainer>
    );
  }

  const exercise = exerciseQuery.data;

  return (
    <PageContainer width="wide">
      <PageHeader
        title={exercise.title}
        crumbs={[
          { label: "Painel", to: "/" },
          {
            label: exercise.offering?.course?.title ?? "Turma",
            to: `/turmas/${exercise.offeringId}`,
          },
          { label: exercise.title },
        ]}
        className="mb-3 sm:mb-3"
        actions={
          <>
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
          </>
        }
      />

      <div className="mb-6 flex items-center gap-2">
        <Badge variant={exercise.isOpen ? "success" : "neutral"}>
          {exercise.isOpen ? formatRelativeDeadline(exercise.deadline) : "Fechado"}
        </Badge>
        {exercise.casesCount > 0 && (
          <Badge variant="neutral">
            {exercise.casesCount} caso{exercise.casesCount > 1 ? "s" : ""} de teste
          </Badge>
        )}
        {exercise.casesCount > 0 && (
          <a
            href={exerciseCasesDownloadUrl(exercise.id)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
          >
            <FileDown className="size-3.5" />
            Baixar casos de teste visíveis (.zip)
          </a>
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
              <SectionHeader title="Arquivos de apoio" className="mb-2" />
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
          <SectionHeader title="Enviar submissão" className="mb-2" />
          <SubmissionPanel exercise={exercise} onSubmitted={() => {}} />

          <SectionHeader title="Suas submissões" className="mb-2 mt-6" />
          <CommitHistory exerciseId={exercise.id} />
        </div>
      </div>
    </PageContainer>
  );
}
