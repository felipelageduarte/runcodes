import { motion } from "motion/react";
import { Eye } from "lucide-react";
import { useSession, useStopViewAs } from "@runcodes/auth";
import { userTypeLabel } from "@runcodes/shared";

/** Indicador permanente enquanto "vendo como" um papel rebaixado —
 * requisito explícito do gap de view-as (docs/frontend/journeys.md):
 * sempre visível, nunca algo que dá pra esquecer que está ativo. */
export function ViewAsBar() {
  const { user } = useSession();
  const stopViewAs = useStopViewAs();

  if (!user?.viewAs?.active) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      className="flex items-center justify-center gap-3 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground"
    >
      <Eye className="size-4" />
      <span>
        Vendo como <strong>{userTypeLabel(user.type)}</strong> — seu papel real é{" "}
        <strong>{userTypeLabel(user.viewAs.realType)}</strong>
      </span>
      <button
        type="button"
        onClick={() => stopViewAs.mutate()}
        disabled={stopViewAs.isPending}
        className="rounded-md bg-warning-foreground/10 px-2 py-0.5 text-xs font-semibold hover:bg-warning-foreground/20 disabled:opacity-50"
      >
        Voltar ao normal
      </button>
    </motion.div>
  );
}
