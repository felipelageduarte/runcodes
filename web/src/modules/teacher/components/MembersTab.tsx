import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  banMember,
  enrollMember,
  getGrades,
  setMemberRole,
  unenrollMember,
  type OfferingDetail,
} from "@runcodes/api-client";
import { UserType, userTypeLabel } from "@runcodes/shared";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Input,
  Skeleton,
  Table,
  type TableColumn,
  toast,
} from "@runcodes/ui";
import { EmailOfferingDialog } from "./EmailOfferingDialog";

const enrollSchema = z.object({ email: z.string().email("Email inválido") });
type EnrollValues = z.infer<typeof enrollSchema>;

const promoteSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.coerce.number().int().min(0).max(2),
});
type PromoteValues = z.infer<typeof promoteSchema>;

function roleBadgeVariant(role: number): "neutral" | "success" | "warning" {
  if (role === 2) return "success";
  if (role === 1) return "warning";
  return "neutral";
}

export function MembersTab({ offering, currentUserType }: { offering: OfferingDetail; currentUserType: number }) {
  const queryClient = useQueryClient();
  const isAdmin = currentUserType >= UserType.ADMIN;

  const gradesQuery = useQuery({
    queryKey: ["offering", offering.id, "grades"],
    queryFn: () => getGrades(offering.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["offering", offering.id] });
    queryClient.invalidateQueries({ queryKey: ["offering", offering.id, "grades"] });
  };

  const roleMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: number }) => setMemberRole(offering.id, email, role),
    onSuccess: () => {
      toast.success("Papel atualizado");
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError && err.code === "user_not_enrolled" ? "Esse email não está matriculado nessa turma" : "Não foi possível atualizar o papel");
    },
  });

  const banMutation = useMutation({
    mutationFn: (email: string) => banMember(offering.id, email),
    onSuccess: () => {
      toast.success("Usuário banido da turma");
      invalidate();
    },
    onError: () => toast.error("Não foi possível banir"),
  });

  const unenrollMutation = useMutation({
    mutationFn: (email: string) => unenrollMember(offering.id, email),
    onSuccess: () => {
      toast.success("Matrícula removida");
      invalidate();
    },
    onError: () => toast.error("Não foi possível remover a matrícula"),
  });

  const enrollMutation = useMutation({
    mutationFn: (email: string) => enrollMember(offering.id, email),
    onSuccess: () => {
      toast.success("Aluno matriculado");
      invalidate();
      enrollForm.reset();
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError && err.code === "already_enrolled"
          ? "Esse email já está matriculado"
          : err instanceof ApiError && err.code === "wrong_university"
            ? "Esse usuário é de outra universidade"
            : "Não foi possível matricular",
      );
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PromoteValues>({ resolver: zodResolver(promoteSchema), defaultValues: { role: 1 } });

  const enrollForm = useForm<EnrollValues>({ resolver: zodResolver(enrollSchema) });

  const staff = [...offering.professors, ...offering.assistants];
  const students = gradesQuery.data?.students ?? [];

  const studentColumns: TableColumn<{ email: string; name: string; identifier: string | null }>[] = [
    { key: "name", header: "Nome", render: (r) => r.name },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "identifier", header: "Matrícula", render: (r) => r.identifier ?? "—" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            loading={roleMutation.isPending}
            onClick={() => roleMutation.mutate({ email: r.email, role: 1 })}
          >
            Tornar assistente
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={unenrollMutation.isPending}
            onClick={() => unenrollMutation.mutate(r.email)}
          >
            Desmatricular
          </Button>
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              loading={banMutation.isPending}
              onClick={() => banMutation.mutate(r.email)}
            >
              Banir
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 py-4">
      <div className="flex justify-end">
        <EmailOfferingDialog offeringId={offering.id} trigger={<Button variant="secondary" size="sm">Email pra turma</Button>} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Staff da turma</h3>
        {staff.length === 0 ? (
          <EmptyState title="Nenhum professor/assistente cadastrado" />
        ) : (
          <ul className="space-y-2">
            {staff.map((member) => (
              <li
                key={member.email}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={roleBadgeVariant(member.role)}>{userTypeLabel(member.role)}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={roleMutation.isPending}
                    onClick={() => roleMutation.mutate({ email: member.email, role: 0 })}
                  >
                    Rebaixar a aluno
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={unenrollMutation.isPending}
                    onClick={() => unenrollMutation.mutate(member.email)}
                  >
                    Desmatricular
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      loading={banMutation.isPending}
                      onClick={() => banMutation.mutate(member.email)}
                    >
                      Banir
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Alunos matriculados</h3>
        {gradesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table
            columns={studentColumns}
            rows={students}
            rowKey={(r) => r.email}
            density="compact"
            mobileCards
            emptyTitle="Nenhum aluno matriculado ainda"
          />
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-medium text-foreground">Matricular aluno por email</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Matricula direto, sem o aluno precisar digitar o código da turma.
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={enrollForm.handleSubmit((values) => enrollMutation.mutate(values.email))}
        >
          <div className="min-w-[220px] flex-1">
            <FormField label="Email" htmlFor="enroll-email" error={enrollForm.formState.errors.email?.message}>
              <Input id="enroll-email" {...enrollForm.register("email")} />
            </FormField>
          </div>
          <Button type="submit" loading={enrollMutation.isPending}>
            Matricular
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-medium text-foreground">Alterar papel por email</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Útil pra quem ainda não aparece nas listas acima (ex: matriculado mas sem submissões ainda).
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={handleSubmit((values) => {
            roleMutation.mutate(values, { onSuccess: () => reset() });
          })}
        >
          <div className="min-w-[220px] flex-1">
            <FormField label="Email" htmlFor="promote-email" error={errors.email?.message}>
              <Input id="promote-email" {...register("email")} />
            </FormField>
          </div>
          <FormField label="Papel" htmlFor="promote-role" error={errors.role?.message}>
            <select
              id="promote-role"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              {...register("role")}
            >
              <option value={0}>Aluno</option>
              <option value={1}>Assistente</option>
              <option value={2}>Professor</option>
            </select>
          </FormField>
          <Button type="submit" loading={roleMutation.isPending}>
            Aplicar
          </Button>
        </form>
      </div>
    </div>
  );
}
