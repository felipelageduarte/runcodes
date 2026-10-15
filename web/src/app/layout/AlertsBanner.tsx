import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Megaphone, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listActiveAlerts, type AlertRecord } from "@runcodes/api-client";
import { useSession } from "@runcodes/auth";
import { UserType } from "@runcodes/shared";

const DISMISSED_KEY = "runcodes:dismissed-alerts";

function readDismissed(): number[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: number[]): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // localStorage indisponível (modo privado etc.) — dismiss não persiste, tudo bem.
  }
}

// Alinhado com AlertFormDialog (support/components/AlertFormDialog.tsx).
const typeStyles: Record<number, string> = {
  0: "bg-info/15 text-info-foreground",
  1: "bg-warning/90 text-warning-foreground",
  2: "bg-danger text-danger-foreground",
  3: "bg-muted text-foreground",
};

function isForUser(alert: AlertRecord, userType: number): boolean {
  if (alert.recipients === 1) return userType < UserType.PROFESSOR; // "Alunos"
  if (alert.recipients === 2) return userType >= UserType.ASSISTANT; // "Professores" (staff)
  return true; // "Todos"
}

/** Avisos ativos visíveis pra qualquer usuário autenticado — o backend
 * já suportava isso (`GET /alerts`), mas nenhuma tela consumia fora da
 * aba de gestão de staff, então o aluno nunca via um aviso publicado.
 * Ver docs/roadmap/gap-audit-2026-10.md item 8. */
export function AlertsBanner() {
  const { user } = useSession();
  const [dismissed, setDismissed] = useState<number[]>([]);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const query = useQuery({
    queryKey: ["alerts", "active"],
    queryFn: () => listActiveAlerts(),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  if (!user || !query.data) return null;

  const visible = query.data.filter((a) => isForUser(a, user.type) && !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const dismiss = (id: number) => {
    const next = [...dismissed, id];
    setDismissed(next);
    writeDismissed(next);
  };

  return (
    <div className="flex flex-col gap-px">
      <AnimatePresence initial={false}>
        {visible.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`flex items-start gap-3 px-4 py-2 text-sm ${typeStyles[alert.type] ?? typeStyles[0]}`}
          >
            <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <span className="font-medium">{alert.title}</span>
              {alert.message && <span className="opacity-90"> — {alert.message}</span>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(alert.id)}
              aria-label="Dispensar aviso"
              className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
