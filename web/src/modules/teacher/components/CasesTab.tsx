import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteExerciseCase, listExerciseCases } from "@runcodes/api-client";
import { Badge, Button, EmptyState, Skeleton, toast } from "@runcodes/ui";
import { CaseFormDialog } from "./CaseFormDialog";
import { CaseFilesDialog } from "./CaseFilesDialog";

const outputTypeLabels: Record<number, string> = { 1: "Texto exato", 2: "Números", 3: "Binário" };

export function CasesTab({ exerciseId, notCompilable }: { exerciseId: number; notCompilable: boolean }) {
  const queryClient = useQueryClient();

  const casesQuery = useQuery({
    queryKey: ["exercise", exerciseId, "cases"],
    queryFn: () => listExerciseCases(exerciseId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteExerciseCase(id),
    onSuccess: () => {
      toast.success("Caso de teste removido");
      queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId, "cases"] });
    },
    onError: () => toast.error("Não foi possível remover o caso de teste"),
  });

  if (notCompilable) {
    return <EmptyState title="Esse exercício não usa casos de teste" description="Tipo não compilável." />;
  }

  return (
    <div className="space-y-3 py-4">
      <div className="flex justify-end">
        <CaseFormDialog
          exerciseId={exerciseId}
          trigger={<Button size="sm">Novo caso de teste</Button>}
        />
      </div>

      {casesQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !casesQuery.data || casesQuery.data.length === 0 ? (
        <EmptyState title="Nenhum caso de teste cadastrado" />
      ) : (
        <ul className="space-y-2">
          {casesQuery.data.map((caseItem) => (
            <li
              key={caseItem.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="neutral">#{caseItem.id}</Badge>
                <span className="text-foreground">{outputTypeLabels[caseItem.outputType] ?? "—"}</span>
                <span className="text-muted-foreground">· cputime {caseItem.cputime}s</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CaseFilesDialog
                  caseId={caseItem.id}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Arquivos
                    </Button>
                  }
                />
                <CaseFormDialog
                  exerciseId={exerciseId}
                  existing={caseItem}
                  trigger={
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  }
                />
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(caseItem.id)}>
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
