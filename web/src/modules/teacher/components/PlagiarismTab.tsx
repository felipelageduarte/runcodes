import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPlagiarismRun,
  listPlagiarismRuns,
  requestPlagiarismRun,
  type PlagiarismProviderName,
  type PlagiarismRunRecord,
} from "@runcodes/api-client";
import { Badge, Button, EmptyState, Skeleton, Table, type TableColumn, toast } from "@runcodes/ui";

const statusVariant: Record<PlagiarismRunRecord["status"], "neutral" | "warning" | "success" | "danger"> = {
  queued: "neutral",
  running: "warning",
  completed: "success",
  failed: "danger",
};

const pairColumns: TableColumn<{ studentA: string; studentB: string; similarity: number }>[] = [
  { key: "studentA", header: "Aluno A", render: (r) => r.studentA },
  { key: "studentB", header: "Aluno B", render: (r) => r.studentB },
  {
    key: "similarity",
    header: "Similaridade",
    align: "right",
    render: (r) => `${(r.similarity * 100).toFixed(0)}%`,
  },
];

function RunRow({ run: initial }: { run: PlagiarismRunRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = initial.status === "queued" || initial.status === "running";

  const runQuery = useQuery({
    queryKey: ["plagiarism-run", initial.id],
    queryFn: () => getPlagiarismRun(initial.id),
    initialData: initial,
    enabled: isPending || expanded,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 3000 : false;
    },
  });

  const run = runQuery.data ?? initial;

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">{run.provider}</span>
          <Badge variant={statusVariant[run.status]}>{run.status}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(run.createdAt).toLocaleString("pt-BR")} · por {run.requestedBy}
          </span>
        </div>
        {run.status === "completed" && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Ocultar" : "Ver resultado"}
          </Button>
        )}
      </div>
      {run.status === "failed" && run.error && <p className="mt-2 text-xs text-danger">{run.error}</p>}
      {expanded && run.status === "completed" && (
        <div className="mt-3">
          <Table
            columns={pairColumns}
            rows={run.result ?? []}
            rowKey={(r) => `${r.studentA}-${r.studentB}`}
            density="compact"
            emptyTitle="Nenhum par suspeito encontrado"
          />
        </div>
      )}
    </li>
  );
}

export function PlagiarismTab({ exerciseId }: { exerciseId: number }) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<PlagiarismProviderName>("dolos");

  const runsQuery = useQuery({
    queryKey: ["exercise", exerciseId, "plagiarism-runs"],
    queryFn: () => listPlagiarismRuns(exerciseId),
  });

  const requestMutation = useMutation({
    mutationFn: () => requestPlagiarismRun(exerciseId, provider),
    onSuccess: () => {
      toast.success("Detecção de plágio enfileirada");
      queryClient.invalidateQueries({ queryKey: ["exercise", exerciseId, "plagiarism-runs"] });
    },
    onError: () => toast.error("Não foi possível solicitar a detecção"),
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-end justify-end gap-3">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value as PlagiarismProviderName)}
        >
          <option value="dolos">Dolos</option>
          <option value="jplag">JPlag</option>
        </select>
        <Button loading={requestMutation.isPending} onClick={() => requestMutation.mutate()}>
          Rodar detecção
        </Button>
      </div>

      {runsQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !runsQuery.data || runsQuery.data.length === 0 ? (
        <EmptyState title="Nenhuma detecção de plágio executada ainda" />
      ) : (
        <ul className="space-y-2">
          {runsQuery.data.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </div>
  );
}
