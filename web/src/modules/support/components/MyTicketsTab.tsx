import { useQuery } from "@tanstack/react-query";
import { listMyTickets, TicketStatus } from "@runcodes/api-client";
import { Badge, Button, Card, CardContent, EmptyState, Skeleton } from "@runcodes/ui";
import { ticketPriorityLabels, ticketTypeLabels } from "../lib/ticketLabels";
import { NewTicketDialog } from "./NewTicketDialog";

export function MyTicketsTab() {
  const query = useQuery({ queryKey: ["tickets", "mine"], queryFn: listMyTickets });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <NewTicketDialog trigger={<Button size="sm">Abrir ticket</Button>} />
      </div>

      {query.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !query.data || query.data.length === 0 ? (
        <EmptyState title="Você ainda não abriu nenhum ticket" />
      ) : (
        <ul className="space-y-2">
          {query.data.map((ticket) => (
            <li key={ticket.id}>
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="neutral">{ticketTypeLabels[ticket.type] ?? "—"}</Badge>
                      <Badge variant="neutral">{ticketPriorityLabels[ticket.priority] ?? "—"}</Badge>
                      <Badge variant={ticket.status === TicketStatus.CLOSED ? "neutral" : "success"}>
                        {ticket.status === TicketStatus.CLOSED ? "Fechado" : "Aberto"}
                      </Badge>
                      {ticket.solved && <Badge variant="success">Resolvido</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.datetime).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.message}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
