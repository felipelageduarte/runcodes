import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCommitContent, listCommitsForExercise, type CommitRecord, type ExerciseDetail } from "@runcodes/api-client";
import { extensionOfFilename } from "@runcodes/shared";
import { Button, Skeleton } from "@runcodes/ui";
import {
  base64ToBytes,
  CodeEditor,
  languageForExtension,
  unzipProject,
  useProjectDraft,
  useUnsavedChangesGuard,
  zipProject,
} from "@runcodes/editor";
import { FilePlus, Play, Trash2 } from "lucide-react";
import { useEditorSubmission } from "../hooks/useEditorSubmission";
import { IdeExpandButton, IdeSurface } from "./IdeSurface";
import { ResizableConsole } from "./ResizableConsole";
import { SubmissionOutcome, SubmissionStatusBadge } from "./SubmissionOutcome";

/** Variante multi-arquivo do editor — aluno monta um projeto inteiro
 * (ex. main.c + utils.h + Makefile) em vez de um arquivo só. Vira um
 * .zip na hora de enviar; o runcodes-compiler já sabe extrair e compilar
 * um .zip com Makefile (mecanismo existente, não precisou de mudança
 * no pipeline — só aqui no frontend). Acionado quando o exercício
 * aceita extensão "zip" (ver `EditorSubmissionMode`). */
export function ProjectEditorMode({
  exercise,
  onSubmitted,
}: {
  exercise: ExerciseDetail;
  onSubmitted: (commit: CommitRecord) => void;
}) {
  const { files, setFiles, clearDraft } = useProjectDraft(exercise.id, []);
  const [activeFile, setActiveFile] = useState<string | null>(files[0]?.name ?? null);
  const [preloaded, setPreloaded] = useState(false);
  // Abre direto em tela cheia — mesma razão do SingleFileEditorMode.
  const [expanded, setExpanded] = useState(true);
  const [newFileName, setNewFileName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const commitsQuery = useQuery({
    queryKey: ["exercise-commits", exercise.id],
    queryFn: () => listCommitsForExercise(exercise.id),
    enabled: !preloaded && files.length === 0,
  });
  const lastCommitId = commitsQuery.data?.[0]?.id;
  const contentQuery = useQuery({
    queryKey: ["commit-content", lastCommitId],
    queryFn: () => getCommitContent(lastCommitId!),
    enabled: !preloaded && files.length === 0 && lastCommitId !== undefined,
  });

  useEffect(() => {
    if (preloaded || files.length > 0) return;
    if (contentQuery.data) {
      const unzipped =
        contentQuery.data.encoding === "base64"
          ? unzipProject(base64ToBytes(contentQuery.data.content))
          : [{ name: contentQuery.data.filename, content: contentQuery.data.content }];
      setFiles(unzipped);
      setActiveFile(unzipped[0]?.name ?? null);
      setPreloaded(true);
    } else if (commitsQuery.isSuccess && !lastCommitId) {
      setPreloaded(true); // nunca submeteu nada — nada pra pré-carregar
    }
  }, [contentQuery.data, commitsQuery.isSuccess, lastCommitId, preloaded, files.length, setFiles]);

  const { mutation, activeCommitId, activeCommit, casesQuery } = useEditorSubmission(exercise, (commit) => {
    onSubmitted(commit);
    clearDraft();
  });

  useUnsavedChangesGuard(files.length > 0 && !mutation.isPending);

  const active = files.find((f) => f.name === activeFile) ?? null;

  function updateActiveContent(content: string) {
    if (!activeFile) return;
    setFiles(files.map((f) => (f.name === activeFile ? { ...f, content } : f)));
  }

  function addFile() {
    const name = newFileName.trim();
    if (!name || files.some((f) => f.name === name)) return;
    setFiles([...files, { name, content: "" }]);
    setActiveFile(name);
    setNewFileName("");
  }

  function deleteFile(name: string) {
    const next = files.filter((f) => f.name !== name);
    setFiles(next);
    if (activeFile === name) setActiveFile(next[0]?.name ?? null);
  }

  function commitRename(oldName: string) {
    const name = renameValue.trim();
    setRenaming(null);
    if (!name || name === oldName || files.some((f) => f.name === name)) return;
    setFiles(files.map((f) => (f.name === oldName ? { ...f, name } : f)));
    if (activeFile === oldName) setActiveFile(name);
  }

  function handleSubmit() {
    const zipped = zipProject(files);
    const file = new File([zipped], "solution.zip", { type: "application/zip" });
    mutation.mutate(file);
  }

  const loadingPreload = !preloaded && files.length === 0 && (commitsQuery.isLoading || contentQuery.isFetching);

  return (
    <IdeSurface
      expanded={expanded}
      onCollapse={() => setExpanded(false)}
      statusItems={[
        active ? active.name : "Projeto (.zip)",
        active ? languageForExtension(extensionOfFilename(active.name) || "txt") : "",
        `${files.length} arquivo${files.length === 1 ? "" : "s"}`,
      ]}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">
          {active ? active.name : "Projeto (.zip)"}
        </span>
        <div className="flex items-center gap-2">
          {activeCommit && <SubmissionStatusBadge status={activeCommit.status} />}
          <Button size="sm" disabled={files.length === 0} loading={mutation.isPending} onClick={handleSubmit}>
            <Play className="size-3.5" />
            Enviar submissão
          </Button>
          <IdeExpandButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-52 shrink-0 flex-col border-r border-border bg-muted/20">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {files.map((f) => (
              <div
                key={f.name}
                className={`group flex items-center gap-1 px-2 py-1.5 text-xs ${
                  f.name === activeFile ? "bg-primary-100 text-primary-700" : "text-foreground hover:bg-muted"
                }`}
              >
                {renaming === f.name ? (
                  <input
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0.5 font-mono text-xs"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(f.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(f.name);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-mono"
                    onClick={() => setActiveFile(f.name)}
                    onDoubleClick={() => {
                      setRenaming(f.name);
                      setRenameValue(f.name);
                    }}
                    title="Clique duplo pra renomear"
                  >
                    {f.name}
                  </button>
                )}
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
                  onClick={() => deleteFile(f.name)}
                  aria-label={`Remover ${f.name}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
            {files.length === 0 && !loadingPreload && (
              <p className="p-3 text-xs text-muted-foreground">Adicione um arquivo pra começar.</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 border-t border-border p-1.5">
            <input
              className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 font-mono text-xs"
              placeholder="main.c"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFile()}
            />
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={addFile}
              aria-label="Novo arquivo"
            >
              <FilePlus className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {loadingPreload ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : active ? (
            <CodeEditor
              value={active.content}
              onChange={updateActiveContent}
              extension={extensionOfFilename(active.name) || "txt"}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Selecione ou crie um arquivo
            </div>
          )}
        </div>
      </div>

      {activeCommitId !== null && (
        <ResizableConsole>
          {activeCommit ? (
            <SubmissionOutcome commit={activeCommit} cases={casesQuery.data} />
          ) : (
            <p className="p-3 text-xs text-muted-foreground">Carregando resultado...</p>
          )}
        </ResizableConsole>
      )}
    </IdeSurface>
  );
}
