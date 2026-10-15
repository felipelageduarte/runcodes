import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

/** Troca de rota com motion em vez de corte seco — mesmo espírito do
 * resto do produto (nenhuma mutação some/aparece sem transição, ver
 * docs/frontend/design-system.md). `mode="wait"` evita as duas páginas
 * sobrepostas durante a troca. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
