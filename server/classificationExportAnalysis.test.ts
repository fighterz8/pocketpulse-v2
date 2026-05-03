import { describe, expect, it } from "vitest";
import { analyzeClassificationExports, type ClassificationExportSnapshot } from "./classificationExportAnalysis.js";

const baseSnapshot = {
  sampleSize: 4,
  categoryAccuracy: 0.5,
  classAccuracy: 0.75,
  recurrenceAccuracy: 0.25,
} satisfies Partial<ClassificationExportSnapshot>;

describe("analyzeClassificationExports", () => {
  it("turns repeated merchant corrections into manual merchant recommendations", () => {
    const analysis = analyzeClassificationExports([
      {
        ...baseSnapshot,
        verdicts: [
          {
            transactionId: 1,
            classifierCategory: "other",
            classifierClass: "expense",
            classifierRecurrence: "one-time",
            classifierLabelSource: "rule",
            classifierLabelConfidence: 0.55,
            verdict: "corrected",
            correctedCategory: "software",
            correctedClass: null,
            correctedRecurrence: "recurring",
          },
          {
            transactionId: 2,
            classifierCategory: "other",
            classifierClass: "expense",
            classifierRecurrence: "one-time",
            classifierLabelSource: "rule",
            classifierLabelConfidence: 0.55,
            verdict: "corrected",
            correctedCategory: "software",
            correctedClass: null,
            correctedRecurrence: "recurring",
          },
        ],
        transactions: [
          { id: 1, date: "2025-01-01", rawDescription: "OPENAI *CHATGPT PLUS", merchant: "OpenAI", amount: -20, category: "other", transactionClass: "expense", recurrenceType: "one-time" },
          { id: 2, date: "2025-02-01", rawDescription: "OPENAI *CHATGPT PLUS", merchant: "OpenAI", amount: -20, category: "other", transactionClass: "expense", recurrenceType: "one-time" },
        ],
      },
    ]);

    expect(analysis.dimensionCorrections).toEqual({ category: 2, class: 0, recurrence: 2 });
    expect(analysis.merchantRecommendations[0]).toMatchObject({
      merchantKey: "openai",
      support: 2,
      correctionCount: 2,
      recommended: {
        category: "software",
        transactionClass: "expense",
        recurrenceType: "recurring",
        source: "manual",
      },
      changedDimensions: ["category", "recurrenceType"],
      confidence: "medium",
    });
  });

  it("separates recurring income misses from expense recommendations", () => {
    const analysis = analyzeClassificationExports([
      {
        ...baseSnapshot,
        verdicts: [1, 2, 3].map((transactionId) => ({
          transactionId,
          classifierCategory: "income",
          classifierClass: "income",
          classifierRecurrence: "one-time",
          classifierLabelSource: "rule",
          classifierLabelConfidence: 0.55,
          verdict: "corrected" as const,
          correctedCategory: null,
          correctedClass: null,
          correctedRecurrence: "recurring",
        })),
        transactions: [
          { id: 1, date: "2025-01-01", rawDescription: "STRIPE PAYOUT", merchant: "Stripe Payout", amount: 100, category: "income", transactionClass: "income", recurrenceType: "one-time" },
          { id: 2, date: "2025-02-01", rawDescription: "STRIPE PAYOUT", merchant: "Stripe Payout", amount: 150, category: "income", transactionClass: "income", recurrenceType: "one-time" },
          { id: 3, date: "2025-03-01", rawDescription: "STRIPE PAYOUT", merchant: "Stripe Payout", amount: 120, category: "income", transactionClass: "income", recurrenceType: "one-time" },
        ],
      },
    ]);

    expect(analysis.recurrenceMisses[0]).toMatchObject({
      merchantKey: "stripe payout",
      correctedRecurringCount: 3,
      suggestedPattern: "recurring_income",
    });
  });
});
