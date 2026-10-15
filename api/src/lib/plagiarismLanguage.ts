// Maps a submission's file extension to the language flag each CLI
// expects. Deliberately small: only the languages actually offered as
// allowed_files today. Add here, not ad-hoc in a provider, when a new
// language needs plagiarism checks.
const LANGUAGE_BY_EXTENSION: Record<string, { jplag: string; dolos: string }> = {
  py: { jplag: "python3", dolos: "python" },
  c: { jplag: "c", dolos: "c" },
  cpp: { jplag: "cpp", dolos: "cpp" },
  java: { jplag: "java", dolos: "java" },
  js: { jplag: "javascript", dolos: "javascript" },
  ts: { jplag: "typescript", dolos: "typescript" },
  cs: { jplag: "csharp", dolos: "csharp" },
  go: { jplag: "go", dolos: "go" },
  rs: { jplag: "rust", dolos: "rust" },
};

export function languageFor(extension: string, tool: "jplag" | "dolos"): string | null {
  return LANGUAGE_BY_EXTENSION[extension.toLowerCase()]?.[tool] ?? null;
}
