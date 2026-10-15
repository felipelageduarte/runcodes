import { useRef } from "react";
import { motion } from "motion/react";
import { cn } from "./lib/cn";

export interface TabItem {
  key: string;
  label: string;
}

/** IDs previsíveis pra ligar cada tab ao seu painel (aria-controls /
 * aria-labelledby) — quem renderiza o conteúdo da aba usa essas mesmas
 * funções pra montar o wrapper (ver docs/frontend/design-system.md).
 * `layoutId` já é único por instância de Tabs na tela, então reaproveitar
 * ele aqui evita colisão entre duas <Tabs> na mesma página. */
export function tabButtonId(layoutId: string, key: string): string {
  return `${layoutId}-tab-${key}`;
}
export function tabPanelId(layoutId: string, key: string): string {
  return `${layoutId}-panel-${key}`;
}

/** Tabs locais (sem rota própria) — troca de conteúdo dentro de uma
 * mesma página de gestão. Underline compartilha layoutId com a pill de
 * nav do AppShell conceitualmente, mas é escopada por instância via
 * `layoutId` único pra não colidir entre Tabs na mesma tela.
 *
 * Segue o padrão ARIA de tablist: só a tab ativa é alcançável por Tab
 * (roving tabindex), setas Esquerda/Direita/Home/End movem o foco E a
 * seleção entre as abas — não é só decoração visual, teclado e leitor
 * de tela navegam de verdade (docs/frontend/roadmap.md Fase 6). */
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
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusAndSelect(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.key);
    buttonRefs.current[tab.key]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusAndSelect((index + 1) % tabs.length);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusAndSelect((index - 1 + tabs.length) % tabs.length);
        break;
      case "Home":
        e.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        e.preventDefault();
        focusAndSelect(tabs.length - 1);
        break;
    }
  }

  return (
    <div className="flex gap-1 border-b border-border" role="tablist">
      {tabs.map((tab, index) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              buttonRefs.current[tab.key] = el;
            }}
            type="button"
            role="tab"
            id={tabButtonId(layoutId, tab.key)}
            aria-controls={tabPanelId(layoutId, tab.key)}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-primary-600"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
