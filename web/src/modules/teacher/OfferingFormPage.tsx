import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOffering,
  getOffering,
  searchMyCourses,
  updateOffering,
  type CourseSummary,
} from "@runcodes/api-client";
import { Button, Card, CardContent, EmptyState, FormField, Input, PageContainer, PageHeader, Skeleton, toast } from "@runcodes/ui";

const schema = z.object({
  courseId: z.coerce.number().int().min(1, "Escolha uma disciplina"),
  classroom: z.string().optional(),
  endDate: z.string().min(1, "Informe a data de término"),
});
type FormValues = z.input<typeof schema>;

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export function OfferingFormPage({ mode }: { mode: "create" | "edit" }) {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [courseFilter, setCourseFilter] = useState("");

  const offeringId = mode === "edit" ? Number(params.id) : null;

  const offeringQuery = useQuery({
    queryKey: ["offering", offeringId],
    queryFn: () => getOffering(offeringId!),
    enabled: mode === "edit" && Number.isInteger(offeringId),
  });

  const coursesQuery = useQuery({
    queryKey: ["courses", "mine", courseFilter],
    queryFn: () => searchMyCourses(courseFilter || undefined),
    enabled: mode === "create",
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (offeringQuery.data) {
      reset({
        courseId: offeringQuery.data.courseId,
        classroom: offeringQuery.data.classroom ?? "",
        endDate: toDateInput(offeringQuery.data.endDate),
      });
    }
  }, [offeringQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const endDate = new Date(`${values.endDate}T00:00:00`).toISOString();
      const classroom = values.classroom?.trim() ? values.classroom.trim() : null;
      return mode === "create"
        ? createOffering({ courseId: Number(values.courseId), classroom, endDate })
        : updateOffering(offeringId!, { classroom, endDate });
    },
    onSuccess: (data) => {
      toast.success(mode === "create" ? "Turma criada — código de matrícula enviado por email" : "Turma atualizada");
      queryClient.invalidateQueries({ queryKey: ["offerings"] });
      queryClient.invalidateQueries({ queryKey: ["offering", data.id] });
      navigate(`/turmas/${data.id}/gerenciar`);
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string })?.code;
      toast.error(
        code === "wrong_university"
          ? "Essa disciplina pertence a outra universidade"
          : code === "course_code_taken"
            ? "Já existe uma turma com essa sala pra essa disciplina"
            : "Não foi possível salvar a turma",
      );
    },
  });

  if (mode === "edit" && offeringQuery.isLoading) {
    return (
      <PageContainer width="narrow" className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  const courses: CourseSummary[] = coursesQuery.data ?? [];

  return (
    <PageContainer width="narrow">
      <PageHeader title={mode === "create" ? "Nova turma" : "Editar turma"} />

      <Card>
        <CardContent className="p-6">
          <form className="space-y-1" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            {mode === "create" ? (
              <>
                <FormField label="Buscar disciplina" htmlFor="course-filter" hint="Da sua própria universidade.">
                  <Input
                    id="course-filter"
                    placeholder="Código ou título"
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                  />
                </FormField>

                {courses.length === 0 && !coursesQuery.isLoading ? (
                  <EmptyState
                    className="my-4"
                    title="Nenhuma disciplina encontrada"
                    description="Se a disciplina ainda não existe no catálogo, peça a um admin pra cadastrá-la."
                  />
                ) : (
                  <FormField label="Disciplina" htmlFor="courseId" error={errors.courseId?.message}>
                    <select
                      id="courseId"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      defaultValue=""
                      {...register("courseId")}
                    >
                      <option value="" disabled>
                        Escolha a disciplina
                      </option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.title}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}
              </>
            ) : (
              <FormField label="Disciplina" htmlFor="course-readonly">
                <Input id="course-readonly" disabled value={offeringQuery.data?.course?.title ?? ""} />
              </FormField>
            )}

            <FormField label="Sala (opcional)" htmlFor="classroom">
              <Input id="classroom" {...register("classroom")} />
            </FormField>

            <FormField label="Término" htmlFor="endDate" error={errors.endDate?.message}>
              <Input id="endDate" type="date" {...register("endDate")} />
            </FormField>

            {mode === "create" && (
              <p className="pb-2 text-xs text-muted-foreground">
                Você será matriculado como professor da turma, e o código de matrícula será enviado pro seu email.
              </p>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={mutation.isPending} disabled={mode === "create" && courses.length === 0}>
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
