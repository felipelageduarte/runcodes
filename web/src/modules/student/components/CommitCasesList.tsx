import { CheckCircle2, XCircle } from "lucide-react";
import type { CommitCaseResult } from "@runcodes/api-client";

export function CommitCasesList({ cases }: { cases: CommitCaseResult[] }) {
  if (cases.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">Nenhum resultado por caso ainda.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {cases.map((c, i) => (
        <li key={c.id} className="p-3 text-sm">
          <div className="flex items-center gap-2">
            {c.status ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <XCircle className="size-4 shrink-0 text-danger" />
            )}
            <span className="font-medium text-foreground">Caso {i + 1}</span>
            <span className="text-xs text-muted-foreground">{c.cputime}s</span>
          </div>
          {c.error && <p className="mt-1 whitespace-pre-wrap text-xs text-danger">{c.error}</p>}
          {c.expectedInput !== null && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
              <span className="text-muted-foreground">Entrada: </span>
              {c.expectedInput}
            </pre>
          )}
          {c.expectedOutput !== null && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
              <span className="text-muted-foreground">Esperado: </span>
              {c.expectedOutput}
            </pre>
          )}
          {c.output !== null && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
              <span className="text-muted-foreground">Sua saída: </span>
              {c.output}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}
