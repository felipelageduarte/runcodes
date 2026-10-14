import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, getDbSchema, runDbQuery, type QueryResult } from "@runcodes/api-client";
import { Button, Table, type TableColumn, Textarea, toast } from "@runcodes/ui";
import { AlertTriangle } from "lucide-react";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type ResultRow = Record<string, unknown> & { __i: number };

export function SqlConsole() {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const schemaQuery = useQuery({ queryKey: ["admin-db-schema"], queryFn: getDbSchema });

  const mutation = useMutation({
    mutationFn: (confirm: boolean) => runDbQuery(sql, confirm),
    onSuccess: (data) => {
      setResult(data);
      setNeedsConfirm(false);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === "requires_confirmation") {
        setNeedsConfirm(true);
        return;
      }
      setNeedsConfirm(false);
      toast.error(err instanceof ApiError ? `Erro: ${err.message}` : "Erro ao executar query");
    },
  });

  function run(confirm: boolean) {
    if (!sql.trim()) return;
    setResult(null);
    mutation.mutate(confirm);
  }

  const resultColumns: TableColumn<ResultRow>[] =
    result?.kind === "rows"
      ? result.columns.map((c) => ({
          key: c,
          header: c.toUpperCase(),
          render: (row: ResultRow) => (
            <span className="whitespace-nowrap font-mono text-xs">{formatCell(row[c])}</span>
          ),
        }))
      : [];
  const resultRows: ResultRow[] =
    result?.kind === "rows" ? result.rows.map((row, i) => ({ ...row, __i: i })) : [];

  return (
    <div className="grid grid-cols-1 gap-4 py-4 lg:grid-cols-[220px_1fr]">
      <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border">
        <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
          Tabelas
        </div>
        {(schemaQuery.data?.tables ?? []).map((t) => (
          <button
            key={t.name}
            type="button"
            className="flex w-full items-center justify-between border-b border-border/50 px-3 py-1.5 text-left text-sm hover:bg-muted/50"
            onClick={() => setSql(`SELECT * FROM ${t.name} LIMIT 100;`)}
          >
            <span className="font-mono text-xs">{t.name}</span>
            <span className="text-xs text-muted-foreground">{t.rowEstimate}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-3">
        <Textarea
          value={sql}
          onChange={(e) => {
            setSql(e.target.value);
            setNeedsConfirm(false);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(false);
          }}
          placeholder="SELECT * FROM users LIMIT 10;"
          className="min-h-40 font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => run(false)} loading={mutation.isPending && !needsConfirm}>
            Executar (⌘/Ctrl+Enter)
          </Button>
          {needsConfirm && (
            <Button type="button" variant="destructive" onClick={() => run(true)} loading={mutation.isPending}>
              Confirmar e executar
            </Button>
          )}
        </div>

        {needsConfirm && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Esse comando altera dados (INSERT/UPDATE/DELETE/DDL). Confirme pra executar mesmo assim.</p>
          </div>
        )}

        {result?.kind === "mutation" && (
          <p className="text-sm text-muted-foreground">{result.rowsAffected} linha(s) afetada(s).</p>
        )}

        {result?.kind === "rows" && (
          <Table
            columns={resultColumns}
            rows={resultRows}
            rowKey={(row) => row.__i}
            density="compact"
            emptyTitle="Consulta sem resultados"
          />
        )}
      </div>
    </div>
  );
}
