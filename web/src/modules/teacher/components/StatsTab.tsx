import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  exportSubmissionsZipUrl,
  getExerciseCaseStats,
  getExerciseCasesTable,
  getParticipantCommits,
  recompileAllCommits,
  recompileCommit,
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
  FormField,
  Input,
  Skeleton,
  Table,
  toast,
  type TableColumn,
} from "@runcodes/ui";
import { EditScoreDialog } from "./EditScoreDialog";

// Mirrors runcodes-api's CommitStatus (src/lib/constants.ts).
const statusLabels: Record<number, string> = {
  0: "Na fila",
  1: "Compilando",
  2: "Compilado",
  3: "Rodando",
  4: "Incompleto",
  5: "Completo",
  6: "Erro",
  7: "Enviado (correção manual)",
  8: "Plágio",
  9: "Erro no servidor",
};

export function StatsTab({ exerciseId }: { exerciseId: number }) {
  const [participantEmail, setParticipantEmail] = useState("");
  const [lookupEmail, setLookupEmail] = useState<string | null>(null);
  const [confirmRecompileAll, setConfirmRecompileAll] = useState(false);
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["exercise", exerciseId, "stats"],
    queryFn: () => getExerciseCaseStats(exerciseId),
  });

  const casesTableQuery = useQuery({
    queryKey: ["exercise", exerciseId, "cases-table"],
    queryFn: () => getExerciseCasesTable(exerciseId),
  });

  const commitsQuery = useQuery({
    queryKey: ["exercise", exerciseId, "participant-commits", lookupEmail],
    queryFn: () => getParticipantCommits(exerciseId, lookupEmail!),
    enabled: Boolean(lookupEmail),
  });

  const invalidateAfterRecompile = () => {
    queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId] });
  };

  const recompileOneMutation = useMutation({
    mutationFn: (commitId: number) => recompileCommit(commitId),
    onSuccess: () => {
      toast.success("Commit reenfileirado pra recompilação");
      invalidateAfterRecompile();
    },
    onError: () => toast.error("Não foi possível recompilar — o commit já pode estar em processamento"),
  });

  const recompileAllMutation = useMutation({
    mutationFn: () => recompileAllCommits(exerciseId),
    onSuccess: ({ count }) => {
      toast.success(`${count} commit(s) reenfileirado(s) pra recompilação`);
      setConfirmRecompileAll(false);
      invalidateAfterRecompile();
    },
    onError: () => toast.error("Não foi possível recompilar — algum commit já pode estar em processamento"),
  });

  const commitColumns: TableColumn<{ id: number; commitTime: string; status: number; corrects: number | null; score: string | null }>[] = [
    { key: "commitTime", header: "Quando", render: (r) => new Date(r.commitTime).toLocaleString("pt-BR") },
    { key: "status", header: "Status", render: (r) => statusLabels[r.status] ?? r.status },
    { key: "corrects", header: "Casos corretos", align: "center", render: (r) => r.corrects ?? "—" },
    { key: "score", header: "Nota", align: "right", render: (r) => r.score ?? "—" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <EditScoreDialog
            commitId={r.id}
            currentScore={r.score}
            currentStatus={r.status}
            exerciseId={exerciseId}
            trigger={
              <Button variant="ghost" size="sm">
                Editar nota
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            loading={recompileOneMutation.isPending}
            onClick={() => recompileOneMutation.mutate(r.id)}
          >
            Recompilar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 py-4">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Acerto por caso de teste</h3>
          <div className="flex items-center gap-4">
            <a href={exportSubmissionsZipUrl(exerciseId)} className="text-sm font-medium text-primary-600 hover:underline">
              Exportar submissões (.zip)
            </a>
            <Button variant="secondary" size="sm" onClick={() => setConfirmRecompileAll(true)}>
              Recompilar todos
            </Button>
          </div>
        </div>
        {statsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !statsQuery.data || statsQuery.data.caseLabels.length === 0 ? (
          <EmptyState title="Nenhum dado de acerto ainda" />
        ) : (
          <div className="space-y-2">
            {statsQuery.data.caseLabels.map((label, i) => {
              const pct = statsQuery.data!.correctPercentage[i] ?? 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Quem passou em qual caso</h3>
        {casesTableQuery.data?.hasUnsafeCommits && (
          <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Algum caso de teste foi alterado depois que pelo menos um aluno já submeteu — a nota dele pode não
            refletir a régua atual. Considere recompilar.
          </div>
        )}
        {casesTableQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !casesTableQuery.data || casesTableQuery.data.rows.length === 0 ? (
          <EmptyState title="Ninguém submeteu ainda" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4">Aluno</th>
                  {casesTableQuery.data.caseLabels.map((label) => (
                    <th key={label} className="px-2 py-2 text-center">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {casesTableQuery.data.rows.map((row) => (
                  <tr key={row.email} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">{row.name}</td>
                    {row.results.map((passed, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        {passed === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant={passed ? "success" : "danger"}>{passed ? "OK" : "✕"}</Badge>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Histórico de um aluno</h3>
        <form
          className="mb-3 flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setLookupEmail(participantEmail);
          }}
        >
          <div className="min-w-[260px]">
            <FormField label="Email do aluno" htmlFor="participant-email">
              <Input
                id="participant-email"
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
              />
            </FormField>
          </div>
          <Button type="submit">Buscar</Button>
        </form>

        {lookupEmail && (
          <Table
            columns={commitColumns}
            rows={commitsQuery.data ?? []}
            rowKey={(r) => r.id}
            density="compact"
            emptyTitle={commitsQuery.isLoading ? "Carregando..." : "Nenhuma submissão desse aluno"}
          />
        )}
      </div>

      <AlertDialog open={confirmRecompileAll} onOpenChange={setConfirmRecompileAll}>
        <AlertDialogContent open={confirmRecompileAll}>
          <AlertDialogHeader>
            <AlertDialogTitle>Recompilar todos os commits?</AlertDialogTitle>
            <AlertDialogDescription>
              Reenfileira o commit mais recente de cada aluno pra ser corrigido de novo pelo corretor — útil
              depois de uma correção no corretor ou nos casos de teste. Pode levar alguns minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                recompileAllMutation.mutate();
              }}
            >
              Recompilar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
