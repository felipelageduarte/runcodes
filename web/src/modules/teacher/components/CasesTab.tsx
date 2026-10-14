import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteExerciseCase,
  exerciseCasesDownloadUrl,
  listExerciseCases,
  removeAllExerciseCases,
  setExerciseCasesVisibility,
} from "@runcodes/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  toast,
} from "@runcodes/ui";
import { CaseFormDialog } from "./CaseFormDialog";
import { CaseFilesDialog } from "./CaseFilesDialog";
import { BatchCaseDialog } from "./BatchCaseDialog";

const outputTypeLabels: Record<number, string> = { 1: "Texto exato", 2: "Números", 3: "Binário" };

export function CasesTab({ exerciseId, notCompilable }: { exerciseId: number; notCompilable: boolean }) {
  const queryClient = useQueryClient();
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);

  const casesQuery = useQuery({
    queryKey: ["exercise", exerciseId, "cases"],
    queryFn: () => listExerciseCases(exerciseId),
  });

  const invalidateCases = () => queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId, "cases"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteExerciseCase(id),
    onSuccess: () => {
      toast.success("Caso de teste removido");
      invalidateCases();
    },
    onError: () => toast.error("Não foi possível remover o caso de teste"),
  });

  const visibilityMutation = useMutation({
    mutationFn: (patch: { showInput?: boolean; showExpectedOutput?: boolean; showUserOutput?: boolean }) =>
      setExerciseCasesVisibility(exerciseId, patch),
    onSuccess: ({ count }) => {
      toast.success(`Visibilidade atualizada em ${count} caso(s)`);
      invalidateCases();
    },
    onError: () => toast.error("Não foi possível atualizar a visibilidade"),
  });

  const removeAllMutation = useMutation({
    mutationFn: () => removeAllExerciseCases(exerciseId),
    onSuccess: ({ count }) => {
      toast.success(`${count} caso(s) removido(s)`);
      setConfirmRemoveAll(false);
      invalidateCases();
    },
    onError: () => toast.error("Não foi possível remover os casos"),
  });

  if (notCompilable) {
    return <EmptyState title="Esse exercício não usa casos de teste" description="Tipo não compilável." />;
  }

  return (
    <div className="space-y-3 py-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={visibilityMutation.isPending}
          onClick={() =>
            visibilityMutation.mutate({ showInput: true, showExpectedOutput: true, showUserOutput: true })
          }
        >
          Mostrar tudo
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={visibilityMutation.isPending}
          onClick={() =>
            visibilityMutation.mutate({ showInput: false, showExpectedOutput: false, showUserOutput: false })
          }
        >
          Ocultar tudo
        </Button>
        {casesQuery.data && casesQuery.data.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveAll(true)}>
            Remover todos
          </Button>
        )}
        <Button variant="secondary" size="sm" asChild>
          <a href={exerciseCasesDownloadUrl(exerciseId)}>Baixar casos (.zip)</a>
        </Button>
        <BatchCaseDialog exerciseId={exerciseId} trigger={<Button variant="secondary" size="sm">Criar em lote</Button>} />
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

      <AlertDialog open={confirmRemoveAll} onOpenChange={setConfirmRemoveAll}>
        <AlertDialogContent open={confirmRemoveAll}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover todos os casos de teste?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga todos os {casesQuery.data?.length ?? 0} caso(s) de teste deste exercício. Submissões já
              corrigidas mantêm o resultado antigo, mas nada será recorrigido contra casos que não existem
              mais. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                removeAllMutation.mutate();
              }}
            >
              Remover todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
