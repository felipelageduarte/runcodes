import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "./lib/cn";
import { EmptyState } from "./EmptyState";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  /** "compact" cuts vertical padding — professor-facing dense grids
   * (notas, submissões) vs. the roomier default for student-facing
   * lists. See docs/frontend/design-system.md#densidade-adaptativa. */
  align?: "left" | "right" | "center";
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  density?: "default" | "compact";
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (key: string) => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
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
}: TableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const cellPadding = density === "compact" ? "px-3 py-1.5" : "px-4 py-3";

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  cellPadding,
                  "font-medium text-muted-foreground",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
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
            <tr key={rowKey(row)} className="hover:bg-muted/30">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    cellPadding,
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
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
}
