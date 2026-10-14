import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./lib/cn";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Paginação server-side — anterior/próxima + contagem. Só aparece
 * quando há mais de uma página. */
export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const navButton =
    "inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <p className="text-xs text-muted-foreground">
        <span className="tabular-nums">
          {from}–{to}
        </span>{" "}
        de <span className="tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={navButton}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterior
        </button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={navButton}
        >
          Próxima
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </nav>
  );
}
