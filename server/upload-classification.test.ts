import { describe, expect, it } from "vitest";
import { parseCSV } from "./csvParser.js";
import { inferFlowType, normalizeMerchant } from "./transactionUtils.js";
import { classifyTransaction } from "./classifier.js";

function buildTransaction(row: { date: string; description: string; amount: number }) {
  const merchant = normalizeMerchant(row.description);
  const rawFlowType = inferFlowType(row.amount);
  const classification = classifyTransaction(
    merchant || row.description,
    row.amount,
    rawFlowType,
  );

  const effectiveFlowType = classification.flowOverride ?? rawFlowType;
  const effectiveAmount =
    effectiveFlowType === "outflow" && row.amount > 0
      ? -Math.abs(row.amount)
      : row.amount;

  return {
    merchant: merchant || row.description,
    amount: effectiveAmount,
    flowType: effectiveFlowType,
    transactionClass: classification.transactionClass,
    category: classification.category,
  };
}

describe("unsigned CSV → classification integration", () => {
  it("classifies an unsigned CSV with mixed merchants correctly", async () => {
    const csv = Buffer.from(
      [
        "Date,Description,Amount",
        "01/15/2026,NETFLIX INC,15.99",
        "01/16/2026,WHOLE FOODS MARKET #1234,85.00",
        "01/17/2026,PAYROLL DEPOSIT,3500.00",
        "01/18/2026,STARBUCKS COFFEE,5.50",
        "01/19/2026,XYZZY CORP,25.00",
      ].join("\n"),
    );

    const result = await parseCSV(csv, "test.csv");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("parse failed");

    const txns = result.rows.map(buildTransaction);

    // Netflix → subscriptions/expense, amount negated
    expect(txns[0]).toMatchObject({
      category: "subscriptions",
      transactionClass: "expense",
      flowType: "outflow",
      amount: -15.99,
    });

    // Whole Foods → groceries/expense, amount negated
    expect(txns[1]).toMatchObject({
      category: "groceries",
      transactionClass: "expense",
      flowType: "outflow",
      amount: -85.00,
    });

    // Payroll → income/income, amount stays positive
    expect(txns[2]).toMatchObject({
      category: "income",
      transactionClass: "income",
      flowType: "inflow",
      amount: 3500.00,
    });

    // Starbucks → dining/expense, amount negated
    expect(txns[3]).toMatchObject({
      category: "dining",
      transactionClass: "expense",
      flowType: "outflow",
      amount: -5.50,
    });

    // Unknown → income/income (no keywords match, positive amount)
    expect(txns[4]).toMatchObject({
      category: "income",
      transactionClass: "income",
      flowType: "inflow",
      amount: 25.00,
    });
  });
});
