import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

/** "Aviso antes de navegar pra fora com edição pendente" —
 * docs/frontend/code-editor.md. Cobre as duas formas de "sair":
 * fechar/recarregar a aba (beforeunload) e navegar pra outra rota do
 * próprio app (useBlocker, já que o router é um data router). */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  useBlocker(() => {
    if (!hasUnsavedChanges) return false;
    return !window.confirm("Você tem mudanças não salvas no editor. Sair sem enviar?");
  });
}
