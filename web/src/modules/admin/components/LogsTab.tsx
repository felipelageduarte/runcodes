import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLogs, type LogRecord } from "@runcodes/api-client";
import { Button, FormField, Input, Table, type TableColumn } from "@runcodes/ui";

const PAGE_SIZE = 50;

export function LogsTab() {
  const [userEmail, setUserEmail] = useState("");
  const [ip, setIp] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-logs", { userEmail, ip, page }],
    queryFn: () => listLogs({ userEmail: userEmail || undefined, ip: ip || undefined, page, pageSize: PAGE_SIZE }),
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  const columns: TableColumn<LogRecord>[] = [
    { key: "datetime", header: "Quando", render: (l) => new Date(l.datetime).toLocaleString("pt-BR") },
    { key: "userEmail", header: "Usuário", render: (l) => l.userEmail },
    { key: "action", header: "Ação", render: (l) => l.action },
    { key: "ip", header: "IP", render: (l) => l.ip },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[200px]">
          <FormField label="Email do usuário" htmlFor="log-email">
            <Input
              id="log-email"
              value={userEmail}
              onChange={(e) => {
                setUserEmail(e.target.value);
                setPage(1);
              }}
            />
          </FormField>
        </div>
        <div className="min-w-[160px]">
          <FormField label="IP" htmlFor="log-ip">
            <Input
              id="log-ip"
              value={ip}
              onChange={(e) => {
                setIp(e.target.value);
                setPage(1);
              }}
            />
          </FormField>
        </div>
      </div>

      <Table
        columns={columns}
        rows={query.data?.logs ?? []}
        rowKey={(l) => l.id}
        density="compact"
        emptyTitle={query.isLoading ? "Carregando..." : "Nenhum log encontrado"}
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
