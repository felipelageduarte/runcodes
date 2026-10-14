import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  changePassword,
  getProfile,
  listUniversities,
  updateProfile,
} from "@runcodes/api-client";
import {
  Button,
  Card,
  CardContent,
  FormField,
  Input,
  PageContainer,
  PageHeader,
  SectionHeader,
  Skeleton,
  toast,
} from "@runcodes/ui";

const profileSchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  universityId: z.coerce.number().int().optional(),
  identifier: z.string().optional(),
});
type ProfileValues = z.input<typeof profileSchema>;

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
type PasswordValues = z.input<typeof passwordSchema>;

/** Perfil do próprio usuário — mirrors UsersController::profile(), o
 * gap de maior impacto prático da auditoria de paridade (ver
 * docs/roadmap/gap-audit-2026-10.md item 10): antes dessa tela, ninguém
 * trocava a própria senha depois do cadastro. */
export function ProfilePage() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({ queryKey: ["profile", "me"], queryFn: getProfile });
  const universitiesQuery = useQuery({ queryKey: ["universities"], queryFn: listUniversities });

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (profileQuery.data) {
      resetProfile({
        name: profileQuery.data.name,
        universityId: profileQuery.data.universityId ?? undefined,
        identifier: profileQuery.data.identifier ?? "",
      });
    }
  }, [profileQuery.data, resetProfile]);

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      updateProfile({
        name: values.name,
        universityId: values.universityId ?? null,
        identifier: values.identifier?.trim() ? values.identifier : null,
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: () => toast.error("Não foi possível atualizar o perfil"),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) => changePassword(values.oldPassword, values.newPassword),
    onSuccess: () => {
      toast.success("Senha alterada");
      resetPassword();
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError && err.code === "invalid_current_password"
          ? "Senha atual incorreta"
          : "Não foi possível alterar a senha",
      );
    },
  });

  if (profileQuery.isLoading) {
    return (
      <PageContainer width="narrow" className="space-y-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow" className="space-y-6">
      <PageHeader title="Meu perfil" className="mb-0 sm:mb-0" />

      <Card>
        <CardContent className="p-6">
          <SectionHeader title="Dados pessoais" className="mb-4" />
          <form
            className="space-y-1"
            onSubmit={handleProfileSubmit((values) => profileMutation.mutate(values))}
          >
            <FormField label="Nome" htmlFor="name" error={profileErrors.name?.message}>
              <Input id="name" {...registerProfile("name")} />
            </FormField>
            <FormField label="Universidade" htmlFor="universityId">
              <select
                id="universityId"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...registerProfile("universityId")}
              >
                <option value="">Nenhuma</option>
                {(universitiesQuery.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.abbreviation} — {u.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Matrícula"
              htmlFor="identifier"
              hint="Número de matrícula/RA na sua universidade."
            >
              <Input id="identifier" {...registerProfile("identifier")} />
            </FormField>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={profileMutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <SectionHeader title="Alterar senha" className="mb-4" />
          <form
            className="space-y-1"
            onSubmit={handlePasswordSubmit((values) => passwordMutation.mutate(values))}
          >
            <FormField label="Senha atual" htmlFor="oldPassword" error={passwordErrors.oldPassword?.message}>
              <Input id="oldPassword" type="password" {...registerPassword("oldPassword")} />
            </FormField>
            <FormField label="Nova senha" htmlFor="newPassword" error={passwordErrors.newPassword?.message}>
              <Input id="newPassword" type="password" {...registerPassword("newPassword")} />
            </FormField>
            <FormField
              label="Confirmar nova senha"
              htmlFor="confirmPassword"
              error={passwordErrors.confirmPassword?.message}
            >
              <Input id="confirmPassword" type="password" {...registerPassword("confirmPassword")} />
            </FormField>
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={passwordMutation.isPending}>
                Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
