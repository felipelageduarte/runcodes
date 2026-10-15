import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { AuthProvider } from "@runcodes/auth";
import { Toaster } from "@runcodes/ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user" desliga animações pra quem pediu no SO —
          cobre todo motion/react do app de uma vez. */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </MotionConfig>
    </QueryClientProvider>
  );
}
