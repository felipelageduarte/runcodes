import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUniversity, updateUniversity, type UniversitySummary } from "@runcodes/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  toast,
} from "@runcodes/ui";

const schema = z.object({
  abbreviation: z.string().min(2, "Mínimo 2 caracteres").max(15),
  name: z.string().min(1, "Informe o nome"),
  studentIdentifierText: z.string().optional(),
  state: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

export function UniversityFormDialog({
  existing,
  trigger,
}: {
  existing?: UniversitySummary;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          abbreviation: existing.abbreviation,
          name: existing.name,
          studentIdentifierText: existing.studentIdentifierText ?? "",
          state: existing.state ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = {
        abbreviation: values.abbreviation,
        name: values.name,
        studentIdentifierText: values.studentIdentifierText?.trim() ? values.studentIdentifierText : null,
        type: null,
        state: values.state?.trim() ? values.state : null,
      };
      return existing ? updateUniversity(existing.id, input) : createUniversity(input);
    },
    onSuccess: () => {
      toast.success(existing ? "Instituição atualizada" : "Instituição criada");
      queryClient.invalidateQueries({ queryKey: ["universities"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Não foi possível salvar — sigla já pode estar em uso"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>{existing ? "Editar instituição" : "Nova instituição"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Sigla" htmlFor="abbreviation" error={errors.abbreviation?.message}>
            <Input id="abbreviation" {...register("abbreviation")} />
          </FormField>
          <FormField label="Nome" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...register("name")} />
          </FormField>
          <FormField label="Texto do identificador de aluno" htmlFor="studentIdentifierText" hint="Ex: RA, Matrícula">
            <Input id="studentIdentifierText" {...register("studentIdentifierText")} />
          </FormField>
          <FormField label="Estado (UF)" htmlFor="state">
            <Input id="state" maxLength={5} {...register("state")} />
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
