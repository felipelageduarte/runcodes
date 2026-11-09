/** Única leitura de `VITE_API_URL` no app (teste de fronteira em
 * src/test/boundary.test.ts garante isso). Sem a variável o front assume
 * que a API está no mesmo host, em `/api` (proxy do Vite em dev, Caddy em
 * produção). Com ela, aceita origem externa, ex. `https://api.exemplo`. */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  return raw && raw.trim() !== "" ? raw.replace(/\/+$/, "") : "/api";
}

/** Métodos que mudam estado. Toda chamada com um deles leva
 * `X-Requested-With`: a API (fase F2 da spec admin-e-separacao-front)
 * passa a exigir o cabeçalho em mutação como barreira anti-CSRF, porque
 * um formulário HTML cross-site não consegue enviá-lo. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const REQUESTED_WITH_HEADER = "X-Requested-With";
export const REQUESTED_WITH_VALUE = "runcodes-web";

/** Mirrors the shape every error in runcodes-api's domain/errors.ts
 * serializes to — `code` is the discriminable part the UI branches on
 * (e.g. "account_not_confirmed" vs "invalid_credentials"), `error` is a
 * human string kept only as a fallback. See
 * docs/frontend/overview.md#padrões-de-código-e-princípios-de-design. */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Skip the default `Content-Type: application/json` + JSON body
   * serialization — e.g. multipart uploads build their own FormData. */
  raw?: boolean;
}

/** Rotas em que um 401 é a resposta final, não "token expirou": tentar
 * renovar aqui viraria loop ou mascararia credencial errada. */
const NO_REFRESH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

let refreshInFlight: Promise<boolean> | null = null;

/** O JWT dura 1 h e o cookie de sessão 7 dias: num 401 a primeira coisa a
 * fazer é pedir um token novo em POST /api/auth/refresh (o servidor relê o
 * usuário e recusa sessão revogada). Uma renovação por vez, compartilhada
 * entre requests concorrentes; o resultado diz se vale repetir a chamada. */
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${apiBase()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        [REQUESTED_WITH_HEADER]: REQUESTED_WITH_VALUE,
      },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function doFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { raw, headers, body, ...rest } = options;

  const method = (rest.method ?? "GET").toUpperCase();
  const csrfHeaders = MUTATING_METHODS.has(method)
    ? { [REQUESTED_WITH_HEADER]: REQUESTED_WITH_VALUE }
    : undefined;

  return fetch(`${apiBase()}${path}`, {
    ...rest,
    credentials: "include",
    body,
    headers: raw
      ? { ...csrfHeaders, ...headers }
      : {
          "Content-Type": "application/json",
          ...csrfHeaders,
          ...headers,
        },
  });
}

/** The only place in the app that calls `fetch` directly — every
 * resource module (auth.ts, exercises.ts, ...) goes through this, never
 * a component. `credentials: 'include'` is required for the browser to
 * send the httpOnly session cookie (see docs/frontend/security.md). */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  let res = await doFetch(path, options);

  if (res.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshSession()) res = await doFetch(path, options);
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = isJson && typeof payload === "object" ? payload.error : undefined;
    const code = isJson && typeof payload === "object" ? payload.code ?? payload.error : undefined;
    throw new ApiError(res.status, message ?? "request_failed", code);
  }

  return payload as T;
}
