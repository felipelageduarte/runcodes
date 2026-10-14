import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOffering } from "@runcodes/api-client";
import {
  Badge,
  CardContent,
  EmptyState,
  InteractiveCard,
  PageContainer,
  PageHeader,
  Skeleton,
  StaggerItem,
  StaggerList,
} from "@runcodes/ui";
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
      <PageContainer width="default" className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </PageContainer>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PageContainer width="default">
        <EmptyState title="Não foi possível carregar essa turma" />
      </PageContainer>
    );
  }

  const offering = query.data;

  return (
    <PageContainer width="default">
      <PageHeader
        title={offering.course?.title ?? `Turma #${offering.id}`}
        subtitle={offering.professors.map((p) => p.name).join(", ") || "Sem professor cadastrado"}
        crumbs={[
          { label: "Painel", to: "/" },
          { label: offering.course?.title ?? `Turma #${offering.id}` },
        ]}
      />

      {offering.exercises.length === 0 ? (
        <EmptyState title="Nenhum exercício disponível nesta turma ainda" />
      ) : (
        <StaggerList className="space-y-2">
          {offering.exercises.map((exercise) => (
            <StaggerItem key={exercise.id}>
              <Link to={`/exercicios/${exercise.id}`}>
                <InteractiveCard>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <p className="truncate font-medium text-foreground">{exercise.title}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <ExerciseStatusBadge commit={exercise.myLatestCommit} />
                      <Badge variant="neutral">{formatRelativeDeadline(exercise.deadline)}</Badge>
                    </div>
                  </CardContent>
                </InteractiveCard>
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </PageContainer>
  );
}
