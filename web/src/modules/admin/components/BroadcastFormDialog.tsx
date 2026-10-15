import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendBroadcast } from "@runcodes/api-client";
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

const audienceLabels = {
  students: "Alunos",
  staff: "Professores/assistentes",
  admins: "Admins",
  all: "Todos",
} as const;

const schema = z.object({
  audience: z.enum(["students", "staff", "admins", "all"]),
  subject: z.string().min(1, "Informe o assunto"),
  message: z.string().min(1, "Informe a mensagem"),
});
type FormValues = z.input<typeof schema>;

/** Broadcast de email administrativo — mirrors MessagesController::sendMail(),
 * sem rastreio de abertura (pixel) nem blacklist, decisão deliberada
 * (ver docs/roadmap/gap-audit-2026-10.md item 9). */
export function BroadcastFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { audience: "all" } });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => sendBroadcast(values),
    onSuccess: (sent) => {
      toast.success(`Mensagem enviada pra ${sent.recipientCount} destinatário(s)`);
      queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      setOpen(false);
      reset({ audience: "all", subject: "", message: "" });
    },
    onError: () => toast.error("Não foi possível enviar a mensagem"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Nova mensagem</DialogTitle>
          <DialogDescription>
            Manda um email pra todo mundo do grupo escolhido. Sem como desfazer depois de enviado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Destinatários" htmlFor="audience">
            <select
              id="audience"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("audience")}
            >
              {Object.entries(audienceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Assunto" htmlFor="subject" error={errors.subject?.message}>
            <Input id="subject" {...register("subject")} />
          </FormField>
          <FormField label="Mensagem" htmlFor="message" error={errors.message?.message}>
            <Textarea id="message" rows={6} {...register("message")} />
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
