import { useCallback, useEffect, useState } from "react";

function draftKey(exerciseId: number): string {
  return `runcodes.editor-draft.${exerciseId}`;
}

/** Rascunho local por exercício — nunca enviado ao servidor até o aluno
 * confirmar a submissão (ver docs/frontend/code-editor.md). Evita perder
 * o que foi escrito se a aba recarregar antes de submeter. */
export function useDraft(exerciseId: number, initialValue: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(draftKey(exerciseId)) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (value) localStorage.setItem(draftKey(exerciseId), value);
      else localStorage.removeItem(draftKey(exerciseId));
    } catch {
      // localStorage indisponível (modo privado, cota excedida) — rascunho
      // local é uma conveniência, não uma garantia; falha silenciosa.
    }
  }, [exerciseId, value]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(exerciseId));
    } catch {
      // ver nota acima
    }
  }, [exerciseId]);

  return { value, setValue, clearDraft };
}
