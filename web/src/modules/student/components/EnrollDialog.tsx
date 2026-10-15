import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
} from "@runcodes/ui";
import { useEnrollMutation } from "../hooks/useEnrollMutation";

const schema = z.object({ code: z.string().min(1, "Informe o código da turma") });
type FormValues = z.infer<typeof schema>;

export function EnrollDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useEnrollMutation({
    onSuccess: () => {
      setOpen(false);
      reset();
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
        <form onSubmit={handleSubmit((values) => mutation.mutate(values.code))}>
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
