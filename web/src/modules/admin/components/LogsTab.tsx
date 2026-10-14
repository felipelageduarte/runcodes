import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLogStats, listLogs, type LogRecord } from "@runcodes/api-client";
import { Button, cn, FormField, Input, StatCard, Table, type TableColumn } from "@runcodes/ui";
import { AlertTriangle, ChevronRight, ListTree, ScrollText } from "lucide-react";

const PAGE_SIZE = 50;

/** `action` is a free-text "METHOD /path -> STATUS" line (see
 * runcodes-api's auditLog middleware) — no separate columns, so the
 * expanded detail parses it back apart for readability. */
function parseAction(action: string): { method: string | null; path: string | null; status: number | null } {
  const match = /^(\S+)\s+(.*?)\s*->\s*(\d{3})$/.exec(action);
  if (!match) return { method: null, path: null, status: null };
  return { method: match[1], path: match[2], status: Number(match[3]) };
}

export function LogsTab() {
  const [userEmail, setUserEmail] = useState("");
  const [ip, setIp] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LogRecord[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filter = {
    userEmail: userEmail || undefined,
    ip: ip || undefined,
    q: q || undefined,
    status: status ? Number(status) : undefined,
  };
  const filterKey = JSON.stringify(filter);

  function updateFilter(apply: () => void) {
    apply();
    setPage(1);
    setExpandedId(null);
  }

  const query = useQuery({
    queryKey: ["admin-logs", filterKey, page],
    queryFn: () => listLogs({ ...filter, page, pageSize: PAGE_SIZE }),
  });
  const statsQuery = useQuery({ queryKey: ["admin-logs-stats", filterKey], queryFn: () => getLogStats(filter) });

  useEffect(() => {
    if (!query.data) return;
    setRows((prev) => (page === 1 ? query.data.logs : [...prev, ...query.data.logs]));
  }, [query.data, page]);

  const hasMore = query.data ? rows.length < query.data.total : false;

  const columns: TableColumn<LogRecord>[] = [
    {
      key: "expand",
      header: "",
      render: (log) => {
        const expanded = expandedId === log.id;
        return (
          <button
            type="button"
            aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"}
            onClick={() => setExpandedId(expanded ? null : log.id)}
          >
            <ChevronRight
              className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-90")}
            />
          </button>
        );
      },
    },
    {
      key: "datetime",
      header: "Quando",
      render: (log) => (
        <span className="whitespace-nowrap">{new Date(log.datetime).toLocaleString("pt-BR")}</span>
      ),
    },
    { key: "user", header: "Usuário", render: (log) => log.userEmail },
    {
      key: "action",
      header: "Ação",
      render: (log) => {
        const expanded = expandedId === log.id;
        const parsed = parseAction(log.action);
        return (
          <div className="space-y-2">
            <span className="font-mono text-xs">{log.action}</span>
            {expanded && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Método</dt>
                  <dd className="font-mono">{parsed.method ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Caminho</dt>
                  <dd className="font-mono">{parsed.path ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className={cn("font-mono", parsed.status && parsed.status >= 400 && "text-warning")}>
                    {parsed.status ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Timestamp (ISO)</dt>
                  <dd className="font-mono">{new Date(log.datetime).toISOString()}</dd>
                </div>
              </dl>
            )}
          </div>
        );
      },
    },
    { key: "ip", header: "IP", render: (log) => log.ip },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<ScrollText className="size-5" />}
          label="Eventos (filtro atual)"
          value={statsQuery.data?.total ?? "—"}
        />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="Erros (status ≥ 400)"
          value={statsQuery.data?.errors ?? "—"}
          color="warning"
        />
        <StatCard
          icon={<ListTree className="size-5" />}
          label="Ação mais frequente"
          value={statsQuery.data?.topAction ?? "—"}
          color="info"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[200px]">
          <FormField label="Email do usuário" htmlFor="log-email">
            <Input
              id="log-email"
              value={userEmail}
              onChange={(e) => updateFilter(() => setUserEmail(e.target.value))}
            />
          </FormField>
        </div>
        <div className="min-w-[160px]">
          <FormField label="IP" htmlFor="log-ip">
            <Input
              id="log-ip"
              value={ip}
              onChange={(e) => updateFilter(() => setIp(e.target.value))}
            />
          </FormField>
        </div>
        <div className="min-w-[200px]">
          <FormField label="Busca na ação" htmlFor="log-q">
            <Input
              id="log-q"
              placeholder="/api/enrollments"
              value={q}
              onChange={(e) => updateFilter(() => setQ(e.target.value))}
            />
          </FormField>
        </div>
        <div className="min-w-[140px]">
          <FormField label="Status" htmlFor="log-status">
            <select
              id="log-status"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => updateFilter(() => setStatus(e.target.value))}
            >
              <option value="">Todos</option>
              {[200, 201, 204, 400, 401, 403, 404, 409, 500].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {query.isLoading && rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(log) => log.id}
          density="compact"
          emptyTitle="Nenhum log encontrado"
        />
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" loading={query.isFetching} onClick={() => setPage((p) => p + 1)}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
