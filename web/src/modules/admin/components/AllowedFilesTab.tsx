import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAllAllowedFiles, updateAllowedFile, type AllowedFile } from "@runcodes/api-client";
import { Badge, Button, EmptyState, Skeleton, Table, type TableColumn, toast } from "@runcodes/ui";
import { AllowedFileFormDialog } from "./AllowedFileFormDialog";

export function AllowedFilesTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["allowed-files", "all"], queryFn: listAllAllowedFiles });

  const toggleMutation = useMutation({
    mutationFn: (file: AllowedFile) => updateAllowedFile(file.id, { available: !file.available }),
    onSuccess: () => {
      toast.success("Disponibilidade atualizada");
      queryClient.invalidateQueries({ queryKey: ["allowed-files", "all"] });
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const columns: TableColumn<AllowedFile>[] = [
    { key: "name", header: "Nome", render: (f) => f.name },
    { key: "extension", header: "Extensão", render: (f) => f.extension },
    {
      key: "compilable",
      header: "Compilável",
      align: "center",
      render: (f) => <Badge variant={f.compilable ? "success" : "neutral"}>{f.compilable ? "Sim" : "Não"}</Badge>,
    },
    {
      key: "available",
      header: "Disponível",
      align: "center",
      render: (f) => <Badge variant={f.available ? "success" : "danger"}>{f.available ? "Sim" : "Não"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (f) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" loading={toggleMutation.isPending} onClick={() => toggleMutation.mutate(f)}>
            {f.available ? "Desabilitar" : "Habilitar"}
          </Button>
          <AllowedFileFormDialog
            existing={f}
            trigger={
              <Button variant="ghost" size="sm">
                Editar
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <AllowedFileFormDialog trigger={<Button size="sm">Novo tipo de arquivo</Button>} />
      </div>
      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !query.data || query.data.length === 0 ? (
        <EmptyState title="Nenhum tipo de arquivo cadastrado" />
      ) : (
        <Table columns={columns} rows={query.data} rowKey={(f) => f.id} density="compact" emptyTitle="Nenhum tipo de arquivo" />
      )}
    </div>
  );
}
