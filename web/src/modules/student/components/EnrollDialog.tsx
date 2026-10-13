import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enrollByCode, ApiError } from "@runcodes/api-client";
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

const schema = z.object({ code: z.string().min(1, "Informe o código da turma") });
type FormValues = z.infer<typeof schema>;

export function EnrollDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => enrollByCode(values.code),
    onSuccess: () => {
      toast.success("Você entrou na turma!");
      queryClient.invalidateQueries({ queryKey: ["offerings", "mine"] });
      setOpen(false);
      reset();
    },
    onError: (err) => {
      if (!(err instanceof ApiError)) {
        toast.error("Não foi possível entrar na turma");
        return;
      }
      const messages: Record<string, string> = {
        invalid_enrollment_code: "Código inválido",
        wrong_university: "Essa turma é de outra instituição",
        already_enrolled: "Você já está matriculado nessa turma",
        banned_from_offering: "Você foi removido dessa turma e não pode entrar de novo",
      };
      toast.error(messages[err.code ?? ""] ?? "Não foi possível entrar na turma");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Entrar em turma</DialogTitle>
          <DialogDescription>Peça o código de matrícula pro seu professor.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Código da turma" htmlFor="code" error={errors.code?.message}>
            <Input id="code" autoFocus {...register("code")} />
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Entrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
