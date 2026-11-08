const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

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
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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
  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    body,
    headers: raw
      ? headers
      : {
          "Content-Type": "application/json",
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
