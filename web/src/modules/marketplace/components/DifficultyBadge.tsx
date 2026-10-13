import { Badge } from "@runcodes/ui";
import type { DifficultyBucket } from "@runcodes/api-client";

const labels: Record<DifficultyBucket, string> = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const variants: Record<DifficultyBucket, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

export function DifficultyBadge({ bucket }: { bucket: DifficultyBucket | null }) {
  if (!bucket) return <Badge variant="neutral">Sem dados</Badge>;
  return <Badge variant={variants[bucket]}>{labels[bucket]}</Badge>;
}
