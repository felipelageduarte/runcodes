import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ApiError, publishExercise } from "@runcodes/api-client";
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
  level: z.coerce.number().int().min(0).max(5),
  keywords: z.string().optional(),
  obs: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

/** Marca o exercício como reutilizável no marketplace
 * (docs/frontend/marketplace.md) — professor+ pode publicar qualquer
 * exercício, não só o das próprias turmas (mirrors o legado). */
export function PublishDialog({ exerciseId, trigger }: { exerciseId: number; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { level: 1 } });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      publishExercise(exerciseId, {
        level: values.level,
        obs: values.obs?.trim() ? values.obs : null,
        keywords: values.keywords?.trim() ? values.keywords : null,
      }),
    onSuccess: () => {
      toast.success("Exercício publicado no marketplace");
      setOpen(false);
      reset();
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError && err.code === "already_published"
          ? "Esse exercício já foi publicado antes"
          : "Não foi possível publicar o exercício",
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Publicar no marketplace</DialogTitle>
          <DialogDescription>
            Outros professores (de qualquer instituição) vão poder descobrir e adotar esse exercício.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Dificuldade (0-5)" htmlFor="level" error={errors.level?.message}>
            <Input id="level" type="number" min={0} max={5} {...register("level")} />
          </FormField>
          <FormField label="Palavras-chave" htmlFor="keywords" hint="Separadas por espaço — usadas na busca.">
            <Input id="keywords" {...register("keywords")} />
          </FormField>
          <FormField label="Observações (opcional)" htmlFor="obs">
            <Input id="obs" {...register("obs")} />
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Publicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
