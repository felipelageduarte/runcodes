import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUniversities, updateAdminUser, type AdminUserRecord } from "@runcodes/api-client";
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
  name: z.string().min(1, "Informe o nome"),
  type: z.coerce.number().int().min(0).max(4),
  confirmed: z.boolean(),
  universityId: z.string().optional(),
});
type FormValues = z.input<typeof schema>;

export function UserEditDialog({ user, trigger }: { user: AdminUserRecord; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
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
