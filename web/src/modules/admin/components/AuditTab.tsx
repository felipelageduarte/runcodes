import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  AUDIT_FEED_PAGE_SIZE,
  getAuditStats,
  listAuditFeed,
  type AuditFeedFilter,
  type AuditRecord,
} from "@runcodes/api-client";
import { Button, cn, FormField, Input, StatCard } from "@runcodes/ui";
import { Activity, AlertTriangle, ChevronRight, Timer, Users } from "lucide-react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const STATUSES = [200, 201, 204, 400, 401, 403, 404, 409, 500];
const DAYS_OPTIONS = [1, 7, 30, 90];
const TYPE_LABEL: Record<number, string> = {
  0: "Aluno",
  1: "Monitor",
  2: "Professor",
  3: "Admin",
  4: "Dev",
};

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

function statusTone(status: number): string {
  if (status >= 500) return "bg-destructive/15 text-destructive";
  if (status >= 400) return "bg-warning/20 text-warning";
  return "bg-success/15 text-success";
}

function methodTone(method: string): string {
  switch (method) {
    case "DELETE":
      return "text-destructive";
    case "POST":
    case "PUT":
    case "PATCH":
      return "text-info";
    default:
      return "text-muted-foreground";
  }
}

/** `datetime-local` entrega hora local sem fuso; a API compara em UTC. */
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function AuditTab() {
  const [actor, setActor] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [route, setRoute] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [q, setQ] = useState("");
  const [days, setDays] = useState(7);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filter: AuditFeedFilter = useMemo(
    () => ({
      actor: actor.trim() || undefined,
      method: method || undefined,
      status: status ? Number(status) : undefined,
      route: route.trim() || undefined,
      since: toIso(since),
      until: toIso(until),
      q: q.trim() || undefined,
    }),
    [actor, method, status, route, since, until, q],
  );

  const feed = useInfiniteQuery({
    queryKey: ["admin-audit-feed", filter],
    queryFn: ({ pageParam }) => listAuditFeed({ ...filter, limit: AUDIT_FEED_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return next < last.total && last.items.length > 0 ? next : undefined;
    },
  });
  const stats = useQuery({ queryKey: ["admin-audit-stats", days], queryFn: () => getAuditStats(days) });

  const rows: AuditRecord[] = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const total = feed.data?.pages[0]?.total ?? 0;
  const maxDaily = Math.max(1, ...(stats.data?.daily.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-6 py-4">
      <section aria-labelledby="audit-stats-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="audit-stats-title" className="text-sm font-medium text-muted-foreground">
            Resumo do período
          </h2>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Período
            <select
              aria-label="Período das estatísticas"
              className={cn(selectClass, "w-auto")}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? "24 horas" : `${d} dias`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Activity className="size-5" />} label="Requisições" value={stats.data?.total ?? "—"} />
          <StatCard
            icon={<AlertTriangle className="size-5" />}
            label="Erros (status ≥ 400)"
            value={stats.data?.errors ?? "—"}
            color="warning"
          />
          <StatCard
            icon={<Timer className="size-5" />}
            label="Duração média (ms)"
            value={stats.data?.avgDurationMs ?? "—"}
            color="info"
          />
          <StatCard icon={<Users className="size-5" />} label="Atores distintos" value={stats.data?.actors ?? "—"} color="purple" />
        </div>

        {stats.data && (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-1">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Por dia</h3>
              {stats.data.daily.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem registros no período.</p>
              ) : (
                <ol className="flex h-28 items-end gap-1" aria-label="Requisições por dia">
                  {stats.data.daily.map((d) => (
                    <li
                      key={d.day}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                      title={`${d.day}: ${d.count} requisições, ${d.errors} erros`}
                    >
                      <div
                        className="w-full rounded-t bg-primary-300"
                        style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                      >
                        {d.errors > 0 && (
                          <div
                            className="w-full rounded-t bg-warning"
                            style={{ height: `${Math.min(100, (d.errors / d.count) * 100)}%` }}
                          />
                        )}
                      </div>
                      <span className="sr-only">
                        {d.day}: {d.count} requisições, {d.errors} erros
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top ações</h3>
              <ol className="space-y-1.5 text-sm">
                {stats.data.topActions.slice(0, 8).map((a) => (
                  <li key={a.action} className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 truncate text-left font-mono text-xs hover:text-primary-600 hover:underline"
                      title={`Filtrar por ${a.action}`}
                      onClick={() => {
                        const [m, ...rest] = a.action.split(" ");
                        setMethod(m);
                        setRoute(rest.join(" "));
                        setExpandedId(null);
                      }}
                    >
                      {a.action}
                    </button>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {a.count} <span className="text-xs">· {a.avgMs} ms</span>
                    </span>
                  </li>
                ))}
                {stats.data.topActions.length === 0 && <li className="text-muted-foreground">—</li>}
              </ol>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top usuários</h3>
              <ol className="space-y-1.5 text-sm">
                {stats.data.topActors.slice(0, 8).map((u) => (
                  <li key={u.actorEmail} className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 truncate text-left hover:text-primary-600 hover:underline"
                      title={`Filtrar por ${u.actorEmail}`}
                      onClick={() => {
                        setActor(u.actorEmail);
                        setExpandedId(null);
                      }}
                    >
                      {u.actorEmail}
                    </button>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{u.count}</span>
                  </li>
                ))}
                {stats.data.topActors.length === 0 && <li className="text-muted-foreground">—</li>}
              </ol>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="audit-feed-title" className="space-y-3">
        <h2 id="audit-feed-title" className="text-sm font-medium text-muted-foreground">
          Feed
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Ator (e-mail)" htmlFor="audit-actor">
            <Input id="audit-actor" value={actor} onChange={(e) => setActor(e.target.value)} />
          </FormField>
          <FormField label="Método" htmlFor="audit-method">
            <select id="audit-method" className={selectClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">Todos</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status" htmlFor="audit-status">
            <select id="audit-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUSES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Rota" htmlFor="audit-route">
            <Input id="audit-route" placeholder="/api/admin/users/:email" value={route} onChange={(e) => setRoute(e.target.value)} />
          </FormField>
          <FormField label="De" htmlFor="audit-since">
            <Input id="audit-since" type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} />
          </FormField>
          <FormField label="Até" htmlFor="audit-until">
            <Input id="audit-until" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Texto (rota, IP, request id, user-agent)" htmlFor="audit-q">
              <Input id="audit-q" value={q} onChange={(e) => setQ(e.target.value)} />
            </FormField>
          </div>
        </div>

        {feed.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : feed.isError ? (
          <p role="alert" className="py-6 text-center text-sm text-destructive">
            Não foi possível carregar a auditoria.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registro encontrado</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((r) => (
              <AuditRow
                key={r.id}
                record={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              />
            ))}
          </ul>
        )}

        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {rows.length} de {total}
          </p>
          {feed.hasNextPage && (
            <Button
              variant="secondary"
              size="sm"
              loading={feed.isFetchingNextPage}
              onClick={() => feed.fetchNextPage()}
            >
              Carregar mais
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function AuditRow({ record, expanded, onToggle }: { record: AuditRecord; expanded: boolean; onToggle: () => void }) {
  const when = new Date(record.at);
  return (
    <li className="px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"}
          className="mt-0.5 shrink-0 rounded hover:bg-muted"
          onClick={onToggle}
        >
          <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("rounded px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums", statusTone(record.status))}>
              {record.status}
            </span>
            <span className={cn("font-mono text-xs font-semibold", methodTone(record.method))}>{record.method}</span>
            <span className="min-w-0 truncate font-mono text-xs" title={record.path}>
              {record.route}
            </span>
            {record.durationMs !== null && (
              <span className="text-xs tabular-nums text-muted-foreground">{record.durationMs} ms</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <time dateTime={record.at}>{when.toLocaleString("pt-BR")}</time>
            <span className="truncate text-foreground">{record.actorEmail ?? "anônimo"}</span>
            {record.actorType !== null && <span>{TYPE_LABEL[record.actorType] ?? record.actorType}</span>}
            {record.viewAsType !== null && (
              <span className="rounded bg-accent/15 px-1 text-accent">
                vendo como {TYPE_LABEL[record.viewAsType] ?? record.viewAsType}
              </span>
            )}
          </div>
          {expanded && (
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Detail label="Caminho" value={record.path} mono />
              <Detail label="IP" value={record.ip ?? "—"} mono />
              <Detail label="Request id" value={record.requestId ?? "—"} mono />
              <Detail label="Timestamp (ISO)" value={record.at} mono />
              <div className="sm:col-span-2">
                <Detail label="User-agent" value={record.userAgent ?? "—"} />
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Corpo (redigido)</dt>
                <dd>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-snug">
                    {record.requestBody === null || record.requestBody === undefined
                      ? "—"
                      : JSON.stringify(record.requestBody, null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </li>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("break-all", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
