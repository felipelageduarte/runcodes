import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

/** Entrada escalonada pra listas (fila de exercícios, tabelas de card) —
 * em vez de tudo aparecer de uma vez, um leve atraso item-a-item. Troca
 * de rota já tem RouteTransition (app/); isto é especificamente pra
 * conteúdo dentro da página. */
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.ul variants={container} initial="hidden" animate="show" className={className}>
      {children}
    </motion.ul>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.li variants={item} className={className}>
      {children}
    </motion.li>
  );
}
