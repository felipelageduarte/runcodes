import { useCallback, useEffect, useState } from "react";
import type { ProjectFile } from "./zipProject";

function draftKey(exerciseId: number): string {
  return `runcodes.editor-draft.project.${exerciseId}`;
}

/** Mesma ideia do `useDraft` (rascunho local por exercício, nunca
 * enviado até o aluno confirmar) mas pra um projeto multi-arquivo — a
 * lista inteira de arquivos serializada, não uma string só. */
export function useProjectDraft(exerciseId: number, initialFiles: ProjectFile[]) {
  const [files, setFiles] = useState<ProjectFile[]>(() => {
    try {
      const raw = localStorage.getItem(draftKey(exerciseId));
      return raw ? (JSON.parse(raw) as ProjectFile[]) : initialFiles;
    } catch {
      return initialFiles;
    }
  });

  useEffect(() => {
    try {
      if (files.length > 0) localStorage.setItem(draftKey(exerciseId), JSON.stringify(files));
      else localStorage.removeItem(draftKey(exerciseId));
    } catch {
      // localStorage indisponível (modo privado, cota excedida) — rascunho
      // local é uma conveniência, não uma garantia; falha silenciosa.
    }
  }, [exerciseId, files]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(exerciseId));
    } catch {
      // ver nota acima
    }
  }, [exerciseId]);

  return { files, setFiles, clearDraft };
}
