import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOffering } from "@runcodes/api-client";
import { Badge, Card, CardContent, EmptyState, Skeleton } from "@runcodes/ui";
import { formatRelativeDeadline } from "@runcodes/shared";
import { ExerciseStatusBadge } from "./components/ExerciseStatusBadge";

export function OfferingPage() {
  const { id } = useParams<{ id: string }>();
  const offeringId = Number(id);

  const query = useQuery({
    queryKey: ["offering", offeringId],
    queryFn: () => getOffering(offeringId),
    enabled: Number.isInteger(offeringId),
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-2 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <EmptyState title="Não foi possível carregar essa turma" />
      </div>
    );
  }

  const offering = query.data;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {offering.course?.title ?? `Turma #${offering.id}`}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {offering.professors.map((p) => p.name).join(", ") || "Sem professor cadastrado"}
      </p>

      {offering.exercises.length === 0 ? (
        <EmptyState title="Nenhum exercício disponível nesta turma ainda" />
      ) : (
        <ul className="space-y-2">
          {offering.exercises.map((exercise) => (
            <li key={exercise.id}>
              <Link to={`/exercicios/${exercise.id}`}>
                <Card className="transition-colors hover:border-primary-300">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <p className="truncate font-medium text-foreground">{exercise.title}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <ExerciseStatusBadge commit={exercise.myLatestCommit} />
                      <Badge variant="neutral">{formatRelativeDeadline(exercise.deadline)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
