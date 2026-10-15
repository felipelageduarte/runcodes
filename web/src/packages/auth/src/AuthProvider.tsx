import type { ReactNode } from "react";
import { useSession } from "./useSession";

/** Warms the session query as soon as the app boots, so by the time a
 * route guard needs it, /me has usually already resolved — doesn't
 * block rendering itself (public routes like /entrar must never wait on
 * an auth check; see guards.tsx for where the actual loading state is
 * handled). */
export function AuthProvider({ children }: { children: ReactNode }) {
  useSession();
  return <>{children}</>;
}
