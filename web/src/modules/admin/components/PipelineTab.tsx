import { useQuery } from "@tanstack/react-query";
import { type ActiveCommit, getPipelineStats, listActiveCommits } from "@runcodes/api-client";
import { Badge, StatCard, Table, type TableColumn } from "@runcodes/ui";
import { CommitStatus, commitStatusLabel, isCommitError } from "@runcodes/shared";
import { AlertCircle, Clock, Cpu, PlayCircle } from "lucide-react";

const POLL_MS = 4000;

function countFor(counts: { status: number; count: number }[], status: number): number {
  return counts.find((c) => c.status === status)?.count ?? 0;
}

function elapsed(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

const columns: TableColumn<ActiveCommit>[] = [
  {
    key: "status",
    header: "Status",
    render: (c) => (
      <Badge variant={c.status === CommitStatus.IN_QUEUE ? "neutral" : "info"}>
        {commitStatusLabel(c.status)}
      </Badge>
    ),
  },
  { key: "user", header: "Usuário", render: (c) => c.userEmail },
  { key: "exercise", header: "Exercício", render: (c) => c.exerciseTitle },
  {
    key: "elapsed",
    header: "Na fila há",
    render: (c) => <span className="font-mono text-xs">{elapsed(c.commitTime)}</span>,
  },
];

export function PipelineTab() {
  const statsQuery = useQuery({
    queryKey: ["admin-pipeline-stats"],
    queryFn: getPipelineStats,
    refetchInterval: POLL_MS,
  });
  const activeQuery = useQuery({
    queryKey: ["admin-pipeline-active"],
    queryFn: () => listActiveCommits(50),
    refetchInterval: POLL_MS,
  });

  const inFlight = statsQuery.data?.inFlight ?? [];
  const recentHour = statsQuery.data?.recentHour ?? [];
  const recentErrors = recentHour.filter((c) => isCommitError(c.status)).reduce((sum, c) => sum + c.count, 0);
  const recentTotal = recentHour.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-4 py-4">
      <p className="text-xs text-muted-foreground">
        Lê o mesmo status que o runcodes-compiler atualiza em tempo real — atualiza a cada {POLL_MS / 1000}s.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Clock className="size-5" />}
          label="Na fila"
          value={countFor(inFlight, CommitStatus.IN_QUEUE)}
        />
        <StatCard
          icon={<Cpu className="size-5" />}
          label="Compilando"
          value={countFor(inFlight, CommitStatus.COMPILING)}
          color="info"
        />
        <StatCard
          icon={<PlayCircle className="size-5" />}
          label="Executando"
          value={countFor(inFlight, CommitStatus.RUNNING)}
          color="purple"
        />
        <StatCard
          icon={<AlertCircle className="size-5" />}
          label={`Erros (última hora, ${recentTotal} total)`}
          value={recentErrors}
          color="warning"
        />
      </div>

      {activeQuery.isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <Table
          columns={columns}
          rows={activeQuery.data ?? []}
          rowKey={(c) => c.id}
          density="compact"
          emptyTitle="Nada em processamento agora"
        />
      )}
    </div>
  );
}
