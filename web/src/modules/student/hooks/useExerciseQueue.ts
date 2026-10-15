import { useQueries, useQuery } from "@tanstack/react-query";
import { listMyOfferings, getOffering, type ExerciseListItem } from "@runcodes/api-client";
import { isApprovedScore } from "@runcodes/shared";

export interface QueueItem extends ExerciseListItem {
  offeringTitle: string;
  isOpen: boolean;
}

function isExerciseOpen(exercise: { openDate: string | null; deadline: string }): boolean {
  const now = Date.now();
  const opens = exercise.openDate ? new Date(exercise.openDate).getTime() : null;
  const ends = new Date(exercise.deadline).getTime();
  return (opens === null || opens <= now) && ends > now;
}

/** Fila de trabalho ordenada por urgência (não entregues primeiro, por
 * prazo mais próximo; aprovados por último) — mesma lógica de
 * PagesController::home_student() do legado, sem o corte em 5 itens.
 * Ver docs/frontend/journeys.md#dashboard--fila-de-trabalho-não-lista-de-turmas. */
export function useExerciseQueue() {
  const offeringsQuery = useQuery({ queryKey: ["offerings", "mine"], queryFn: listMyOfferings });
  const openOfferings = offeringsQuery.data?.open ?? [];

  const detailQueries = useQueries({
    queries: openOfferings.map((offering) => ({
      queryKey: ["offering", offering.id],
      queryFn: () => getOffering(offering.id),
      enabled: offeringsQuery.isSuccess,
    })),
  });

  const isLoading = offeringsQuery.isLoading || detailQueries.some((q) => q.isLoading);
  const isError = offeringsQuery.isError || detailQueries.some((q) => q.isError);

  const queue: QueueItem[] = detailQueries
    .flatMap((q) => {
      if (!q.data) return [];
      return q.data.exercises.map((exercise) => ({
        ...exercise,
        offeringTitle: q.data!.course?.title ?? `Turma #${q.data!.id}`,
        isOpen: isExerciseOpen(exercise),
      }));
    })
    .sort((a, b) => {
      const aApproved = isApprovedScore(a.myLatestCommit?.score ?? null);
      const bApproved = isApprovedScore(b.myLatestCommit?.score ?? null);
      if (aApproved !== bApproved) return aApproved ? 1 : -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  return {
    offerings: offeringsQuery.data,
    queue,
    isLoading,
    isError,
  };
}
