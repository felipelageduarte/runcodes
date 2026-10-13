import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAlert, updateAlert, type AlertRecord } from "@runcodes/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Textarea,
  toast,
} from "@runcodes/ui";

const typeLabels: Record<number, string> = { 0: "Informativo", 1: "Aviso", 2: "Urgente", 3: "Manutenção" };
const recipientLabels: Record<number, string> = { 0: "Todos", 1: "Alunos", 2: "Professores" };

const schema = z.object({
  type: z.coerce.number().int().min(0).max(3),
  recipients: z.coerce.number().int().min(0).max(2),
  valid: z.string().min(1, "Informe até quando vale"),
  title: z.string().min(1, "Informe o título"),
  message: z.string().min(1, "Informe a mensagem"),
});
type FormValues = z.input<typeof schema>;

function toDateInput(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function AlertFormDialog({ existing, trigger }: { existing?: AlertRecord; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? {
          type: existing.type,
          recipients: existing.recipients,
          valid: toDateInput(existing.valid),
          title: existing.title,
          message: existing.message,
        }
      : { type: 0, recipients: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input = {
        type: values.type,
        offeringId: null,
        recipients: values.recipients,
        valid: new Date(values.valid).toISOString(),
        title: values.title,
        message: values.message,
      };
      return existing ? updateAlert(existing.id, input) : createAlert(input);
    },
    onSuccess: () => {
      toast.success(existing ? "Aviso atualizado" : "Aviso criado");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Não foi possível salvar o aviso"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>{existing ? "Editar aviso" : "Novo aviso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <FormField label="Título" htmlFor="title" error={errors.title?.message}>
            <Input id="title" {...register("title")} />
          </FormField>
          <FormField label="Mensagem" htmlFor="message" error={errors.message?.message}>
            <Textarea id="message" rows={4} {...register("message")} />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Tipo" htmlFor="type">
              <select
                id="type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("type")}
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Destinatários" htmlFor="recipients">
              <select
                id="recipients"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("recipients")}
              >
                {Object.entries(recipientLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Válido até" htmlFor="valid" error={errors.valid?.message}>
              <Input id="valid" type="date" {...register("valid")} />
            </FormField>
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
