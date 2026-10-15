import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, createAdminUser, listUniversities } from "@runcodes/api-client";
import { userTypeLabel } from "@runcodes/shared";
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
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "Informe o nome"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  type: z.coerce.number().int().min(0).max(4),
  universityId: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

/** Mirrors UsersController::insert() — admin cadastra conta já
 * confirmada, sem round-trip de email. Ver gap-audit-2026-10.md item 21. */
export function NewUserDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const universitiesQuery = useQuery({ queryKey: ["universities"], queryFn: listUniversities, enabled: open });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: 0 } });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createAdminUser({
        email: values.email,
        name: values.name,
        password: values.password,
        type: values.type,
        universityId: values.universityId ? Number(values.universityId) : null,
      }),
    onSuccess: () => {
      toast.success("Usuário criado");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      reset({ type: 0 });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError && err.code === "email_already_registered"
          ? "Já existe uma conta com esse email"
          : "Não foi possível criar o usuário",
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>Cria a conta já confirmada, sem precisar o usuário clicar no email.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Email" htmlFor="new-user-email" error={errors.email?.message}>
            <Input id="new-user-email" {...register("email")} />
          </FormField>
          <FormField label="Nome" htmlFor="new-user-name" error={errors.name?.message}>
            <Input id="new-user-name" {...register("name")} />
          </FormField>
          <FormField label="Senha" htmlFor="new-user-password" error={errors.password?.message}>
            <Input id="new-user-password" type="password" {...register("password")} />
          </FormField>
          <FormField label="Tipo" htmlFor="new-user-type">
            <select
              id="new-user-type"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("type")}
            >
              {[0, 1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  {userTypeLabel(t)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Instituição" htmlFor="new-user-universityId">
            <select
              id="new-user-universityId"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("universityId")}
            >
              <option value="">Nenhuma</option>
              {(universitiesQuery.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.abbreviation}
                </option>
              ))}
            </select>
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
