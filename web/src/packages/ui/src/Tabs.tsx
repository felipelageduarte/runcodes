import { motion } from "motion/react";
import { cn } from "./lib/cn";

export interface TabItem {
  key: string;
  label: string;
}

/** Tabs locais (sem rota própria) — troca de conteúdo dentro de uma
 * mesma página de gestão. Underline compartilha layoutId com a pill de
 * nav do AppShell conceitualmente, mas é escopada por instância via
 * `layoutId` único pra não colidir entre Tabs na mesma tela. */
export function Tabs({
  tabs,
  active,
  onChange,
  layoutId,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  layoutId: string;
}) {
  return (
    <div className="flex gap-1 border-b border-border" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative px-3 py-2 text-sm font-medium transition-colors",
            active === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {active === tab.key && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-x-0 -bottom-px h-0.5 bg-primary-600"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
