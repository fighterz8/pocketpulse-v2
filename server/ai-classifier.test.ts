/**
 * Drift-prevention tests for the AI classifier system prompt.
 *
 * These tests ensure that every category name referenced in the SYSTEM_PROMPT
 * is a valid member of V1_CATEGORIES.  If a prompt edit accidentally introduces
 * a category name that doesn't exist in the schema (e.g. "business_software",
 * "subscriptions", "transportation", "health"), these tests will fail loudly
 * rather than silently coercing AI output to "other" at runtime.
 */
import { describe, it, expect } from "vitest";
import { V1_CATEGORIES } from "../shared/schema.js";
import { _AI_SYSTEM_PROMPT } from "./ai-classifier.js";

/**
 * Extract category names from the "Category definitions" block of the prompt.
 * Each definition line looks like:  "- categoryname: description text"
 * We match lines that start with "- " followed by a lowercase identifier
 * (letters or underscores) and a colon.
 */
function extractDefinedCategories(prompt: string): string[] {
  const lines = prompt.split("\n");
  const categoryLine = /^- ([a-z_]+): /;
  const found: string[] = [];

  let inDefinitionsBlock = false;
  for (const line of lines) {
    if (line.startsWith("Category definitions")) {
      inDefinitionsBlock = true;
      continue;
    }
    // Exit the definitions block when we hit an empty line followed by a non-bullet line
    if (inDefinitionsBlock && line.trim() === "") {
      // peek: next non-blank line might start a new section
      // We stop when we see a line that is not a bullet and not blank
      continue;
    }
    if (inDefinitionsBlock && line.startsWith("For each transaction")) {
      break;
    }
    if (inDefinitionsBlock) {
      const m = categoryLine.exec(line);
      if (m) {
        found.push(m[1]!);
      }
    }
  }
  return found;
}

/**
 * Extract all words that appear as values in decision-rule examples of the form
 * category="word" or use "word" in the Decision rules block.
 */
function extractDecisionRuleCategories(prompt: string): string[] {
  const found: string[] = [];
  // Match: category="foo" or category='foo'
  const quotedEq = /category=["']([a-z_]+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = quotedEq.exec(prompt)) !== null) {
    found.push(m[1]!);
  }
  // Match: use "foo" for ... or use "foo" as ... patterns
  const useQuoted = /\buse "([a-z_]+)"/g;
  while ((m = useQuoted.exec(prompt)) !== null) {
    found.push(m[1]!);
  }
  // Match: Prefer "foo" over ... patterns
  const preferQuoted = /\bPrefer "([a-z_]+)"/g;
  while ((m = preferQuoted.exec(prompt)) !== null) {
    found.push(m[1]!);
  }
  return [...new Set(found)];
}

describe("AI classifier SYSTEM_PROMPT drift prevention", () => {
  const prompt = _AI_SYSTEM_PROMPT;

  it("prompt is a non-empty string", () => {
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("every category in the definitions block is a valid V1_CATEGORY", () => {
    const defined = extractDefinedCategories(prompt);

    expect(defined.length).toBeGreaterThan(0);

    for (const cat of defined) {
      expect(
        (V1_CATEGORIES as readonly string[]).includes(cat),
        `"${cat}" appears in Category definitions but is not in V1_CATEGORIES`
      ).toBe(true);
    }
  });

  it("every category referenced in decision rules is a valid V1_CATEGORY or a transactionClass", () => {
    const VALID_TRANSACTION_CLASSES = new Set(["income", "expense", "transfer", "refund"]);
    const ruleCategories = extractDecisionRuleCategories(prompt);

    for (const cat of ruleCategories) {
      const isValidCategory = (V1_CATEGORIES as readonly string[]).includes(cat);
      const isValidClass = VALID_TRANSACTION_CLASSES.has(cat);
      expect(
        isValidCategory || isValidClass,
        `"${cat}" appears in decision rules but is neither a V1_CATEGORY nor a valid transactionClass`
      ).toBe(true);
    }
  });

  it("does not mention known bad category names from the old prompt", () => {
    const knownBadCategories = [
      "business_software",
      "subscriptions",
      "transportation",
      "health",
      "transfers",  // transactionClass, should never be a category value
    ];

    // We check only in the Category definitions block, not in prose
    const defined = extractDefinedCategories(prompt);
    for (const bad of knownBadCategories) {
      expect(
        defined,
        `"${bad}" must not appear as a category definition — it is not in V1_CATEGORIES`
      ).not.toContain(bad);
    }
  });

  it("all V1_CATEGORIES except 'other' have a definition in the prompt", () => {
    const defined = new Set(extractDefinedCategories(prompt));
    const categoriesNeedingDefinition = V1_CATEGORIES.filter((c) => c !== "other");

    for (const cat of categoriesNeedingDefinition) {
      expect(
        defined.has(cat),
        `V1_CATEGORY "${cat}" has no definition in the Category definitions block of SYSTEM_PROMPT`
      ).toBe(true);
    }
  });
});
