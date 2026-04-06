import { describe, expect, it } from "vitest";

import { classifyTransaction, type ClassificationResult } from "./classifier.js";

describe("classifyTransaction", () => {
  it("classifies a subscription service", () => {
    const result = classifyTransaction("NETFLIX INC", -15.99);
    expect(result.category).toBe("entertainment");
    expect(result.transactionClass).toBe("expense");
    expect(result.labelSource).toBe("rule");
    expect(result.labelReason).toBeTruthy();
  });

  it("classifies grocery stores", () => {
    const result = classifyTransaction("WHOLE FOODS MARKET", -85.20);
    expect(result.category).toBe("groceries");
    expect(result.transactionClass).toBe("expense");
  });

  it("classifies dining/restaurants", () => {
    const result = classifyTransaction("CHIPOTLE MEXICAN GRILL", -12.50);
    expect(result.category).toBe("dining");
  });

  it("classifies utility payments", () => {
    const result = classifyTransaction("ELECTRIC COMPANY", -120.00);
    expect(result.category).toBe("utilities");
  });

  it("classifies income from positive amount", () => {
    const result = classifyTransaction("PAYROLL DEPOSIT", 3500.00);
    expect(result.category).toBe("income");
    expect(result.transactionClass).toBe("income");
    expect(result.flowType).toBe("inflow");
  });

  it("classifies transfers — category is 'other', transactionClass is 'transfer'", () => {
    const result = classifyTransaction("TRANSFER TO SAVINGS", -500.00);
    expect(result.category).toBe("other");
    expect(result.transactionClass).toBe("transfer");
  });

  it("classifies insurance payments", () => {
    const result = classifyTransaction("STATE FARM INSURANCE", -150.00);
    expect(result.category).toBe("insurance");
  });

  it("classifies gas stations", () => {
    const result = classifyTransaction("SHELL GAS STATION", -45.00);
    expect(result.category).toBe("gas");
  });

  it("classifies pharmacy/medical", () => {
    const result = classifyTransaction("CVS PHARMACY", -22.00);
    expect(result.category).toBe("medical");
  });

  it("classifies shopping", () => {
    const result = classifyTransaction("AMAZON.COM", -49.99);
    expect(result.category).toBe("shopping");
  });

  it("classifies fees", () => {
    const result = classifyTransaction("MONTHLY SERVICE FEE", -12.00);
    expect(result.category).toBe("fees");
  });

  it("classifies housing/rent", () => {
    const result = classifyTransaction("RENT PAYMENT", -1200.00);
    expect(result.category).toBe("housing");
  });

  it("classifies refunds", () => {
    const result = classifyTransaction("REFUND FROM AMAZON", 29.99);
    expect(result.transactionClass).toBe("refund");
  });

  it("defaults unknown merchants to 'other' for amounts outside heuristic bands", () => {
    // $150 is above all amount-range buckets — stays 'other'
    const result = classifyTransaction("XYZZY CORP #99", -150.00);
    expect(result.category).toBe("other");
  });

  it("amount-range heuristic: ~$10 unknown expense lands in dining", () => {
    // $10 falls in the quick-service dining range ($8–$22.99); no merchant rule matches
    const result = classifyTransaction("XYZZY CORP #99", -10.00);
    expect(result.category).toBe("dining");
    expect(result.transactionClass).toBe("expense");
  });

  it("returns confidence score between 0 and 1", () => {
    const result = classifyTransaction("NETFLIX INC", -15.99);
    expect(result.labelConfidence).toBeGreaterThanOrEqual(0);
    expect(result.labelConfidence).toBeLessThanOrEqual(1);
  });

  it("sets recurrenceType to one-time by default", () => {
    const result = classifyTransaction("RANDOM STORE", -5.00);
    expect(result.recurrenceType).toBe("one-time");
  });

  it("hints recurring for known subscription merchants", () => {
    const result = classifyTransaction("SPOTIFY PREMIUM", -9.99);
    expect(result.recurrenceType).toBe("recurring");
  });

  it("classifies software/SaaS (GitHub)", () => {
    const result = classifyTransaction("GITHUB INC", -4.00);
    expect(result.category).toBe("software");
  });

  it("classifies entertainment (AMC Theatres)", () => {
    const result = classifyTransaction("AMC THEATRES", -18.00);
    expect(result.category).toBe("entertainment");
  });

  it("classifies debt payments", () => {
    const result = classifyTransaction("STUDENT LOAN PAYMENT", -300.00);
    expect(result.category).toBe("debt");
  });

  describe("positive-amount expense merchants (unsigned CSV format)", () => {
    it("classifies Netflix as expense when amount is positive (unsigned CSV)", () => {
      const result = classifyTransaction("NETFLIX INC", 15.99);
      expect(result.category).toBe("entertainment");
      expect(result.transactionClass).toBe("expense");
      expect(result.flowType).toBe("outflow");
    });

    it("classifies Whole Foods as expense when amount is positive", () => {
      const result = classifyTransaction("WHOLE FOODS MARKET", 85.00);
      expect(result.category).toBe("groceries");
      expect(result.transactionClass).toBe("expense");
      expect(result.flowType).toBe("outflow");
    });

    it("classifies Starbucks as expense when amount is positive (coffee category)", () => {
      const result = classifyTransaction("STARBUCKS", 5.50);
      expect(result.category).toBe("coffee");
      expect(result.transactionClass).toBe("expense");
      expect(result.flowType).toBe("outflow");
    });

    it("classifies Amazon as expense when amount is positive", () => {
      const result = classifyTransaction("AMAZON.COM", 42.00);
      expect(result.category).toBe("shopping");
      expect(result.transactionClass).toBe("expense");
      expect(result.flowType).toBe("outflow");
    });

    it("still classifies payroll as income regardless", () => {
      const result = classifyTransaction("PAYROLL DEPOSIT", 3500.00);
      expect(result.category).toBe("income");
      expect(result.transactionClass).toBe("income");
      expect(result.flowType).toBe("inflow");
    });

    it("still classifies refunds correctly — merchant match does not override refund class", () => {
      const result = classifyTransaction("REFUND FROM AMAZON", 29.99);
      expect(result.transactionClass).toBe("refund");
    });

    it("classifies TRANSFER TO AUTO LOAN as debt/expense, not transfer", () => {
      const result = classifyTransaction("TRANSFER TO AUTO LOAN PAYMENT", -500.00);
      expect(result.category).toBe("debt");
      expect(result.transactionClass).toBe("expense");
      expect(result.flowType).toBe("outflow");
    });

    it("classifies positive-amount TRANSFER TO AUTO LOAN as debt/expense", () => {
      const result = classifyTransaction("TRANSFER TO AUTO LOAN PAYMENT", 500.00);
      expect(result.category).toBe("debt");
      expect(result.transactionClass).toBe("expense");
      expect(result.flowType).toBe("outflow");
    });

    it("returns merchant name from the classifier", () => {
      const result = classifyTransaction("SQ *STARBUCKS #12345 SAN DIEGO CA", -4.50);
      expect(result.merchant).toBeTruthy();
      expect(result.merchant.toLowerCase()).toContain("starbucks");
    });

    it("sets aiAssisted=true for genuinely unknown transactions", () => {
      // Use a large amount so Pass 9b amount-range heuristic does not fire
      const result = classifyTransaction("XYZZY CORP #99", -150.00);
      expect(result.aiAssisted).toBe(true);
    });

    it("sets aiAssisted=false for matched merchant rules", () => {
      const result = classifyTransaction("NETFLIX INC", -15.99);
      expect(result.aiAssisted).toBe(false);
    });
  });
});
