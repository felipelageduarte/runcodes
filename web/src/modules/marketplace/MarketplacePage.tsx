import { EmptyState } from "@runcodes/ui";
import { Store } from "lucide-react";

// Descoberta/adoção de exercícios entre professores — Fase 4
// (docs/frontend/marketplace.md). Fase 0 só estabelece a rota e o gate
// de papel (professor+).
export function MarketplacePage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Marketplace</h1>
      <EmptyState
        icon={<Store className="size-8" />}
        title="Marketplace em construção"
        description="Busca, filtro e adoção de exercícios entre professores chegam na Fase 4."
      />
    </div>
  );
}
