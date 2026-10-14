import type { HTMLAttributes } from "react";
import { cn } from "./lib/cn";

export type PageWidth = "narrow" | "reading" | "default" | "wide" | "full";

/** Larguras canônicas de página — substitui os `max-w-*` ad-hoc que cada
 * página escolhia por conta própria (sm→5xl, sem critério). Regra:
 * formulários = narrow, conteúdo de leitura = reading, dashboards =
 * default, tabelas largas/editores = wide, ferramentas de tela cheia
 * (SQL console, notas) = full. */
const WIDTHS: Record<PageWidth, string> = {
  narrow: "max-w-2xl",
  reading: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-screen-2xl",
  full: "max-w-none",
};

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: PageWidth;
}

export function PageContainer({ width = "default", className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8", WIDTHS[width], className)}
      {...props}
    />
  );
}
