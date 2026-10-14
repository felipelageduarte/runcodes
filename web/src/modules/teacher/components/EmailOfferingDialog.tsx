import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { emailOffering } from "@runcodes/api-client";
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
  Textarea,
  toast,
} from "@runcodes/ui";

const schema = z.object({
  subject: z.string().min(1, "Informe o assunto"),
  message: z.string().min(1, "Informe a mensagem"),
});
type FormValues = z.input<typeof schema>;

/** Email avulso pra turma inteira — mirrors OfferingsController::email(). */
export function EmailOfferingDialog({ offeringId, trigger }: { offeringId: number; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => emailOffering(offeringId, values),
    onSuccess: (result) => {
      toast.success(`Email enviado pra ${result.count} membro(s) da turma`);
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Não foi possível enviar o email"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Email pra turma</DialogTitle>
          <DialogDescription>Manda um email pra todo mundo matriculado (staff e alunos).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Assunto" htmlFor="offering-email-subject" error={errors.subject?.message}>
            <Input id="offering-email-subject" {...register("subject")} />
          </FormField>
          <FormField label="Mensagem" htmlFor="offering-email-message" error={errors.message?.message}>
            <Textarea id="offering-email-message" rows={6} {...register("message")} />
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
