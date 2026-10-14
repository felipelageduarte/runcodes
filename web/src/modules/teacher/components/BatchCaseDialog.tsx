import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExerciseCasesBatch } from "@runcodes/api-client";
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

const pairSchema = z.object({ input: z.string(), output: z.string() });
const schema = z.object({
  outputType: z.coerce.number().int().min(1).max(3),
  cputime: z.coerce.number().int().min(1),
  showInput: z.boolean().default(false),
  showExpectedOutput: z.boolean().default(false),
  showUserOutput: z.boolean().default(false),
  pairs: z.array(pairSchema).min(1),
});
type FormValues = z.input<typeof schema>;

/** Cria vários casos de teste de uma vez, config compartilhada — mirrors
 * ExerciseCasesController::addBatch(), com pares de texto em vez de
 * upload de arquivo `.in`/`.out`. Ver docs/roadmap/gap-audit-2026-10.md
 * item 11. */
export function BatchCaseDialog({ exerciseId, trigger }: { exerciseId: number; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { outputType: 1, cputime: 5, pairs: [{ input: "", output: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "pairs" });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createExerciseCasesBatch(
        exerciseId,
        values.pairs.map((pair) => ({
          input: pair.input,
          output: pair.output,
          outputType: values.outputType,
          cputime: values.cputime,
          showInput: values.showInput ?? false,
          showExpectedOutput: values.showExpectedOutput ?? false,
          showUserOutput: values.showUserOutput ?? false,
        })),
      ),
    onSuccess: (created) => {
      toast.success(`${created.length} caso(s) de teste criado(s)`);
      queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId, "cases"] });
      setOpen(false);
      reset({ outputType: 1, cputime: 5, pairs: [{ input: "", output: "" }] });
    },
    onError: () => toast.error("Não foi possível criar o lote — nenhum caso foi salvo além dos já confirmados"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar casos em lote</DialogTitle>
          <DialogDescription>
            Config abaixo (tipo de saída, tempo, visibilidade) é compartilhada por todos os casos deste lote.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-3">
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
          <div className="flex flex-col gap-2">
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

          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Caso {index + 1}</span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-danger hover:underline"
                      onClick={() => remove(index)}
                    >
                      Remover
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Input" htmlFor={`pairs.${index}.input`}>
                    <textarea
                      id={`pairs.${index}.input`}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      {...register(`pairs.${index}.input` as const)}
                    />
                  </FormField>
                  <FormField label="Output esperado" htmlFor={`pairs.${index}.output`}>
                    <textarea
                      id={`pairs.${index}.output`}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      {...register(`pairs.${index}.output` as const)}
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={() => append({ input: "", output: "" })}>
            + Adicionar caso
          </Button>

          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Criar {fields.length} caso(s)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
