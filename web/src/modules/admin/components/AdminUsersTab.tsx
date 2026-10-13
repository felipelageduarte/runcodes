import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAdminUsers, type AdminUserRecord } from "@runcodes/api-client";
import { userTypeLabel } from "@runcodes/shared";
import { Badge, Button, FormField, Input, Table, type TableColumn } from "@runcodes/ui";
import { UserEditDialog } from "./UserEditDialog";

const PAGE_SIZE = 20;

export function AdminUsersTab() {
  const [emailFilter, setEmailFilter] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-users", { email: emailFilter, page }],
    queryFn: () => listAdminUsers({ email: emailFilter || undefined, page, pageSize: PAGE_SIZE }),
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  const columns: TableColumn<AdminUserRecord>[] = [
    { key: "name", header: "Nome", render: (u) => u.name },
    { key: "email", header: "Email", render: (u) => u.email },
    { key: "type", header: "Tipo", render: (u) => userTypeLabel(u.type) },
    {
      key: "confirmed",
      header: "Confirmado",
      align: "center",
      render: (u) => <Badge variant={u.confirmed ? "success" : "warning"}>{u.confirmed ? "Sim" : "Não"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) => (
        <UserEditDialog
          user={u}
          trigger={
            <Button variant="ghost" size="sm">
              Editar
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="max-w-xs">
        <FormField label="Buscar por email" htmlFor="email-filter">
          <Input
            id="email-filter"
            value={emailFilter}
            onChange={(e) => {
              setEmailFilter(e.target.value);
              setPage(1);
            }}
          />
        </FormField>
      </div>

      <Table
        columns={columns}
        rows={query.data?.users ?? []}
        rowKey={(u) => u.email}
        density="compact"
        emptyTitle={query.isLoading ? "Carregando..." : "Nenhum usuário encontrado"}
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
