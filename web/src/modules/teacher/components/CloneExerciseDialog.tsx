import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloneExercise, listMyOfferings, listOfferings, type ExerciseListItem } from "@runcodes/api-client";
import { useSession } from "@runcodes/auth";
import { UserType, isOfferingStaff } from "@runcodes/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  toast,
} from "@runcodes/ui";

/** Cópia independente — mirrors `ExerciseManagementService.cloneExercise()`,
 * diferente de `ShareExerciseDialog` (ghost, continua ligado ao
 * original). Útil pra reaproveitar casos de teste como ponto de
 * partida de um exercício novo e editável à parte. Mesma lógica de
 * destinos de `ShareExerciseDialog` — ver gap-audit-2026-10.md item 16. */
export function CloneExerciseDialog({
  exercise,
  trigger,
}: {
  exercise: ExerciseListItem;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const { user } = useSession();
  const queryClient = useQueryClient();

  const isAdmin = (user?.type ?? -1) >= UserType.ADMIN;

  const myOfferingsQuery = useQuery({
    queryKey: ["offerings", "mine"],
    queryFn: listMyOfferings,
    enabled: open && !isAdmin,
  });
  const allOfferingsQuery = useQuery({
    queryKey: ["offerings", "all"],
    queryFn: () => listOfferings({ closed: false }),
    enabled: open && isAdmin,
  });

  const targets = isAdmin
    ? (allOfferingsQuery.data?.offerings ?? [])
    : [...(myOfferingsQuery.data?.open ?? []), ...(myOfferingsQuery.data?.closed ?? [])].filter((o) =>
        isOfferingStaff(o, user?.email),
      );

  const mutation = useMutation({
    mutationFn: () => cloneExercise(exercise.id, targetId!),
    onSuccess: (clone) => {
      toast.success("Exercício clonado");
      queryClient.invalidateQueries({ queryKey: ["offering", targetId] });
      queryClient.invalidateQueries({ queryKey: ["exercise", clone.id] });
      setOpen(false);
      setTargetId(null);
    },
    onError: () => toast.error("Não foi possível clonar o exercício"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Clonar exercício</DialogTitle>
          <DialogDescription>
            Cria uma cópia independente de "{exercise.title}" (enunciado + casos de teste) numa turma sua — editar
            a cópia não afeta o original.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <EmptyState title={isAdmin ? "Nenhuma turma aberta encontrada" : "Você não é staff de nenhuma turma"} />
        ) : (
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={targetId ?? ""}
            onChange={(e) => setTargetId(Number(e.target.value))}
          >
            <option value="" disabled>
              Escolha a turma destino
            </option>
            {targets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.course?.title ?? `Turma #${o.id}`}
              </option>
            ))}
          </select>
        )}
        <DialogFooter>
          <Button type="button" disabled={!targetId} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Clonar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
