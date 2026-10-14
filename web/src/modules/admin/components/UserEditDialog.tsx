import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  deleteAdminUser,
  listUniversities,
  updateAdminUser,
  type AdminUserRecord,
} from "@runcodes/api-client";
import { userTypeLabel } from "@runcodes/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  name: z.string().min(1, "Informe o nome"),
  type: z.coerce.number().int().min(0).max(4),
  confirmed: z.boolean(),
  universityId: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

export function UserEditDialog({ user, trigger }: { user: AdminUserRecord; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const universitiesQuery = useQuery({ queryKey: ["universities"], queryFn: listUniversities, enabled: open });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      type: user.type,
      confirmed: user.confirmed,
      universityId: user.universityId ? String(user.universityId) : "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateAdminUser(user.email, {
        name: values.name,
        type: values.type,
        confirmed: values.confirmed,
        universityId: values.universityId ? Number(values.universityId) : null,
      }),
    onSuccess: () => {
      toast.success("Usuário atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
    },
    onError: () => toast.error("Não foi possível atualizar o usuário"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminUser(user.email, deletePassword),
    onSuccess: () => {
      toast.success("Usuário removido");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmDelete(false);
      setDeletePassword("");
      setDeleteError(null);
      setOpen(false);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === "invalid_current_password") {
        setDeleteError("Senha incorreta");
        return;
      }
      toast.error("Não foi possível remover o usuário");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>{user.name}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Nome" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...register("name")} />
          </FormField>
          <FormField label="Tipo" htmlFor="type">
            <select
              id="type"
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
          <FormField label="Instituição" htmlFor="universityId">
            <select
              id="universityId"
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
          <div className="mb-4 flex items-center gap-2">
            <input id="confirmed" type="checkbox" className="size-4" {...register("confirmed")} />
            <label htmlFor="confirmed" className="text-sm text-foreground">
              Email confirmado
            </label>
          </div>
          <DialogFooter className="justify-between">
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              Remover
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          setConfirmDelete(next);
          if (!next) {
            setDeletePassword("");
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent open={confirmDelete}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga a conta e tudo vinculado a ela (matrículas, submissões). Essa ação não pode ser desfeita. Confirme
              com sua senha de admin para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormField label="Sua senha" htmlFor="delete-password" error={deleteError ?? undefined}>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeleteError(null);
              }}
            />
          </FormField>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deletePassword || deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
