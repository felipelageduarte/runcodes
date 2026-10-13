import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { closeTicket, solveTicket, updateTicket, type TicketRecord } from "@runcodes/api-client";
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
  Textarea,
  toast,
} from "@runcodes/ui";
import { ticketPriorityLabels, ticketTypeLabels } from "../lib/ticketLabels";

const schema = z.object({
  type: z.coerce.number().int().min(0).max(3),
  priority: z.coerce.number().int().min(0).max(4),
  message: z.string().min(1),
});
type FormValues = z.input<typeof schema>;

/** Não existe thread de resposta no backend (ver docs/frontend/
 * roadmap.md, Fase 5) — "responder" aqui é sobrescrever a mensagem do
 * ticket, não anexar uma nova. Marcar resolvido/fechar são ações
 * separadas e idempotentes. */
export function TicketEditDialog({ ticket, trigger }: { ticket: TicketRecord; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: ticket.type, priority: ticket.priority, message: ticket.message },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tickets", "queue"] });
    queryClient.invalidateQueries({ queryKey: ["tickets", "mine"] });
  };

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => updateTicket(ticket.id, values),
    onSuccess: () => {
      toast.success("Ticket atualizado");
      invalidate();
      setOpen(false);
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const solveMutation = useMutation({
    mutationFn: () => solveTicket(ticket.id),
    onSuccess: () => {
      toast.success("Ticket marcado como resolvido");
      invalidate();
    },
    onError: () => toast.error("Não foi possível marcar como resolvido"),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeTicket(ticket.id),
    onSuccess: () => {
      toast.success("Ticket fechado");
      invalidate();
      setOpen(false);
    },
    onError: () => toast.error("Não foi possível fechar o ticket"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Ticket #{ticket.id}</DialogTitle>
          <DialogDescription>{ticket.userEmail}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => updateMutation.mutate(values))}>
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
            <Textarea id="message" rows={6} {...register("message")} />
          </FormField>
          <DialogFooter className="justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="secondary" loading={solveMutation.isPending} onClick={() => solveMutation.mutate()}>
                Marcar resolvido
              </Button>
              <Button type="button" variant="secondary" loading={closeMutation.isPending} onClick={() => closeMutation.mutate()}>
                Fechar
              </Button>
            </div>
            <Button type="submit" loading={updateMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
