import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExercise,
  getExercise,
  listAllowedFiles,
  updateExercise,
  type ExerciseInput,
} from "@runcodes/api-client";
import {
  Button,
  Card,
  CardContent,
  FormField,
  Input,
  Label,
  PageContainer,
  PageHeader,
  Skeleton,
  toast,
} from "@runcodes/ui";

const schema = z.object({
  title: z.string().min(1, "Informe um título"),
  description: z.string().optional(),
  deadline: z.string().min(1, "Informe o prazo"),
  openDate: z.string().optional(),
  type: z.coerce.number().int().min(0).max(2),
  showBeforeOpening: z.boolean().default(false),
  markdown: z.boolean().default(false),
  allowedFileIds: z.array(z.number()).default([]),
});
type FormValues = z.input<typeof schema>;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export function ExerciseFormPage({ mode }: { mode: "create" | "edit" }) {
  const params = useParams<{ id?: string; offeringId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const exerciseId = mode === "edit" ? Number(params.id) : null;
  const offeringIdFromRoute = mode === "create" ? Number(params.offeringId) : null;

  const exerciseQuery = useQuery({
    queryKey: ["exercise", exerciseId],
    queryFn: () => getExercise(exerciseId!),
    enabled: mode === "edit" && Number.isInteger(exerciseId),
  });

  const allowedFilesQuery = useQuery({ queryKey: ["allowed-files"], queryFn: listAllowedFiles });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 0, showBeforeOpening: false, markdown: true, allowedFileIds: [] },
  });

  useEffect(() => {
    if (exerciseQuery.data) {
      const ex = exerciseQuery.data;
      reset({
        title: ex.title,
        description: ex.description ?? "",
        deadline: toLocalInput(ex.deadline),
        openDate: toLocalInput(ex.openDate),
        type: ex.type,
        showBeforeOpening: Boolean(ex.showBeforeOpening),
        markdown: Boolean(ex.markdown),
        allowedFileIds: ex.allowedFiles.map((f) => f.id),
      });
    }
  }, [exerciseQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: ExerciseInput = {
        title: values.title,
        description: values.description?.trim() ? values.description : null,
        deadline: toIso(values.deadline)!,
        openDate: toIso(values.openDate ?? ""),
        type: values.type,
        showBeforeOpening: values.showBeforeOpening ?? false,
        markdown: values.markdown ?? false,
        allowedFileIds: values.allowedFileIds ?? [],
      };
      return mode === "create" ? createExercise(offeringIdFromRoute!, input) : updateExercise(exerciseId!, input);
    },
    onSuccess: (data) => {
      toast.success(mode === "create" ? "Exercício criado" : "Exercício atualizado");
      queryClient.invalidateQueries({ queryKey: ["offering", data.offeringId] });
      navigate(`/turmas/${data.offeringId}/gerenciar`);
    },
    onError: () => toast.error("Não foi possível salvar o exercício"),
  });

  if (mode === "edit" && exerciseQuery.isLoading) {
    return (
      <PageContainer width="narrow" className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </PageContainer>
    );
  }

  const selectedFileIds = watch("allowedFileIds") ?? [];

  const knownOfferingId =
    mode === "create" ? offeringIdFromRoute : exerciseQuery.data?.offeringId ?? null;
  const pageTitle = mode === "create" ? "Novo exercício" : "Editar exercício";

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={pageTitle}
        crumbs={
          knownOfferingId != null && Number.isInteger(knownOfferingId)
            ? [
                { label: "Painel", to: "/" },
                {
                  label: exerciseQuery.data?.offering?.course?.title ?? "Turma",
                  to: `/turmas/${knownOfferingId}/gerenciar`,
                },
                { label: pageTitle },
              ]
            : undefined
        }
      />

      <Card>
        <CardContent className="p-6">
          <form
            className="space-y-1"
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField label="Título" htmlFor="title" error={errors.title?.message}>
              <Input id="title" {...register("title")} />
            </FormField>

            <FormField
              label="Enunciado"
              htmlFor="description"
              hint="Markdown habilitado abaixo renderiza esse texto como markdown pro aluno."
            >
              <textarea
                id="description"
                rows={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                {...register("description")}
              />
            </FormField>

            <div className="mb-4 flex items-center gap-2">
              <input id="markdown" type="checkbox" className="size-4" {...register("markdown")} />
              <Label htmlFor="markdown">Renderizar enunciado como markdown</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Prazo final" htmlFor="deadline" error={errors.deadline?.message}>
                <Input id="deadline" type="datetime-local" {...register("deadline")} />
              </FormField>
              <FormField label="Abre em (opcional)" htmlFor="openDate">
                <Input id="openDate" type="datetime-local" {...register("openDate")} />
              </FormField>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <input
                id="showBeforeOpening"
                type="checkbox"
                className="size-4"
                {...register("showBeforeOpening")}
              />
              <Label htmlFor="showBeforeOpening">Mostrar enunciado antes de abrir</Label>
            </div>

            <FormField label="Tipo" htmlFor="type">
              <select
                id="type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("type")}
              >
                <option value={0}>Compilável</option>
                <option value={2}>Compilável (makefile)</option>
                <option value={1}>Não compilável</option>
              </select>
            </FormField>

            <div className="mb-4">
              <Label htmlFor="allowed-files-0">Tipos de arquivo aceitos</Label>
              <div className="mt-2 grid grid-cols-2 gap-1">
                {(allowedFilesQuery.data ?? []).map((file, i) => (
                  <label key={file.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      id={`allowed-files-${i}`}
                      type="checkbox"
                      className="size-4"
                      checked={selectedFileIds.includes(file.id)}
                      onChange={(e) => {
                        setValue(
                          "allowedFileIds",
                          e.target.checked
                            ? [...selectedFileIds, file.id]
                            : selectedFileIds.filter((id) => id !== file.id),
                        );
                      }}
                    />
                    {file.name} ({file.extension})
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={mutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
