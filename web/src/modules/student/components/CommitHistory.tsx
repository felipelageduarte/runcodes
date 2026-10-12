import { useQuery } from "@tanstack/react-query";
import { listCommitsForExercise } from "@runcodes/api-client";
import { EmptyState, Skeleton } from "@runcodes/ui";
import { isCommitInProgress } from "@runcodes/shared";
import { CommitCard } from "./CommitCard";

/** Histórico de commits — painel na própria tela do exercício, sem
 * navegação (ver docs/frontend/journeys.md#jornada-do-aluno). Faz poll
 * enquanto a submissão mais recente estiver em processamento, parando
 * sozinho quando sair de IN_QUEUE/COMPILING/COMPILED/RUNNING. */
export function CommitHistory({ exerciseId }: { exerciseId: number }) {
  const query = useQuery({
    queryKey: ["exercise-commits", exerciseId],
    queryFn: () => listCommitsForExercise(exerciseId),
    refetchInterval: (q) => {
      const latest = q.state.data?.[0];
      return latest && isCommitInProgress(latest.status) ? 2000 : false;
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <EmptyState title="Não foi possível carregar suas submissões" />;
  }

  if (!query.data || query.data.length === 0) {
    return <EmptyState title="Você ainda não enviou nada para este exercício" />;
  }

  return (
    <div className="space-y-2">
      {query.data.map((commit, i) => (
        <CommitCard key={commit.id} commit={commit} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
