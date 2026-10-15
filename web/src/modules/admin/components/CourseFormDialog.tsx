import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCourse, listUniversities } from "@runcodes/api-client";
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
  code: z.string().min(1, "Informe o código").max(16),
  title: z.string().min(1, "Informe o título"),
  universityId: z.coerce.number().int().min(1, "Escolha a universidade"),
});
type FormValues = z.input<typeof schema>;

/** Admin-only no backend. Sem edição/batch ainda — ver gap-audit-2026-10.md. */
export function CourseFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const universitiesQuery = useQuery({ queryKey: ["universities"], queryFn: listUniversities, enabled: open });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createCourse({ code: values.code, title: values.title, universityId: Number(values.universityId) }),
    onSuccess: () => {
      toast.success("Disciplina criada");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
      reset();
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string })?.code;
      toast.error(
        code === "course_code_taken" ? "Já existe uma disciplina com esse código nessa universidade" : "Não foi possível salvar",
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Nova disciplina</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Universidade" htmlFor="universityId" error={errors.universityId?.message}>
            <select
              id="universityId"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              defaultValue=""
              {...register("universityId")}
            >
              <option value="" disabled>
                Escolha a universidade
              </option>
              {(universitiesQuery.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.abbreviation} — {u.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Código" htmlFor="code" error={errors.code?.message} hint="Ex: SCC0219">
            <Input id="code" {...register("code")} />
          </FormField>
          <FormField label="Título" htmlFor="title" error={errors.title?.message}>
            <Input id="title" {...register("title")} />
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
