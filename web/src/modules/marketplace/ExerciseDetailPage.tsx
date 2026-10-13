import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getMarketplaceExercise } from "@runcodes/api-client";
import { MarkdownContent } from "@runcodes/shared";
import { Badge, Button, Card, CardContent, EmptyState, Skeleton } from "@runcodes/ui";
import { DifficultyBadge } from "./components/DifficultyBadge";
import { AdoptDialog } from "./components/AdoptDialog";

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const exerciseId = Number(id);

  const query = useQuery({
    queryKey: ["marketplace", "exercise", exerciseId],
    queryFn: () => getMarketplaceExercise(exerciseId),
    enabled: Number.isInteger(exerciseId),
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <EmptyState title="Exercício não encontrado no marketplace" />
      </div>
    );
  }

  const exercise = query.data;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/marketplace" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" />
        Voltar ao marketplace
      </Link>

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">{exercise.title}</h1>
        <DifficultyBadge bucket={exercise.stats.difficultyBucket} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{exercise.originUniversity?.name ?? "Origem desconhecida"}</span>
        {exercise.languages.map((lang) => (
          <Badge key={lang} variant="neutral">
            {lang}
          </Badge>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <StatBlock label="Adoções" value={String(exercise.stats.adoptionCount)} />
          <StatBlock label="Alunos" value={String(exercise.stats.totalSubmitters)} />
          <StatBlock label="Taxa de acerto" value={`${exercise.stats.passRate.toFixed(0)}%`} />
          <StatBlock label="Nota média" value={exercise.stats.avgScore.toFixed(1)} />
        </CardContent>
      </Card>

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

      {exercise.keywords && <p className="mb-6 text-xs text-muted-foreground">Palavras-chave: {exercise.keywords}</p>}

      <AdoptDialog
        exerciseId={exercise.exerciseId}
        title={exercise.title}
        trigger={<Button>Adotar nesta turma</Button>}
      />
    </div>
  );
}
