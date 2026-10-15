import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
  startViewAs as apiStartViewAs,
  stopViewAs as apiStopViewAs,
} from "@runcodes/api-client";
import type { SessionUser } from "@runcodes/api-client";

export const SESSION_QUERY_KEY = ["session"] as const;

/** Session rehydration on page load — the only source of truth for "who
 * is logged in" across the whole app (no separate context/global state,
 * see docs/frontend/overview.md). A 401 from /me means "not logged in",
 * not an error to surface. */
export function useSession() {
  const query = useQuery<SessionUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await apiMe();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data),
  };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => apiLogin(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData<SessionUser>(SESSION_QUERY_KEY, data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      queryClient.setQueryData<SessionUser | null>(SESSION_QUERY_KEY, null);
    },
  });
}

/** Troca de papel efetivo sob a mesma conta — recarrega a página inteira
 * de propósito em vez de só invalidar o cache do React Query. Praticamente
 * toda query feita até agora (turmas, exercícios, o que for) foi buscada
 * com o papel antigo; um reload é a única forma de garantir que absolutamente
 * nada — inclusive estado local de componentes que não passa pelo React
 * Query — continue refletindo o papel anterior. Também é o sinal mais claro
 * possível pro usuário de que o contexto mudou. */
export function useViewAs() {
  return useMutation({
    mutationFn: (type: number) => apiStartViewAs(type),
    onSuccess: () => {
      window.location.assign("/");
    },
  });
}

export function useStopViewAs() {
  return useMutation({
    mutationFn: apiStopViewAs,
    onSuccess: () => {
      window.location.assign("/");
    },
  });
}
