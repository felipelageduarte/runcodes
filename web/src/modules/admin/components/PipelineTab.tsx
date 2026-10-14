import { useQuery } from "@tanstack/react-query";
import { getPipelineStats, listActiveCommits } from "@runcodes/api-client";
import { Badge, StatCard } from "@runcodes/ui";
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
        Lê o mesmo status que o compiler-engine atualiza em tempo real — atualiza a cada {POLL_MS / 1000}s.
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

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Exercício</th>
              <th className="px-3 py-2">Na fila há</th>
            </tr>
          </thead>
          <tbody>
            {(activeQuery.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  {activeQuery.isLoading ? "Carregando..." : "Nada em processamento agora"}
                </td>
              </tr>
            )}
            {(activeQuery.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Badge variant={c.status === CommitStatus.IN_QUEUE ? "neutral" : "info"}>
                    {commitStatusLabel(c.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2">{c.userEmail}</td>
                <td className="px-3 py-2">{c.exerciseTitle}</td>
                <td className="px-3 py-2 font-mono text-xs">{elapsed(c.commitTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
