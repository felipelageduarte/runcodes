import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "./lib/cn";

const colorStyles = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  info: "bg-info/15 text-info",
  purple: "bg-accent-purple/15 text-accent-purple",
} as const;

export interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: keyof typeof colorStyles;
  className?: string;
}

/** Card de resumo numérico — ícone colorido + valor grande. Usado em
 * topo de dashboard pra dar peso visual mesmo quando a lista abaixo
 * está curta (ver docs/frontend/design-system.md). */
export function StatCard({ icon, label, value, color = "primary", className }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", colorStyles[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}
