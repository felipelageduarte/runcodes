import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listBroadcasts, type MessageRecord } from "@runcodes/api-client";
import { Button, Table, type TableColumn } from "@runcodes/ui";
import { BroadcastFormDialog } from "./BroadcastFormDialog";

const PAGE_SIZE = 20;

export function BroadcastTab() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["broadcasts", page],
    queryFn: () => listBroadcasts(page, PAGE_SIZE),
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  const columns: TableColumn<MessageRecord>[] = [
    { key: "sentAt", header: "Quando", render: (m) => new Date(m.sentAt).toLocaleString("pt-BR") },
    { key: "sender", header: "De", render: (m) => m.senderEmail ?? "—" },
    { key: "recipes", header: "Destinatários", render: (m) => m.recipes ?? "—" },
    { key: "recipientCount", header: "Enviado pra", align: "center", render: (m) => m.recipientCount },
    { key: "subject", header: "Assunto", render: (m) => m.subject ?? "—" },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <BroadcastFormDialog trigger={<Button size="sm">Nova mensagem</Button>} />
      </div>

      <Table
        columns={columns}
        rows={query.data?.messages ?? []}
        rowKey={(m) => m.id}
        density="compact"
        emptyTitle={query.isLoading ? "Carregando..." : "Nenhuma mensagem enviada ainda"}
      />

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
