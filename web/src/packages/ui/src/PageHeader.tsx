import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { cn } from "./lib/cn";
import { Breadcrumb, type Crumb } from "./Breadcrumb";

export interface PageHeaderProps {
  title: ReactNode;
  /** Linha menor acima do título — contexto ("Turma", "Administração"). */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  /** Trilha completa acima do título — telas profundas. Quando presente,
   * substitui o link "voltar" (os dois juntos seriam redundância). */
  crumbs?: Crumb[];
  /** Rota do link "voltar" renderizado acima do título. */
  backTo?: string;
  backLabel?: string;
  /** Ações à direita (botões). Empilham abaixo do título no mobile. */
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho padrão de página — título em font-display com entrada
 * animada, substitui os 12 `<h1 className="text-2xl font-semibold">`
 * copiados à mão. */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  crumbs,
  backTo,
  backLabel = "Voltar",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mb-6 flex flex-col gap-3 sm:mb-8", className)}
    >
      {crumbs && crumbs.length > 0 && <Breadcrumb crumbs={crumbs} />}
      {!crumbs?.length && backTo && (
        <Link
          to={backTo}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary-600">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.header>
  );
}

/** Sub-cabeçalho de seção dentro de uma página. */
export function SectionHeader({
  title,
  actions,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {actions}
    </div>
  );
}
