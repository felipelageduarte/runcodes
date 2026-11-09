/** Estado do usuário que o requireAuth confere a cada requisição, em vez de
 * confiar no que o JWT diz (spec admin-e-separacao-front, F2/G2). */
export interface SessionState {
  type: number;
  confirmed: boolean;
  tokenVersion: number;
}

export interface SessionStateSource {
  findSessionState(email: string): Promise<SessionState | null>;
}

export const SESSION_STATE_TTL_MS = 60_000;

/** Cache em memória, por e-mail, com TTL curto (60 s). Toda escrita que
 * muda tipo, confirmação ou senha chama `invalidate(email)`, então dentro
 * de um mesmo processo a revogação é imediata; entre processos (ou se
 * alguém escrever no banco por fora) vale o TTL. */
export class SessionStateCache implements SessionStateSource {
  private readonly entries = new Map<string, { state: SessionState | null; expiresAt: number }>();

  constructor(
    private readonly source: SessionStateSource,
    private readonly ttlMs: number = SESSION_STATE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async findSessionState(email: string): Promise<SessionState | null> {
    const hit = this.entries.get(email);
    if (hit && hit.expiresAt > this.now()) return hit.state;
    const state = await this.source.findSessionState(email);
    this.entries.set(email, { state, expiresAt: this.now() + this.ttlMs });
    return state;
  }

  invalidate(email: string): void {
    this.entries.delete(email);
  }

  clear(): void {
    this.entries.clear();
  }
}

/** O que os services recebem para derrubar sessão: incrementa
 * `token_version` no banco (todo JWT antigo passa a ter `tv` divergente) e
 * tira o e-mail do cache (o próximo request relê). */
export interface SessionRevoker {
  /** Trocou senha, tipo ou confirmação: tokens anteriores morrem. */
  revoke(email: string): Promise<void>;
  /** Só força releitura (ex.: conta acabou de ser confirmada). */
  refresh(email: string): void;
}

export interface TokenVersionStore {
  bumpTokenVersion(email: string): Promise<void>;
}

export class SessionRevocation implements SessionRevoker {
  constructor(
    private readonly store: TokenVersionStore,
    private readonly cache: SessionStateCache,
  ) {}

  async revoke(email: string): Promise<void> {
    await this.store.bumpTokenVersion(email);
    this.cache.invalidate(email);
  }

  refresh(email: string): void {
    this.cache.invalidate(email);
  }
}
