import { useRef, useState, type PointerEvent, type ReactNode } from "react";

const MIN_HEIGHT = 96;
const MAX_HEIGHT = 560;

/** Painel inferior redimensionável por arraste — mesmo padrão do painel
 * de terminal do VS Code. Sem lib nova: drag via Pointer Events com
 * `setPointerCapture`, que mantém os eventos de move na handle mesmo
 * quando o cursor sai dela durante o arraste. */
export function ResizableConsole({ children, defaultHeight = 220 }: { children: ReactNode; defaultHeight?: number }) {
  const [height, setHeight] = useState(defaultHeight);
  const dragStart = useRef<{ y: number; height: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    dragStart.current = { y: e.clientY, height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const delta = dragStart.current.y - e.clientY;
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStart.current.height + delta)));
  }

  function onPointerUp() {
    dragStart.current = null;
  }

  return (
    <div className="flex shrink-0 flex-col border-t border-border" style={{ height }}>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Redimensionar console"
        className="h-1.5 shrink-0 cursor-row-resize bg-border/60 transition-colors hover:bg-primary-500/60"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="flex-1 overflow-auto bg-background">{children}</div>
    </div>
  );
}
