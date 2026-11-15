import { TooManyRequestsError } from "../domain/errors.js";
import type {
  ActiveOfferingCounter,
  BudgetStatus,
  CostLine,
  DailyCost,
  FinopsAwsRepository,
  Period,
} from "../repositories/finops.repository.js";

/** Cada chamada ao Cost Explorer custa US$ 0,01 (spec plataforma-admin,
 * 6.4): o relatório fica 24 h em memória e o botão de atualizar só vale
 * uma vez por hora. */
export const FINOPS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const FINOPS_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export interface FinopsReport {
  /** `YYYY-MM` do mês do relatório (UTC, como o Cost Explorer). */
  month: string;
  costToDateUsd: number;
  /** Previsão do mês fechado; `null` sem dados para prever. */
  forecastUsd: number | null;
  /** Cotação usada para os campos `*Brl`; `null` quando não configurada. */
  usdBrlRate: number | null;
  costToDateBrl: number | null;
  forecastBrl: number | null;
  daily: DailyCost[];
  byService: CostLine[];
  byComponent: CostLine[];
  budgets: BudgetStatus[];
  activeOfferings: number;
  /** Custo do mês dividido pelas ofertas ativas; `null` sem oferta ativa. */
  costPerActiveOfferingUsd: number | null;
  generatedAt: string;
  /** Até quando esta leitura vale; depois, a próxima abertura recarrega. */
  cachedUntil: string;
  /** A partir de quando o botão de atualizar volta a valer. */
  refreshAvailableAt: string;
}

export interface FinopsOptions {
  usdBrlRate?: number | null;
  ttlMs?: number;
  refreshIntervalMs?: number;
  now?: () => number;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Meses são os do Cost Explorer: UTC. `end` é exclusivo. */
export function monthPeriods(nowMs: number): { month: string; toDate: Period; remaining: Period | null } {
  const now = new Date(nowMs);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = Date.UTC(y, m, 1);
  const nextMonth = Date.UTC(y, m + 1, 1);
  const tomorrow = Date.UTC(y, m, now.getUTCDate() + 1);
  return {
    month: isoDay(start).slice(0, 7),
    toDate: { start: isoDay(start), end: isoDay(tomorrow) },
    // A previsão exige começar amanhã ou depois e ter ao menos um dia.
    remaining: tomorrow < nextMonth ? { start: isoDay(tomorrow), end: isoDay(nextMonth) } : null,
  };
}

export class FinopsService {
  private cached: { report: FinopsReport; expiresAt: number; refreshableAt: number } | null = null;
  private inflight: Promise<FinopsReport> | null = null;
  private readonly ttlMs: number;
  private readonly refreshIntervalMs: number;
  private readonly now: () => number;
  private readonly usdBrlRate: number | null;

  constructor(
    private readonly aws: FinopsAwsRepository,
    private readonly offerings: ActiveOfferingCounter,
    options: FinopsOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? FINOPS_CACHE_TTL_MS;
    this.refreshIntervalMs = options.refreshIntervalMs ?? FINOPS_REFRESH_INTERVAL_MS;
    this.now = options.now ?? Date.now;
    this.usdBrlRate = options.usdBrlRate && options.usdBrlRate > 0 ? options.usdBrlRate : null;
  }

  /** Cache de 24 h: abrir a tela de novo dentro da janela não chama a AWS. */
  async get(): Promise<FinopsReport> {
    if (this.cached && this.cached.expiresAt > this.now()) return this.cached.report;
    return this.load();
  }

  /** Força nova leitura, no máximo uma por hora. */
  async refresh(): Promise<FinopsReport> {
    const at = this.now();
    if (this.cached && this.cached.refreshableAt > at) {
      const wait = Math.ceil((this.cached.refreshableAt - at) / 1000);
      throw new TooManyRequestsError("FinOps refreshed less than an hour ago", "refresh_too_soon", wait);
    }
    return this.load();
  }

  /** Duas aberturas simultâneas com cache vazio viram uma leitura só. */
  private load(): Promise<FinopsReport> {
    this.inflight ??= this.build().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async build(): Promise<FinopsReport> {
    const at = this.now();
    const { month, toDate, remaining } = monthPeriods(at);

    const [daily, byService, byComponent, forecastRest, budgets, activeOfferings] = await Promise.all([
      this.aws.daily(toDate),
      this.aws.byService(toDate),
      this.aws.byComponent(toDate),
      remaining ? this.aws.forecast(remaining) : Promise.resolve(0),
      this.aws.budgets(),
      this.offerings.countActive(),
    ]);

    const costToDateUsd = round(daily.reduce((sum, d) => sum + d.usd, 0));
    const forecastUsd = forecastRest === null ? null : round(costToDateUsd + forecastRest);
    const rate = this.usdBrlRate;

    const report: FinopsReport = {
      month,
      costToDateUsd,
      forecastUsd,
      usdBrlRate: rate,
      costToDateBrl: rate ? round(costToDateUsd * rate) : null,
      forecastBrl: rate && forecastUsd !== null ? round(forecastUsd * rate) : null,
      daily: daily.map((d) => ({ ...d, usd: round(d.usd) })),
      byService: byService.map((l) => ({ ...l, usd: round(l.usd) })),
      byComponent: byComponent.map((l) => ({ ...l, usd: round(l.usd) })),
      budgets,
      activeOfferings,
      costPerActiveOfferingUsd: activeOfferings > 0 ? round(costToDateUsd / activeOfferings) : null,
      generatedAt: new Date(at).toISOString(),
      cachedUntil: new Date(at + this.ttlMs).toISOString(),
      refreshAvailableAt: new Date(at + this.refreshIntervalMs).toISOString(),
    };
    this.cached = { report, expiresAt: at + this.ttlMs, refreshableAt: at + this.refreshIntervalMs };
    return report;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
