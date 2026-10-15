import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyOfferings, listOfferings, shareExercise, type ExerciseListItem } from "@runcodes/api-client";
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

/** Compartilhamento "ghost" — clona o exercício pra outra turma onde o
 * usuário é staff. Mirrors Exercise::createGhostExercise() do legado. */
export function ShareExerciseDialog({
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

  // Admin global pode compartilhar pra qualquer turma (requireStaffOrAdmin
  // do backend libera por tipo de conta, não por matrícula) — pra essa
  // conta o catálogo geral é o destino certo, não só "minhas turmas".
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
    ? (allOfferingsQuery.data?.offerings ?? []).filter((o) => o.id !== exercise.offeringId)
    : [...(myOfferingsQuery.data?.open ?? []), ...(myOfferingsQuery.data?.closed ?? [])].filter(
        (o) => o.id !== exercise.offeringId && isOfferingStaff(o, user?.email),
      );

  const mutation = useMutation({
    mutationFn: () => shareExercise(exercise.id, targetId!),
    onSuccess: () => {
      toast.success("Exercício compartilhado");
      queryClient.invalidateQueries({ queryKey: ["offering", targetId] });
      setOpen(false);
      setTargetId(null);
    },
    onError: () => toast.error("Não foi possível compartilhar o exercício"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Compartilhar exercício</DialogTitle>
          <DialogDescription>
            Cria uma cópia (ghost) de "{exercise.title}" em outra turma sua — casos de teste continuam
            apontando pro exercício original.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <EmptyState
            title={isAdmin ? "Nenhuma outra turma aberta encontrada" : "Você não é staff de nenhuma outra turma"}
          />
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
          <Button
            type="button"
            disabled={!targetId}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Compartilhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
