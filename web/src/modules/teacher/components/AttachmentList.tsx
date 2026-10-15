import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@runcodes/api-client";
import { Button, EmptyState, Skeleton, toast } from "@runcodes/ui";
import { Paperclip, Trash2 } from "lucide-react";

interface AttachmentRecordLike {
  id: number;
  path: string;
}

/** Lista+upload+delete genérico — exercise-files e compilation-files
 * são o mesmo shape (AttachmentRecord) servido por dois mounts
 * diferentes do mesmo router no backend, então uma UI só cobre as duas. */
export function AttachmentList({
  title,
  hint,
  queryKey,
  list,
  upload,
  remove,
  downloadUrl,
}: {
  title: string;
  hint?: string;
  queryKey: readonly unknown[];
  list: () => Promise<AttachmentRecordLike[]>;
  upload: (file: File) => Promise<AttachmentRecordLike>;
  remove: (id: number) => Promise<void>;
  downloadUrl: (id: number) => string;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filesQuery = useQuery({ queryKey, queryFn: list });

  const uploadMutation = useMutation({
    mutationFn: upload,
    onSuccess: () => {
      toast.success("Arquivo enviado");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError && err.code === "file_type_not_allowed"
          ? "Esse tipo de arquivo não é permitido"
          : "Não foi possível enviar o arquivo",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Arquivo removido");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não foi possível remover o arquivo"),
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          Enviar arquivo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = "";
          }}
        />
      </div>

      {filesQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !filesQuery.data || filesQuery.data.length === 0 ? (
        <EmptyState title="Nenhum arquivo enviado ainda" />
      ) : (
        <ul className="space-y-1">
          {filesQuery.data.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <a
                href={downloadUrl(file.id)}
                className="flex min-w-0 items-center gap-2 truncate text-foreground hover:underline"
              >
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.path.split("/").pop()}</span>
              </a>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-danger"
                onClick={() => deleteMutation.mutate(file.id)}
                aria-label="Remover arquivo"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
