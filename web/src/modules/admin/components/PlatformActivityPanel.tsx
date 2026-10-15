import { useQuery } from "@tanstack/react-query";
import { getPlatformActivity } from "@runcodes/api-client";
import { Skeleton, StatCard } from "@runcodes/ui";
import { Activity, CalendarDays, TrendingUp } from "lucide-react";

/** Volume de submissões da plataforma inteira — gap achado na auditoria
 * de paridade de out/2026 (item 20): os stats novos só existiam por
 * turma/exercício, sem visão agregada pro admin. */
export function PlatformActivityPanel() {
  const query = useQuery({ queryKey: ["admin-activity"], queryFn: getPlatformActivity });

  if (query.isLoading) {
    return (
      <div className="mb-6 space-y-3">
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!query.data) return null;

  const maxTotal = Math.max(1, ...query.data.dailyTrend.map((d) => d.total));

  return (
    <div className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Activity />}
          label="Hoje"
          value={query.data.today}
          color="slate"
          variant="filled"
        />
        <StatCard
          icon={<CalendarDays />}
          label="Ontem"
          value={query.data.yesterday}
          color="primary"
          variant="filled"
        />
        <StatCard
          icon={<TrendingUp />}
          label="Últimos 7 dias"
          value={query.data.last7Days}
          color="accent"
          variant="filled"
        />
      </div>
      <div className="flex h-16 items-end gap-0.5 rounded-lg border border-border bg-card p-3">
        {query.data.dailyTrend.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.total} submissão(ões)`}
            className="flex-1 rounded-sm bg-primary-500"
            style={{ height: `${Math.max(4, (d.total / maxTotal) * 100)}%` }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Submissões por dia, últimos 28 dias.</p>
    </div>
  );
}
