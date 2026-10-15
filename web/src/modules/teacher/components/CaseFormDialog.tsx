import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExerciseCase, updateExerciseCase, type ExerciseCaseRecord } from "@runcodes/api-client";
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
  input: z.string().optional(),
  output: z.string().optional(),
  outputType: z.coerce.number().int().min(1).max(3),
  showInput: z.boolean().default(false),
  showExpectedOutput: z.boolean().default(false),
  showUserOutput: z.boolean().default(false),
  cputime: z.coerce.number().int().min(1),
  absError: z.coerce.number().optional(),
});
type FormValues = z.input<typeof schema>;

/** Create ou edit — editar não vem com input/output pré-preenchido (o
 * backend nunca devolve esse texto na leitura), então deixar em branco
 * mantém o conteúdo atual. */
export function CaseFormDialog({
  exerciseId,
  existing,
  trigger,
}: {
  exerciseId: number;
  existing?: ExerciseCaseRecord;
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
          outputType: existing.outputType,
          showInput: Boolean(existing.showInput),
          showExpectedOutput: Boolean(existing.showExpectedOutput),
          showUserOutput: Boolean(existing.showUserOutput),
          cputime: existing.cputime,
          absError: existing.absError ?? undefined,
        }
      : { outputType: 1, cputime: 5 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        outputType: values.outputType,
        cputime: values.cputime,
        showInput: values.showInput ?? false,
        showExpectedOutput: values.showExpectedOutput ?? false,
        showUserOutput: values.showUserOutput ?? false,
        absError: values.absError,
        input: values.input?.trim() ? values.input : undefined,
        output: values.output?.trim() ? values.output : undefined,
      };
      return existing
        ? updateExerciseCase(existing.id, payload)
        : createExerciseCase(exerciseId, { ...payload, input: payload.input ?? "", output: payload.output ?? "" });
    },
    onSuccess: () => {
      toast.success(existing ? "Caso de teste atualizado" : "Caso de teste criado");
      queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId, "cases"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Não foi possível salvar o caso de teste"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Editar caso de teste" : "Novo caso de teste"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Deixe input/output em branco pra manter o conteúdo atual."
              : "Input e output são texto puro enviado pro runcodes-compiler."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-1">
          <FormField label="Input" htmlFor="input">
            <textarea
              id="input"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              {...register("input")}
            />
          </FormField>
          <FormField label="Output esperado" htmlFor="output">
            <textarea
              id="output"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              {...register("output")}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo de saída" htmlFor="outputType">
              <select
                id="outputType"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("outputType")}
              >
                <option value={1}>Texto exato</option>
                <option value={2}>Números (com margem de erro)</option>
                <option value={3}>Binário</option>
              </select>
            </FormField>
            <FormField label="CPU time (s)" htmlFor="cputime" error={errors.cputime?.message}>
              <Input id="cputime" type="number" min={1} {...register("cputime")} />
            </FormField>
          </div>
          <FormField label="Margem de erro (opcional)" htmlFor="absError">
            <Input id="absError" type="number" step="0.01" {...register("absError")} />
          </FormField>
          <div className="flex flex-col gap-2 py-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="size-4" {...register("showInput")} />
              Mostrar input pro aluno
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="size-4" {...register("showExpectedOutput")} />
              Mostrar output esperado pro aluno
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="size-4" {...register("showUserOutput")} />
              Mostrar output do aluno pro próprio aluno
            </label>
          </div>
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
