import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  exportSubmissionsZipUrl,
  getExerciseCaseStats,
  getParticipantCommits,
} from "@runcodes/api-client";
import { Button, EmptyState, FormField, Input, Skeleton, Table, type TableColumn } from "@runcodes/ui";

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

  const statsQuery = useQuery({
    queryKey: ["exercise", exerciseId, "stats"],
    queryFn: () => getExerciseCaseStats(exerciseId),
  });

  const commitsQuery = useQuery({
    queryKey: ["exercise", exerciseId, "participant-commits", lookupEmail],
    queryFn: () => getParticipantCommits(exerciseId, lookupEmail!),
    enabled: Boolean(lookupEmail),
  });

  const commitColumns: TableColumn<{ id: number; commitTime: string; status: number; corrects: number | null; score: string | null }>[] = [
    { key: "commitTime", header: "Quando", render: (r) => new Date(r.commitTime).toLocaleString("pt-BR") },
    { key: "status", header: "Status", render: (r) => statusLabels[r.status] ?? r.status },
    { key: "corrects", header: "Casos corretos", align: "center", render: (r) => r.corrects ?? "—" },
    { key: "score", header: "Nota", align: "right", render: (r) => r.score ?? "—" },
  ];

  return (
    <div className="space-y-8 py-4">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Acerto por caso de teste</h3>
          <a href={exportSubmissionsZipUrl(exerciseId)} className="text-sm font-medium text-primary-600 hover:underline">
            Exportar submissões (.zip)
          </a>
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
    </div>
  );
}
