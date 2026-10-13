import { useQuery } from "@tanstack/react-query";
import { listUniversities } from "@runcodes/api-client";
import { Button, EmptyState, Skeleton, Table, type TableColumn } from "@runcodes/ui";
import { UniversityFormDialog } from "./UniversityFormDialog";
import type { UniversitySummary } from "@runcodes/api-client";

export function UniversitiesTab() {
  const query = useQuery({ queryKey: ["universities"], queryFn: listUniversities });

  const columns: TableColumn<UniversitySummary>[] = [
    { key: "abbreviation", header: "Sigla", render: (u) => u.abbreviation },
    { key: "name", header: "Nome", render: (u) => u.name },
    { key: "state", header: "UF", align: "center", render: (u) => u.state ?? "—" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) => (
        <UniversityFormDialog
          existing={u}
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
      <div className="flex justify-end">
        <UniversityFormDialog trigger={<Button size="sm">Nova instituição</Button>} />
      </div>
      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !query.data || query.data.length === 0 ? (
        <EmptyState title="Nenhuma instituição cadastrada" />
      ) : (
        <Table columns={columns} rows={query.data} rowKey={(u) => u.id} density="compact" emptyTitle="Nenhuma instituição" />
      )}
    </div>
  );
}
