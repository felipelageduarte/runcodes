import { useQuery } from "@tanstack/react-query";
import { getDbHealth } from "@runcodes/api-client";
import { StatCard } from "@runcodes/ui";
import { Activity, Clock, Database, HardDrive } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}min`;
}

export function DbHealthPanel() {
  const query = useQuery({ queryKey: ["admin-db-health"], queryFn: getDbHealth, refetchInterval: 15_000 });
  const data = query.data;

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Activity className="size-5" />}
          label="Conexões ativas"
          value={data ? `${data.connections} / ${data.maxConnections}` : "—"}
        />
        <StatCard
          icon={<HardDrive className="size-5" />}
          label="Tamanho do banco"
          value={data ? formatBytes(data.databaseSizeBytes) : "—"}
          color="info"
        />
        <StatCard
          icon={<Clock className="size-5" />}
          label="Uptime do servidor"
          value={data ? formatUptime(data.uptimeSeconds) : "—"}
          color="success"
        />
        <StatCard
          icon={<Database className="size-5" />}
          label="Postgres"
          value="run.codes"
          color="purple"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Estado da conexão</th>
              <th className="px-3 py-2">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {(data?.connectionsByState ?? []).map((row) => (
              <tr key={row.state ?? "null"} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{row.state ?? "(sem estado)"}</td>
                <td className="px-3 py-2">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
