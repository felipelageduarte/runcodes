import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editCommitScore } from "@runcodes/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  toast,
} from "@runcodes/ui";

const schema = z.object({
  score: z.coerce.number().min(0).max(10),
  status: z.coerce.number().int().min(0).max(9),
});
type FormValues = z.input<typeof schema>;

const statusOptions = [
  { value: 4, label: "Incompleto" },
  { value: 5, label: "Completo" },
  { value: 6, label: "Erro" },
  { value: 7, label: "Enviado (correção manual)" },
  { value: 9, label: "Erro no servidor" },
];

/** Professor sobrescreve nota/status manualmente — mirrors
 * CommitsController::editScore(). Ver docs/roadmap/gap-audit-2026-10.md
 * item 3: sem equivalente antes dessa fase. */
export function EditScoreDialog({
  commitId,
  currentScore,
  currentStatus,
  exerciseId,
  trigger,
}: {
  commitId: number;
  currentScore: string | null;
  currentStatus: number;
  exerciseId: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { score: Number(currentScore ?? 0), status: currentStatus },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => editCommitScore(commitId, values),
    onSuccess: () => {
      toast.success("Nota atualizada");
      queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId] });
      setOpen(false);
    },
    onError: () => toast.error("Não foi possível atualizar a nota"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Editar nota/status</DialogTitle>
          <DialogDescription>Sobrescreve o resultado desse commit manualmente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Nota (0-10)" htmlFor="score" error={errors.score?.message}>
            <Input id="score" type="number" step="0.1" min={0} max={10} {...register("score")} />
          </FormField>
          <FormField label="Status" htmlFor="status">
            <select
              id="status"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("status")}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
