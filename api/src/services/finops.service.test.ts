import { describe, expect, it, vi } from "vitest";
import { TooManyRequestsError } from "../domain/errors.js";
import type { FinopsAwsRepository } from "../repositories/finops.repository.js";
import { FinopsService, monthPeriods } from "./finops.service.js";

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 15, 12); // 2026-11-15

function aws(overrides: Partial<FinopsAwsRepository> = {}): FinopsAwsRepository {
  return {
    daily: vi.fn().mockResolvedValue([
      { date: "2026-11-01", usd: 1.111 },
      { date: "2026-11-02", usd: 2.222 },
    ]),
    byService: vi.fn().mockResolvedValue([{ key: "Amazon EC2", usd: 3 }]),
    byComponent: vi.fn().mockResolvedValue([{ key: "api", usd: 3 }]),
    forecast: vi.fn().mockResolvedValue(20),
    budgets: vi.fn().mockResolvedValue([{ name: "runcodes-monthly", limitUsd: 40, actualUsd: 3, forecastedUsd: 25 }]),
    ...overrides,
  };
}

function build(repo = aws(), opts: { now?: () => number; usdBrlRate?: number | null; offerings?: number } = {}) {
  return new FinopsService(repo, { countActive: async () => opts.offerings ?? 4 }, {
    now: opts.now ?? (() => T0),
    usdBrlRate: opts.usdBrlRate,
  });
}

describe("monthPeriods", () => {
  it("mês corrente até amanhã, previsão de amanhã ao mês seguinte", () => {
    expect(monthPeriods(T0)).toEqual({
      month: "2026-11",
      toDate: { start: "2026-11-01", end: "2026-11-16" },
      remaining: { start: "2026-11-16", end: "2026-12-01" },
    });
  });

  it("no último dia do mês não há período para prever", () => {
    expect(monthPeriods(Date.UTC(2026, 10, 30, 23)).remaining).toBeNull();
  });
});

describe("FinopsService", () => {
  it("soma a série diária, soma a previsão restante e divide por turma ativa", async () => {
    const report = await build(aws(), { usdBrlRate: 5 }).get();
    expect(report.costToDateUsd).toBe(3.33);
    expect(report.forecastUsd).toBe(23.33);
    expect(report.costToDateBrl).toBe(16.65);
    expect(report.forecastBrl).toBe(116.65);
    expect(report.costPerActiveOfferingUsd).toBe(0.83);
    expect(report.byService).toEqual([{ key: "Amazon EC2", usd: 3 }]);
    expect(report.budgets).toHaveLength(1);
  });

  it("sem cotação configurada, BRL fica nulo em vez de inventar", async () => {
    const report = await build().get();
    expect(report.usdBrlRate).toBeNull();
    expect(report.costToDateBrl).toBeNull();
    expect(report.forecastBrl).toBeNull();
  });

  it("sem turma ativa, custo por turma é nulo", async () => {
    expect((await build(aws(), { offerings: 0 }).get()).costPerActiveOfferingUsd).toBeNull();
  });

  it("sem previsão da AWS, previsão fica nula", async () => {
    const report = await build(aws({ forecast: vi.fn().mockResolvedValue(null) })).get();
    expect(report.forecastUsd).toBeNull();
  });

  it("segunda abertura dentro de 24 h não chama a AWS", async () => {
    const repo = aws();
    let now = T0;
    const service = build(repo, { now: () => now });
    await service.get();
    now += 23 * HOUR;
    await service.get();
    expect(repo.daily).toHaveBeenCalledTimes(1);
    expect(repo.byService).toHaveBeenCalledTimes(1);
    now += 2 * HOUR;
    await service.get();
    expect(repo.daily).toHaveBeenCalledTimes(2);
  });

  it("duas aberturas simultâneas com cache vazio leem a AWS uma vez", async () => {
    const repo = aws();
    const service = build(repo);
    await Promise.all([service.get(), service.get()]);
    expect(repo.daily).toHaveBeenCalledTimes(1);
  });

  it("atualizar recusa dentro de 1 h e libera depois", async () => {
    const repo = aws();
    let now = T0;
    const service = build(repo, { now: () => now });
    await service.get();
    now += 30 * 60 * 1000;
    await expect(service.refresh()).rejects.toMatchObject({
      constructor: TooManyRequestsError,
      code: "refresh_too_soon",
      retryAfterSeconds: 1800,
    });
    expect(repo.daily).toHaveBeenCalledTimes(1);
    now += 31 * 60 * 1000;
    await service.refresh();
    expect(repo.daily).toHaveBeenCalledTimes(2);
  });

  it("falha da AWS propaga e não fica em cache", async () => {
    const daily = vi.fn().mockRejectedValueOnce(new Error("AccessDenied")).mockResolvedValue([]);
    const service = build(aws({ daily }));
    await expect(service.get()).rejects.toThrow("AccessDenied");
    await expect(service.get()).resolves.toMatchObject({ costToDateUsd: 0 });
  });
});
