const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  py: "python",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  "omp.c": "c",
  "mpi.c": "c",
  java: "java",
  js: "javascript",
  ts: "typescript",
  sh: "shell",
  rs: "rust",
  go: "go",
};

export function languageForExtension(extension: string): string {
  return LANGUAGE_BY_EXTENSION[extension.toLowerCase()] ?? "plaintext";
}
