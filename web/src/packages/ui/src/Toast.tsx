import { Toaster as SonnerToaster, toast } from "sonner";

/** Substitui os "flash messages" de reload de página do legado — ver
 * docs/frontend/design-system.md. Mount <Toaster /> once near the app
 * root (see app/providers.tsx); call `toast.success()`/`toast.error()`
 * from anywhere, no provider/context needed. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-border bg-card text-card-foreground shadow-lg",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
        },
      }}
    />
  );
}

export { toast };
