import { useState } from "react";
import { Eye } from "lucide-react";
import { useSession, useViewAs } from "@runcodes/auth";
import { userTypeLabel } from "@runcodes/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@runcodes/ui";

/** Ponto de entrada do view-as — só aparece pra quem tem papel real
 * acima de aluno (nada pra rebaixar além disso). Nunca mostra opções
 * >= papel real: o backend já recusa, mas a UI não deveria nem oferecer. */
export function ViewAsMenu({ collapsedLabel }: { collapsedLabel?: boolean }) {
  const { user } = useSession();
  const viewAs = useViewAs();
  const [open, setOpen] = useState(false);

  const realType = user?.viewAs?.realType ?? user?.type ?? 0;
  if (realType <= 0) return null;

  const options = Array.from({ length: realType }, (_, type) => type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Ver como"
          title="Ver como outro papel"
          className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
        >
          <Eye aria-hidden="true" className="size-4.5 shrink-0" />
          {!collapsedLabel && <span className="hidden xl:inline">Ver como</span>}
        </button>
      </DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Ver como</DialogTitle>
          <DialogDescription>
            Sua conta continua a mesma — só a tela passa a mostrar o que esse papel veria. Nunca sobe de
            privilégio, só desce.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {options.map((type) => (
            <Button
              key={type}
              variant="secondary"
              loading={viewAs.isPending}
              onClick={() => {
                viewAs.mutate(type, { onSuccess: () => setOpen(false) });
              }}
            >
              {userTypeLabel(type)}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
