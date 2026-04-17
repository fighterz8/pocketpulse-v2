import { beforeEach, describe, expect, it, vi } from "vitest";
import { reclassifyTransactions } from "./reclassify.js";

vi.mock("./storage.js", () => ({
  listAllTransactionsForExport: vi.fn(),
  bulkUpdateTransactions: vi.fn().mockResolvedValue(undefined),
}));

import { listAllTransactionsForExport, bulkUpdateTransactions } from "./storage.js";

const mockList = vi.mocked(listAllTransactionsForExport);
const mockBulkUpdate = vi.mocked(bulkUpdateTransactions);

function makeTxn(overrides: Record<string, unknown>) {
  return {
    id: 1,
    userId: 1,
    uploadId: 1,
    accountId: 1,
    date: "2026-01-15",
    amount: "15.99",
    merchant: "NETFLIX INC",
    rawDescription: "NETFLIX INC",
    flowType: "inflow",
    transactionClass: "income",
    category: "income",
    recurrenceType: "one-time",
    labelSource: "rule",
    labelConfidence: "0.80",
    labelReason: "inflow",
    aiAssisted: false,
    userCorrected: false,
    excludedFromAnalysis: false,
    excludedReason: null,
    excludedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("reclassifyTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reclassifies unsigned Netflix from income to entertainment", async () => {
    mockList.mockResolvedValue([makeTxn({})]);
    mockBulkUpdate.mockResolvedValue(undefined);

    const result = await reclassifyTransactions(1);

    expect(result.total).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skippedUserCorrected).toBe(0);

    const calls = mockBulkUpdate.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0]![0]).toBe(1);
    const updates = calls[0]![1];
    expect(updates[0]).toMatchObject({
      id: 1,
      category: "entertainment",
      transactionClass: "expense",
      flowType: "outflow",
      amount: "-15.99",
    });
  });

  it("skips user-corrected transactions", async () => {
    mockList.mockResolvedValue([makeTxn({ id: 1, userCorrected: true })]);

    const result = await reclassifyTransactions(1);

    expect(result.total).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skippedUserCorrected).toBe(1);
    expect(mockBulkUpdate).not.toHaveBeenCalled();
  });

  it("skips transactions with no changes needed", async () => {
    mockList.mockResolvedValue([
      makeTxn({
        id: 1,
        amount: "-15.99",
        flowType: "outflow",
        transactionClass: "expense",
        category: "entertainment",
        recurrenceType: "recurring",
      }),
    ]);

    const result = await reclassifyTransactions(1);

    expect(result.total).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.updated).toBe(0);
  });

  it("returns zero counts for empty transaction list", async () => {
    mockList.mockResolvedValue([]);

    const result = await reclassifyTransactions(1);

    expect(result.total).toBe(0);
    expect(result.updated).toBe(0);
  });
});
