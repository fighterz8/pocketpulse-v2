import type { ClassificationVerdict, MerchantClassification } from "../shared/schema.js";
import { normalizeMerchant } from "./transactionUtils.js";
import { recurrenceKey } from "./recurrenceDetector.js";

export type ClassificationExportTransaction = {
  id: number;
  date: string;
  rawDescription: string;
  merchant?: string;
  amount: number;
  category: string;
  transactionClass: string;
  recurrenceType: string;
  labelSource?: string;
  labelConfidence?: number;
};

export type ClassificationExportSnapshot = {
  id?: number;
  sampleSize?: number;
  categoryAccuracy?: number | null;
  classAccuracy?: number | null;
  recurrenceAccuracy?: number | null;
  verdicts: ClassificationVerdict[];
  transactions?: ClassificationExportTransaction[];
};

export type MerchantFeedbackRecommendation = {
  merchantKey: string;
  merchantDisplay: string;
  verdictCount: number;
  correctionCount: number;
  support: number;
  recommended: MerchantClassification;
  changedDimensions: Array<"category" | "transactionClass" | "recurrenceType">;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  transactionIds: number[];
  examples: string[];
};

export type RecurrenceMiss = {
  merchantKey: string;
  merchantDisplay: string;
  correctedRecurringCount: number;
  classifierOneTimeCount: number;
  transactionIds: number[];
  dates: string[];
  amounts: number[];
  suggestedPattern: "recurring_income" | "recurring_expense" | "recurring_transfer" | "frequent_variable_spend";
  reason: string;
};

export type ClassificationExportAnalysis = {
  sampleCount: number;
  rowCount: number;
  aggregateAccuracy: {
    category: number | null;
    class: number | null;
    recurrence: number | null;
  };
  dimensionCorrections: {
    category: number;
    class: number;
    recurrence: number;
  };
  merchantRecommendations: MerchantFeedbackRecommendation[];
  recurrenceMisses: RecurrenceMiss[];
};

type MergedRow = ClassificationVerdict & {
  rawDescription: string;
  date: string | null;
  amount: number | null;
  merchantDisplay: string;
  merchantKey: string;
};

type Vote = {
  category: string;
  transactionClass: string;
  recurrenceType: string;
};

const KNOWN_FREQUENT_VARIABLE = new Set([
  "amazon",
  "doordash",
  "uber",
  "uber eats",
  "lyft",
]);

function finalVote(row: ClassificationVerdict): Vote {
  return {
    category: row.correctedCategory ?? row.classifierCategory,
    transactionClass: row.correctedClass ?? row.classifierClass,
    recurrenceType: row.correctedRecurrence ?? row.classifierRecurrence,
  };
}

function confidenceFromSupport(support: number, correctionCount: number): "high" | "medium" | "low" {
  if (support >= 3 && correctionCount >= 2) return "high";
  if (support >= 2) return "medium";
  return "low";
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function toMergedRows(snapshot: ClassificationExportSnapshot): MergedRow[] {
  const txById = new Map<number, ClassificationExportTransaction>();
  for (const tx of snapshot.transactions ?? []) txById.set(tx.id, tx);

  return snapshot.verdicts
    .filter((v) => v.verdict !== "skipped")
    .map((v) => {
      const tx = txById.get(v.transactionId);
      const rawDescription = tx?.rawDescription ?? "";
      const txMerchant = tx?.merchant?.trim();
      const merchantDisplay =
        txMerchant && txMerchant.toLowerCase() !== "unknown merchant"
          ? txMerchant
          : normalizeMerchant(rawDescription) || rawDescription || `Transaction ${v.transactionId}`;
      const merchantKey = recurrenceKey(merchantDisplay || rawDescription);
      return {
        ...v,
        rawDescription,
        date: tx?.date ?? null,
        amount: typeof tx?.amount === "number" ? tx.amount : null,
        merchantDisplay,
        merchantKey,
      };
    })
    .filter((r) => r.merchantKey.length > 0);
}

export function analyzeClassificationExports(
  snapshots: ClassificationExportSnapshot[],
): ClassificationExportAnalysis {
  const rows = snapshots.flatMap(toMergedRows);
  const groups = new Map<string, MergedRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.merchantKey) ?? [];
    existing.push(row);
    groups.set(row.merchantKey, existing);
  }

  const merchantRecommendations: MerchantFeedbackRecommendation[] = [];
  const recurrenceMisses: RecurrenceMiss[] = [];

  for (const [merchantKey, group] of groups) {
    const voteCounts = new Map<string, { vote: Vote; rows: MergedRow[] }>();
    for (const row of group) {
      const vote = finalVote(row);
      const key = `${vote.category}|${vote.transactionClass}|${vote.recurrenceType}`;
      const bucket = voteCounts.get(key) ?? { vote, rows: [] };
      bucket.rows.push(row);
      voteCounts.set(key, bucket);
    }

    const best = [...voteCounts.values()].sort((a, b) => b.rows.length - a.rows.length)[0];
    if (best) {
      const correctionRows = group.filter((r) => r.verdict === "corrected");
      const changedDimensions = new Set<"category" | "transactionClass" | "recurrenceType">();
      for (const row of correctionRows) {
        if (row.correctedCategory != null) changedDimensions.add("category");
        if (row.correctedClass != null) changedDimensions.add("transactionClass");
        if (row.correctedRecurrence != null) changedDimensions.add("recurrenceType");
      }

      const support = best.rows.length;
      const recommendationConfidence = confidenceFromSupport(support, correctionRows.length);
      const supportRatio = support / group.length;
      // Avoid creating over-broad merchant rules when one normalized key contains
      // legitimately different products/flows, e.g. Amazon FBA income and Amazon
      // marketplace shopping. Those should become alias/pattern work, not a single
      // global merchant override.
      if (correctionRows.length > 0 && support >= 2 && supportRatio >= 0.75) {
        const reasons = [
          `${correctionRows.length}/${group.length} reviewed rows were corrected`,
          `${support}/${group.length} rows agree on ${best.vote.category}/${best.vote.transactionClass}/${best.vote.recurrenceType}`,
        ];
        if (changedDimensions.has("recurrenceType")) reasons.push("recurrence was manually corrected for this merchant");
        if (changedDimensions.has("category")) reasons.push("category was manually corrected for this merchant");

        merchantRecommendations.push({
          merchantKey,
          merchantDisplay: group[0]!.merchantDisplay,
          verdictCount: group.length,
          correctionCount: correctionRows.length,
          support,
          recommended: {
            merchantKey,
            category: best.vote.category,
            transactionClass: best.vote.transactionClass,
            recurrenceType: best.vote.recurrenceType,
            labelConfidence: recommendationConfidence === "high" ? 0.95 : recommendationConfidence === "medium" ? 0.85 : 0.7,
            source: "manual",
          },
          changedDimensions: [...changedDimensions],
          confidence: recommendationConfidence,
          reasons,
          transactionIds: best.rows.map((r) => r.transactionId),
          examples: [...new Set(group.map((r) => r.rawDescription).filter(Boolean))].slice(0, 3),
        });
      }
    }

    const recurringCorrections = group.filter(
      (r) => r.classifierRecurrence === "one-time" && r.correctedRecurrence === "recurring",
    );
    if (recurringCorrections.length >= 2) {
      const finalClasses = recurringCorrections.map((r) => finalVote(r).transactionClass);
      const correctedRecurringCount = recurringCorrections.length;
      const incomeCount = finalClasses.filter((c) => c === "income").length;
      const transferCount = finalClasses.filter((c) => c === "transfer").length;
      const suggestedPattern = incomeCount > finalClasses.length / 2
        ? "recurring_income"
        : transferCount > finalClasses.length / 2
          ? "recurring_transfer"
          : KNOWN_FREQUENT_VARIABLE.has(merchantKey)
            ? "frequent_variable_spend"
            : "recurring_expense";

      recurrenceMisses.push({
        merchantKey,
        merchantDisplay: group[0]!.merchantDisplay,
        correctedRecurringCount,
        classifierOneTimeCount: group.filter((r) => r.classifierRecurrence === "one-time").length,
        transactionIds: recurringCorrections.map((r) => r.transactionId),
        dates: recurringCorrections.map((r) => r.date).filter((d): d is string => d != null).sort(),
        amounts: recurringCorrections.map((r) => r.amount).filter((a): a is number => a != null),
        suggestedPattern,
        reason:
          suggestedPattern === "frequent_variable_spend"
            ? "Reviewer marked repeated merchant activity recurring, but this merchant is better modeled as frequent variable spend/leak behavior."
            : "Multiple rows for this merchant were corrected from one-time to recurring.",
      });
    }
  }

  return {
    sampleCount: snapshots.length,
    rowCount: rows.length,
    aggregateAccuracy: {
      category: average(snapshots.map((s) => s.categoryAccuracy)),
      class: average(snapshots.map((s) => s.classAccuracy)),
      recurrence: average(snapshots.map((s) => s.recurrenceAccuracy)),
    },
    dimensionCorrections: {
      category: rows.filter((r) => r.correctedCategory != null).length,
      class: rows.filter((r) => r.correctedClass != null).length,
      recurrence: rows.filter((r) => r.correctedRecurrence != null).length,
    },
    merchantRecommendations: merchantRecommendations.sort(
      (a, b) => b.support - a.support || b.correctionCount - a.correctionCount || a.merchantKey.localeCompare(b.merchantKey),
    ),
    recurrenceMisses: recurrenceMisses.sort(
      (a, b) => b.correctedRecurringCount - a.correctedRecurringCount || a.merchantKey.localeCompare(b.merchantKey),
    ),
  };
}
