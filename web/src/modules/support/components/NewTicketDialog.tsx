import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTicket } from "@runcodes/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Textarea,
  toast,
} from "@runcodes/ui";
import { ticketPriorityLabels, ticketTypeLabels } from "../lib/ticketLabels";

const schema = z.object({
  type: z.coerce.number().int().min(0).max(3),
  priority: z.coerce.number().int().min(0).max(4),
  message: z.string().min(1, "Descreva o problema"),
});
type FormValues = z.input<typeof schema>;

export function NewTicketDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: 0, priority: 1 } });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createTicket({ type: values.type, priority: values.priority, message: values.message }),
    onSuccess: () => {
      toast.success("Ticket aberto");
      queryClient.invalidateQueries({ queryKey: ["tickets", "mine"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("Não foi possível abrir o ticket"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Abrir ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo" htmlFor="type">
              <select
                id="type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("type")}
              >
                {Object.entries(ticketTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Prioridade" htmlFor="priority">
              <select
                id="priority"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register("priority")}
              >
                {Object.entries(ticketPriorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Mensagem" htmlFor="message" error={errors.message?.message}>
            <Textarea id="message" rows={5} {...register("message")} />
          </FormField>
          <DialogFooter>
            <Button type="submit" loading={mutation.isPending}>
              Abrir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
