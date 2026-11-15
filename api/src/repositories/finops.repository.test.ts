import { describe, it, expect, vi } from "vitest";
import { AwsFinopsRepository } from "./finops.repository.js";

const period = { start: "2026-11-01", end: "2026-11-16" };

function build(ce: unknown, budgets: unknown = { send: vi.fn() }, accountId?: string) {
  return new AwsFinopsRepository(ce as never, budgets as never, { projectTags: ["runcodes-sh", "runcodes"], accountId });
}

describe("AwsFinopsRepository", () => {
  it("filtra pela tag Project e soma a série diária", async () => {
    const send = vi.fn().mockResolvedValue({
      ResultsByTime: [
        { TimePeriod: { Start: "2026-11-01" }, Total: { UnblendedCost: { Amount: "1.5" } } },
        { TimePeriod: { Start: "2026-11-02" }, Total: { UnblendedCost: { Amount: "2" } } },
      ],
    });
    const out = await build({ send }).daily(period);
    expect(out).toEqual([
      { date: "2026-11-01", usd: 1.5 },
      { date: "2026-11-02", usd: 2 },
    ]);
    expect(send.mock.calls[0]![0].input.Filter).toEqual({ Tags: { Key: "Project", Values: ["runcodes-sh", "runcodes"] } });
  });

  it("agrupa por componente, tira o prefixo da tag e rotula o que não tem tag", async () => {
    const send = vi.fn().mockResolvedValue({
      ResultsByTime: [
        {
          Groups: [
            { Keys: ["Component$api"], Metrics: { UnblendedCost: { Amount: "10" } } },
            { Keys: ["Component$"], Metrics: { UnblendedCost: { Amount: "1" } } },
            { Keys: ["Component$web"], Metrics: { UnblendedCost: { Amount: "0.5" } } },
          ],
        },
      ],
    });
    expect(await build({ send }).byComponent(period)).toEqual([
      { key: "api", usd: 10 },
      { key: "(sem tag)", usd: 1 },
      { key: "web", usd: 0.5 },
    ]);
  });

  it("previsão sem dados vira null; outro erro propaga", async () => {
    const noData = Object.assign(new Error("x"), { name: "DataUnavailableException" });
    expect(await build({ send: vi.fn().mockRejectedValue(noData) }).forecast(period)).toBeNull();
    await expect(build({ send: vi.fn().mockRejectedValue(new Error("AccessDenied")) }).forecast(period)).rejects.toThrow(
      "AccessDenied",
    );
  });

  it("orçamentos: sem conta não chama a AWS; com conta só devolve os do runcodes", async () => {
    const send = vi.fn().mockResolvedValue({
      Budgets: [
        { BudgetName: "runcodes-monthly", BudgetLimit: { Amount: "40" }, CalculatedSpend: { ActualSpend: { Amount: "3" }, ForecastedSpend: { Amount: "25" } } },
        { BudgetName: "outro-projeto", BudgetLimit: { Amount: "9" } },
      ],
    });
    expect(await build({ send: vi.fn() }, { send }).budgets()).toEqual([]);
    expect(send).not.toHaveBeenCalled();
    expect(await build({ send: vi.fn() }, { send }, "123").budgets()).toEqual([
      { name: "runcodes-monthly", limitUsd: 40, actualUsd: 3, forecastedUsd: 25 },
    ]);
  });
});
