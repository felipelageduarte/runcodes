import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteAlert, listAllAlerts } from "@runcodes/api-client";
import { Badge, Button, EmptyState, Skeleton, toast } from "@runcodes/ui";
import { AlertFormDialog } from "./AlertFormDialog";

const typeLabels: Record<number, string> = { 0: "Informativo", 1: "Aviso", 2: "Urgente", 3: "Manutenção" };

export function AlertsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["alerts", "all"], queryFn: () => listAllAlerts() });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAlert(id),
    onSuccess: () => {
      toast.success("Aviso removido");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: () => toast.error("Não foi possível remover o aviso"),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex justify-end">
        <AlertFormDialog trigger={<Button size="sm">Novo aviso</Button>} />
      </div>

      {query.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !query.data || query.data.alerts.length === 0 ? (
        <EmptyState title="Nenhum aviso cadastrado" />
      ) : (
        <ul className="space-y-2">
          {query.data.alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{alert.title}</p>
                  <Badge variant="neutral">{typeLabels[alert.type] ?? "—"}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  válido até {new Date(alert.valid).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{alert.message}</p>
              <div className="flex gap-2">
                <AlertFormDialog
                  existing={alert}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  }
                />
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(alert.id)}>
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
