import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ApiError, DEFAULT_STUCK_MINUTES, getAdminOverview, type AdminOverview } from "@runcodes/api-client";
import { userTypeLabel } from "@runcodes/shared";
import { Badge, Button, EmptyState, SectionHeader, Skeleton, StatCard } from "@runcodes/ui";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Database,
  LifeBuoy,
  ListOrdered,
  Megaphone,
  RefreshCw,
  ServerCrash,
  Users,
} from "lucide-react";
import { DbHealthPanel } from "./DbHealthPanel";
import { PlatformActivityPanel } from "./PlatformActivityPanel";

/** Janelas oferecidas pro contador de commits presos — o backend aceita
 * 1 a 1440; estes são os que fazem sentido operacionalmente (o
 * compilador tem timeout por caso na casa de segundos). */
const STUCK_WINDOWS = [5, 15, 30, 60] as const;
const REFETCH_MS = 30_000;

function errorMessage(error: unknown): { title: string; description: string } {
  if (error instanceof ApiError && error.status === 403) {
    return { title: "Sem permissão", description: "Só administradores veem o painel." };
  }
  return {
    title: "Não foi possível carregar o painel",
    description: "A API não respondeu. Tente de novo em alguns segundos.",
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4 py-4" aria-busy="true" aria-label="Carregando painel">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function UsersByType({ data }: { data: AdminOverview }) {
  const total = data.usersByType.reduce((sum, u) => sum + u.count, 0);

  return (
    <section aria-label="Usuários e suporte" className="space-y-3">
      <SectionHeader title="Usuários" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={<Users className="size-5" />} label="Contas" value={total} color="slate" />
        <StatCard
          icon={<LifeBuoy className="size-5" />}
          label="Tickets abertos"
          value={data.ticketsOpen}
          color={data.ticketsOpen > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={<Megaphone className="size-5" />}
          label="Avisos ativos"
          value={data.alertsActive}
          color="info"
        />
      </div>
      {data.usersByType.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="Nenhum usuário cadastrado"
          description="Os contadores por tipo aparecem assim que a primeira conta for criada."
        />
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Usuários por tipo">
          {data.usersByType.map((u) => (
            <li key={u.type}>
              <Badge variant={u.type >= 3 ? "primary" : "neutral"}>
                {userTypeLabel(u.type)}: <span className="tabular-nums">{u.count}</span>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/tickets">Ver fila de tickets</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/avisos">Gerenciar avisos</Link>
        </Button>
      </div>
    </section>
  );
}

function PipelineKpis({
  data,
  stuckMinutes,
  onStuckMinutesChange,
}: {
  data: AdminOverview;
  stuckMinutes: number;
  onStuckMinutesChange: (minutes: number) => void;
}) {
  const calm = data.commitsQueued === 0 && data.commitsStuck === 0 && data.serverErrors24h === 0;

  return (
    <section aria-label="Correção" className="space-y-3">
      <SectionHeader
        title="Correção"
        actions={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Preso há mais de
            <select
              aria-label="Janela de commit preso"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={stuckMinutes}
              onChange={(e) => onStuckMinutesChange(Number(e.target.value))}
            >
              {STUCK_WINDOWS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ListOrdered className="size-5" />} label="Na fila" value={data.commitsQueued} color="info" />
        <StatCard
          icon={<Clock className="size-5" />}
          label={`Presos (> ${data.stuckMinutes} min)`}
          value={data.commitsStuck}
          color={data.commitsStuck > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={<Bug className="size-5" />}
          label="Erros de compilação (24 h)"
          value={data.compilationErrors24h}
          color="slate"
        />
        <StatCard
          icon={<ServerCrash className="size-5" />}
          label="Erros do servidor (24 h)"
          value={data.serverErrors24h}
          color={data.serverErrors24h > 0 ? "warning" : "success"}
        />
      </div>
      {calm ? (
        <p className="flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="size-4" aria-hidden />
          Pipeline em dia: nada na fila, nenhum commit preso, sem erro do servidor hoje.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Detalhe por commit em{" "}
          <Link to="/admin/pipeline" className="underline underline-offset-2">
            Pipeline
          </Link>
          . Erro de compilação é do código do aluno; erro do servidor é do pipeline.
        </p>
      )}
    </section>
  );
}

function DatabaseSection({ data }: { data: AdminOverview }) {
  return (
    <section aria-label="Banco de dados" className="space-y-1">
      <SectionHeader title="Banco de dados" />
      {data.database.ok ? (
        <DbHealthPanel health={data.database.health} />
      ) : (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-medium">Saúde do banco indisponível</p>
            <p className="text-muted-foreground">
              Os contadores acima vieram normalmente; só a leitura de <code>pg_stat_activity</code> falhou:{" "}
              {data.database.error}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/** Home de /admin (spec admin-e-separacao-front, F4): o que um operador
 * precisa ver antes de clicar em qualquer aba — fila de correção,
 * commit preso, erros do dia, tickets, avisos, saúde do banco. Tudo de
 * um endpoint agregado com cache de 30 s; o refetch acompanha o TTL. */
export function OverviewTab() {
  const [stuckMinutes, setStuckMinutes] = useState<number>(DEFAULT_STUCK_MINUTES);
  const query = useQuery({
    queryKey: ["admin-overview", stuckMinutes],
    queryFn: () => getAdminOverview(stuckMinutes),
    refetchInterval: REFETCH_MS,
  });

  if (query.isLoading) return <OverviewSkeleton />;

  if (query.isError || !query.data) {
    const { title, description } = errorMessage(query.error);
    return (
      <EmptyState
        icon={<Database className="size-6" />}
        title={title}
        description={description}
        action={
          <Button variant="secondary" size="sm" onClick={() => query.refetch()} loading={query.isFetching}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const data = query.data;

  return (
    <div className="space-y-8 py-4">
      <PipelineKpis data={data} stuckMinutes={stuckMinutes} onStuckMinutesChange={setStuckMinutes} />
      <UsersByType data={data} />

      <section aria-label="Submissões" className="space-y-1">
        <SectionHeader title="Submissões" />
        <PlatformActivityPanel />
      </section>

      <DatabaseSection data={data} />

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          Atualizado às {formatTime(data.generatedAt)} · o servidor guarda estes números por 30 s.
        </span>
        <Button variant="ghost" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} aria-hidden />
          Atualizar
        </Button>
      </footer>
    </div>
  );
}
