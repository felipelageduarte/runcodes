import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  type GroupDefinition,
} from "@aws-sdk/client-cost-explorer";
import { BudgetsClient, DescribeBudgetsCommand } from "@aws-sdk/client-budgets";
import type { PrismaClient } from "@prisma/client";

export interface CostLine {
  key: string;
  usd: number;
}

export interface DailyCost {
  /** `YYYY-MM-DD` (UTC, o dia do Cost Explorer). */
  date: string;
  usd: number;
}

export interface BudgetStatus {
  name: string;
  limitUsd: number;
  actualUsd: number;
  forecastedUsd: number;
}

/** Período do Cost Explorer: `start` inclusivo, `end` exclusivo, `YYYY-MM-DD`. */
export interface Period {
  start: string;
  end: string;
}

/** Porta para a AWS (Cost Explorer e Budgets). Cada chamada ao Cost
 * Explorer custa US$ 0,01: quem chama é o `FinopsService`, que cacheia. */
export interface FinopsAwsRepository {
  daily(period: Period): Promise<DailyCost[]>;
  byService(period: Period): Promise<CostLine[]>;
  byComponent(period: Period): Promise<CostLine[]>;
  /** Previsão do custo do período, ou `null` quando a AWS não tem dados
   * suficientes (conta nova) ou o período é curto demais. */
  forecast(period: Period): Promise<number | null>;
  budgets(): Promise<BudgetStatus[]>;
}

export interface ActiveOfferingCounter {
  countActive(): Promise<number>;
}

export interface FinopsAwsOptions {
  /** Valores da tag `Project` que pertencem ao RunCodes. A conta tem
   * outros projetos; sem esse filtro o painel mostraria a conta toda. */
  projectTags: string[];
  /** Conta para o `DescribeBudgets`; sem ela, orçamentos não são lidos. */
  accountId?: string;
  /** Orçamentos cujo nome começa com este prefixo entram na tela. */
  budgetPrefix?: string;
}

const NO_TAG = "(sem tag)";

function toNumber(amount: string | undefined): number {
  const n = Number(amount ?? "0");
  return Number.isFinite(n) ? n : 0;
}

/** Cost Explorer e Budgets só existem em us-east-1, independente de onde
 * o app roda. Credencial vem da role da instância (cadeia padrão). */
export class AwsFinopsRepository implements FinopsAwsRepository {
  constructor(
    private readonly ce: Pick<CostExplorerClient, "send">,
    private readonly budgetsClient: Pick<BudgetsClient, "send">,
    private readonly options: FinopsAwsOptions,
  ) {}

  static create(options: FinopsAwsOptions): AwsFinopsRepository {
    return new AwsFinopsRepository(
      new CostExplorerClient({ region: "us-east-1" }),
      new BudgetsClient({ region: "us-east-1" }),
      options,
    );
  }

  private get filter() {
    return { Tags: { Key: "Project", Values: this.options.projectTags } };
  }

  async daily(period: Period): Promise<DailyCost[]> {
    const out = await this.ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: period.start, End: period.end },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        Filter: this.filter,
      }),
    );
    return (out.ResultsByTime ?? []).map((r) => ({
      date: r.TimePeriod?.Start ?? "",
      usd: toNumber(r.Total?.UnblendedCost?.Amount),
    }));
  }

  private async grouped(period: Period, groupBy: GroupDefinition): Promise<CostLine[]> {
    const out = await this.ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: period.start, End: period.end },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
        Filter: this.filter,
        GroupBy: [groupBy],
      }),
    );
    const totals = new Map<string, number>();
    for (const result of out.ResultsByTime ?? []) {
      for (const group of result.Groups ?? []) {
        const raw = group.Keys?.[0] ?? "";
        // Chave de tag vem como `Component$web`; sem tag, `Component$`.
        const key = groupBy.Type === "TAG" ? raw.split("$").slice(1).join("$") || NO_TAG : raw;
        totals.set(key, (totals.get(key) ?? 0) + toNumber(group.Metrics?.UnblendedCost?.Amount));
      }
    }
    return [...totals.entries()].map(([key, usd]) => ({ key, usd })).sort((a, b) => b.usd - a.usd);
  }

  byService(period: Period): Promise<CostLine[]> {
    return this.grouped(period, { Type: "DIMENSION", Key: "SERVICE" });
  }

  byComponent(period: Period): Promise<CostLine[]> {
    return this.grouped(period, { Type: "TAG", Key: "Component" });
  }

  async forecast(period: Period): Promise<number | null> {
    try {
      const out = await this.ce.send(
        new GetCostForecastCommand({
          TimePeriod: { Start: period.start, End: period.end },
          Granularity: "MONTHLY",
          Metric: "UNBLENDED_COST",
          Filter: this.filter,
        }),
      );
      return toNumber(out.Total?.Amount);
    } catch (err) {
      // DataUnavailableException: conta ou tag sem histórico para prever.
      if (err instanceof Error && err.name === "DataUnavailableException") return null;
      throw err;
    }
  }

  async budgets(): Promise<BudgetStatus[]> {
    if (!this.options.accountId) return [];
    const prefix = this.options.budgetPrefix ?? "runcodes";
    const out = await this.budgetsClient.send(new DescribeBudgetsCommand({ AccountId: this.options.accountId }));
    return (out.Budgets ?? [])
      .filter((b) => b.BudgetName?.startsWith(prefix))
      .map((b) => ({
        name: b.BudgetName ?? "",
        limitUsd: toNumber(b.BudgetLimit?.Amount),
        actualUsd: toNumber(b.CalculatedSpend?.ActualSpend?.Amount),
        forecastedUsd: toNumber(b.CalculatedSpend?.ForecastedSpend?.Amount),
      }));
  }
}

export class PrismaActiveOfferingCounter implements ActiveOfferingCounter {
  constructor(private readonly prisma: PrismaClient) {}

  /** Oferta ativa = `end_date` de hoje em diante (mesma noção do aviso
   * ativo: `valid >= hoje`). */
  async countActive(): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.prisma.offerings.count({ where: { end_date: { gte: today } } });
  }
}
