import { EmptyState } from "@runcodes/ui";
import { ShieldCheck } from "lucide-react";

// Universidades, allowed-files, usuários, logs — Fase 5
// (docs/frontend/roadmap.md). Fase 0 só estabelece a rota e o gate de
// papel (admin+).
export function AdminPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Admin</h1>
      <EmptyState
        icon={<ShieldCheck className="size-8" />}
        title="Painel administrativo em construção"
        description="Universidades, tipos de arquivo, usuários e logs chegam na Fase 5."
      />
    </div>
  );
}
