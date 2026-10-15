import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAllowedFile, updateAllowedFile, type AllowedFile } from "@runcodes/api-client";
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
  name: z.string().min(1, "Informe o nome"),
  extension: z.string().min(1, "Informe a extensão"),
  compilable: z.boolean().default(true),
  compileCommand: z.string().optional(),
  runCommand: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

export function AllowedFileFormDialog({ existing, trigger }: { existing?: AllowedFile; trigger: React.ReactNode }) {
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
          name: existing.name,
          extension: existing.extension,
          compilable: existing.compilable ?? true,
          compileCommand: existing.compileCommand ?? "",
          runCommand: existing.runCommand ?? "",
        }
      : { compilable: true },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = {
        name: values.name,
        extension: values.extension,
        compilable: values.compilable ?? true,
        compileCommand: values.compileCommand?.trim() ? values.compileCommand : null,
        runCommand: values.runCommand?.trim() ? values.runCommand : null,
      };
      return existing ? updateAllowedFile(existing.id, input) : createAllowedFile(input);
    },
    onSuccess: () => {
      toast.success(existing ? "Tipo de arquivo atualizado" : "Tipo de arquivo criado");
      queryClient.invalidateQueries({ queryKey: ["allowed-files", "all"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Não foi possível salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>{existing ? "Editar tipo de arquivo" : "Novo tipo de arquivo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Nome" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...register("name")} />
          </FormField>
          <FormField label="Extensão" htmlFor="extension" error={errors.extension?.message} hint="Ex: py, c, cpp">
            <Input id="extension" {...register("extension")} />
          </FormField>
          <div className="mb-4 flex items-center gap-2">
            <input id="compilable" type="checkbox" className="size-4" {...register("compilable")} />
            <label htmlFor="compilable" className="text-sm text-foreground">
              Compilável
            </label>
          </div>
          <FormField label="Comando de compilação (opcional)" htmlFor="compileCommand">
            <Input id="compileCommand" className="font-mono" {...register("compileCommand")} />
          </FormField>
          <FormField label="Comando de execução (opcional)" htmlFor="runCommand">
            <Input id="runCommand" className="font-mono" {...register("runCommand")} />
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
