import { useQuery } from "@tanstack/react-query";
import { getDbSchema } from "@runcodes/api-client";
import { Badge, cn } from "@runcodes/ui";
import { KeyRound } from "lucide-react";

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
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Tabela.coluna</th>
                <th className="px-3 py-2">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {(data?.foreignKeys ?? []).map((fk) => (
                <tr key={`${fk.table}.${fk.column}`} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">
                    {fk.table}.{fk.column}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-muted-foreground">
                    {fk.refTable}.{fk.refColumn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
