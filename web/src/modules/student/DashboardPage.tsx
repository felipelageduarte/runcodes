import { useSession } from "@runcodes/auth";
import { EmptyState } from "@runcodes/ui";
import { LayoutDashboard } from "lucide-react";

// Fila de trabalho do aluno — conteúdo real na Fase 1
// (docs/frontend/roadmap.md). Fase 0 só estabelece a rota protegida.
export function DashboardPage() {
  const { user } = useSession();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Olá, {user?.name}</h1>
      <EmptyState
        icon={<LayoutDashboard className="size-8" />}
        title="Painel em construção"
        description="A fila de exercícios por turma chega na Fase 1 do roadmap."
      />
    </div>
  );
}
