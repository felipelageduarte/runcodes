import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "./lib/cn";

export interface Crumb {
  label: string;
  /** Sem `to` = página atual (não vira link). */
  to?: string;
}

/** Trilha de navegação pra telas profundas (Turma → Exercício →
 * Submissão) — sempre visível, prevista no design-system.md. */
export function Breadcrumb({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Trilha de navegação" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && (
                <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/60" />
              )}
              <li className="min-w-0">
                {crumb.to && !last ? (
                  <Link
                    to={crumb.to}
                    className="block max-w-48 truncate font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className="block max-w-64 truncate font-medium text-foreground"
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
