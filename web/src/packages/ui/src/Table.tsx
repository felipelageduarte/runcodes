import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "./lib/cn";
import { EmptyState } from "./EmptyState";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** "compact" cuts vertical padding — professor-facing dense grids
   * (notas, submissões) vs. the roomier default for student-facing
   * lists. See docs/frontend/design-system.md#densidade-adaptativa. */
  density?: "default" | "compact";
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (key: string) => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Primeira coluna fixa no scroll horizontal — matriz de notas e
   * afins, onde a identidade da linha não pode sumir ao rolar. */
  stickyFirstColumn?: boolean;
  /** Abaixo de `sm`, troca a tabela por um card por linha (header da
   * coluna vira label) — densidade tabular não cabe em tela estreita.
   * Ver docs/frontend/design-system.md#responsividade. */
  mobileCards?: boolean;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  density = "default",
  sortKey,
  sortDirection,
  onSortChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  stickyFirstColumn = false,
  mobileCards = false,
}: TableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const cellPadding = density === "compact" ? "px-3 py-1.5" : "px-4 py-3";

  const table = (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-border",
        mobileCards && "hidden sm:block",
      )}
    >
      <table className="w-full text-left text-sm">
        <thead
          className={cn("border-b border-border", stickyFirstColumn ? "bg-muted" : "bg-muted/50")}
        >
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  cellPadding,
                  "font-medium text-muted-foreground",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  stickyFirstColumn && i === 0 && "sticky left-0 z-10 bg-muted",
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => onSortChange?.(col.key)}
                  >
                    {col.header}
                    {sortKey === col.key ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="group hover:bg-muted/30">
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={cn(
                    cellPadding,
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    stickyFirstColumn && i === 0 && "sticky left-0 z-10 bg-card group-hover:bg-muted",
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!mobileCards) return table;

  return (
    <>
      {table}
      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <div className="mb-2 text-sm font-medium text-foreground">
              {columns[0].render(row)}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              {columns.slice(1).map((col) => (
                <div key={col.key} className="contents">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {col.header}
                  </dt>
                  <dd className="text-sm text-foreground">{col.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
