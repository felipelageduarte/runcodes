import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTickets, TicketStatus, type TicketRecord } from "@runcodes/api-client";
import { Badge, Button, EmptyState, Skeleton, Table, type TableColumn } from "@runcodes/ui";
import { ticketPriorityLabels, ticketTypeLabels } from "../lib/ticketLabels";
import { TicketEditDialog } from "./TicketEditDialog";

const PAGE_SIZE = 20;

export function TicketQueueTab() {
  const [status, setStatus] = useState<number | "">("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["tickets", "queue", { status, page }],
    queryFn: () => listTickets({ status: status === "" ? undefined : status, page, pageSize: PAGE_SIZE }),
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  const columns: TableColumn<TicketRecord>[] = [
    { key: "datetime", header: "Quando", render: (t) => new Date(t.datetime).toLocaleString("pt-BR") },
    { key: "userEmail", header: "Usuário", render: (t) => t.userEmail },
    { key: "type", header: "Tipo", render: (t) => ticketTypeLabels[t.type] ?? "—" },
    { key: "priority", header: "Prioridade", render: (t) => ticketPriorityLabels[t.priority] ?? "—" },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (t) => (
        <Badge variant={t.status === TicketStatus.CLOSED ? "neutral" : t.solved ? "success" : "warning"}>
          {t.status === TicketStatus.CLOSED ? "Fechado" : t.solved ? "Resolvido" : "Aberto"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => (
        <TicketEditDialog
          ticket={t}
          trigger={
            <Button variant="ghost" size="sm">
              Ver
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 py-4">
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value === "" ? "" : Number(e.target.value));
          setPage(1);
        }}
      >
        <option value="">Todos os status</option>
        <option value={TicketStatus.OPEN}>Abertos</option>
        <option value={TicketStatus.CLOSED}>Fechados</option>
      </select>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !query.data || query.data.tickets.length === 0 ? (
        <EmptyState title="Nenhum ticket na fila" />
      ) : (
        <Table columns={columns} rows={query.data.tickets} rowKey={(t) => t.id} density="compact" emptyTitle="Nenhum ticket" />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
