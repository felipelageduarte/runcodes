import Editor from "@monaco-editor/react";
import { useTheme } from "@runcodes/shared";
import "./setup";
import { languageForExtension } from "./languageForExtension";

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Extensão do arquivo (sem ponto, ex. "py") — decide o highlight. */
  extension: string;
  height?: string | number;
  readOnly?: boolean;
}

/** Motor de edição do VS Code, sem o resto do IDE — ver
 * docs/frontend/code-editor.md. Nunca executa código no browser: o
 * conteúdo só vira um arquivo na hora de submeter, pelo mesmo caminho de
 * upload que já existia. */
export function CodeEditor({ value, onChange, extension, height = "100%", readOnly }: CodeEditorProps) {
  const { theme } = useTheme();

  return (
    <Editor
      language={languageForExtension(extension)}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      theme={theme === "dark" ? "vs-dark" : "light"}
      height={height}
      options={{
        readOnly,
        minimap: { enabled: true, scale: 1 },
        fontSize: 13,
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderLineHighlight: "all",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: true },
        padding: { top: 8 },
      }}
    />
  );
}
