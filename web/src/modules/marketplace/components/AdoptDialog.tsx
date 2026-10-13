import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listMyOfferings, listOfferings, shareExercise } from "@runcodes/api-client";
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

/** Adoção = o mesmo shareToOffering() que já existe pro compartilhamento
 * direto entre turmas (docs/frontend/marketplace.md) — marketplace só
 * adiciona a camada de descoberta por cima. Depois de adotar, navega pra
 * rota do módulo teacher (gestão da turma), nunca importa componente de
 * lá — fronteira entre módulos. */
export function AdoptDialog({ exerciseId, title, trigger }: { exerciseId: number; title: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const { user } = useSession();
  const navigate = useNavigate();

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
    mutationFn: () => shareExercise(exerciseId, targetId!),
    onSuccess: (ghost) => {
      toast.success("Exercício adotado!");
      setOpen(false);
      navigate(`/turmas/${ghost.offeringId}/gerenciar`);
    },
    onError: () => toast.error("Não foi possível adotar o exercício"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Adotar exercício</DialogTitle>
          <DialogDescription>
            Cria uma cópia de "{title}" na turma escolhida — os casos de teste continuam apontando pro
            exercício original.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <EmptyState title="Você não é staff de nenhuma turma" />
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
            Adotar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
