import { useQuery } from "@tanstack/react-query";
import { type ForeignKey, getDbSchema } from "@runcodes/api-client";
import { Badge, cn, Table, type TableColumn } from "@runcodes/ui";
import { KeyRound } from "lucide-react";

const relationColumns: TableColumn<ForeignKey>[] = [
  {
    key: "source",
    header: "Tabela.coluna",
    render: (fk) => (
      <span className="whitespace-nowrap font-mono text-xs">
        {fk.table}.{fk.column}
      </span>
    ),
  },
  {
    key: "target",
    header: "Referencia",
    render: (fk) => (
      <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {fk.refTable}.{fk.refColumn}
      </span>
    ),
  },
];

/** No connecting lines between cards — a real layout engine (avoiding
 * overlap across ~30 tables) is a bigger lift than the value here.
 * Each table lists which columns are foreign keys and to where;
 * "Relacionamentos" below is the flat edge list for anyone who wants
 * the full picture. */
export function ErdView() {
  const query = useQuery({ queryKey: ["admin-db-schema"], queryFn: getDbSchema });
  const data = query.data;

  const fkByTableColumn = new Map((data?.foreignKeys ?? []).map((fk) => [`${fk.table}.${fk.column}`, fk]));

  return (
    <div className="space-y-6 py-4">
      {query.isLoading && <p className="text-sm text-muted-foreground">Carregando esquema...</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.tables ?? []).map((table) => (
          <div key={table.name} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
              <span className="font-mono text-sm font-medium">{table.name}</span>
              <Badge variant="neutral">{table.rowEstimate} linhas</Badge>
            </div>
            <ul className="divide-y divide-border/50">
              {table.columns.map((col) => {
                const fk = fkByTableColumn.get(`${table.name}.${col.name}`);
                return (
                  <li key={col.name} className="flex items-center justify-between gap-2 px-3 py-1 text-xs">
                    <span className={cn("flex items-center gap-1 font-mono", col.isPrimaryKey && "font-semibold")}>
                      {col.isPrimaryKey && <KeyRound className="size-3 text-warning" />}
                      {col.name}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {fk ? `→ ${fk.refTable}.${fk.refColumn}` : col.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Relacionamentos</h3>
        <Table
          columns={relationColumns}
          rows={data?.foreignKeys ?? []}
          rowKey={(fk) => `${fk.table}.${fk.column}`}
          density="compact"
          emptyTitle="Nenhum relacionamento encontrado"
        />
      </div>
    </div>
  );
}
