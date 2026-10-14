import { Clock } from "lucide-react";
import { useServerClock } from "@runcodes/shared";

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

/** Relógio do servidor na topbar — herança direta do "Server's Clock"
 * do run.codes original, referência oficial de deadline pros alunos.
 * Mono + tabular pra não "dançar" a cada segundo; ponto coral pulsando
 * sinaliza que está vivo e sincronizado. */
export function ServerClock() {
  const now = useServerClock();

  return (
    <div
      title="Horário do servidor — referência oficial para prazos de entrega"
      className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-clock-pulse rounded-full bg-accent" />
        <span className="relative inline-flex size-2 rounded-full bg-accent/40" />
      </span>
      <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
      {now ? (
        <span className="font-mono text-sm tabular-nums text-foreground">
          {TIME_FMT.format(now)}
          <span className="ml-2 hidden text-xs text-muted-foreground xl:inline">
            {DATE_FMT.format(now)}
          </span>
        </span>
      ) : (
        <span className="font-mono text-sm text-muted-foreground">--:--:--</span>
      )}
      <span className="sr-only">Horário do servidor</span>
    </div>
  );
}
