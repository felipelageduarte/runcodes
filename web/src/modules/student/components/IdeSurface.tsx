import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";

export function IdeExpandButton({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={onToggle}
      aria-label={expanded ? "Restaurar editor" : "Expandir editor"}
      title={expanded ? "Restaurar (Esc)" : "Tela cheia"}
    >
      {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </button>
  );
}

/** Superfície do editor com modo tela cheia — um overlay flutuante com
 * margem uniforme em todos os lados, então o quadro mantém a mesma
 * razão de aspecto do viewport (pedido de design: "modal quase do
 * tamanho da tela, com a mesma razão de aspecto do site"). A barra de
 * status azul embaixo é a assinatura visual do VS Code, cujo motor de
 * edição (Monaco) já usamos. Esc ou o botão de restaurar voltam pro
 * layout embutido na página. */
export function IdeSurface({
  expanded,
  onCollapse,
  statusItems,
  children,
}: {
  expanded: boolean;
  onCollapse: () => void;
  /** Itens da barra de status (só visível em tela cheia), ex. nome do arquivo, linguagem. */
  statusItems: ReactNode[];
  children: ReactNode;
}) {
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCollapse();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded, onCollapse]);

  const frame = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background">
      {children}
      {expanded && (
        <div className="flex h-6 shrink-0 items-center gap-4 overflow-hidden bg-[#007acc] px-3 font-mono text-[11px] leading-none text-white">
          {statusItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1 whitespace-nowrap">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (!expanded) {
    return <div className="h-full min-h-[70vh]">{frame}</div>;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-black/70 p-3 backdrop-blur-sm sm:p-5 lg:p-6" role="dialog" aria-modal="true">
      <div className="min-h-0 min-w-0 flex-1 shadow-2xl">{frame}</div>
    </div>,
    document.body,
  );
}
