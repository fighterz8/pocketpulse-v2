import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { Dashboard } from "./Dashboard";

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

const fullSummary = {
  totals: {
    totalInflow: 5000,
    totalOutflow: 1200.5,
    netCashflow: 3799.5,
    transactionCount: 42,
  },
  categoryBreakdown: [
    { category: "groceries", total: 450, count: 8 },
    { category: "subscriptions", total: 200, count: 3 },
  ],
  monthlyTrend: [
    { month: "2026-01", inflow: 2000, outflow: 500, net: 1500 },
    { month: "2026-02", inflow: 3000, outflow: 700.5, net: 2299.5 },
  ],
  recentTransactions: [
    {
      id: 1,
      date: "2026-02-10",
      merchant: "Coffee Shop",
      amount: "-4.50",
      category: "dining",
      transactionClass: "expense",
    },
    {
      id: 2,
      date: "2026-02-09",
      merchant: "Employer Pay",
      amount: "3000.00",
      category: "income",
      transactionClass: "income",
    },
  ],
  accountCount: 1,
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Dashboard", () => {
  it("renders loading state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderDashboard();
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it("renders empty state when there are no transactions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              totals: {
                totalInflow: 0,
                totalOutflow: 0,
                netCashflow: 0,
                transactionCount: 0,
              },
              categoryBreakdown: [],
              monthlyTrend: [],
              recentTransactions: [],
              accountCount: 0,
            }),
        }),
      ),
    );
    renderDashboard();
    expect(
      await screen.findByText(/no transaction data yet/i),
    ).toBeInTheDocument();
    const uploadLink = screen.getByRole("link", { name: /upload your first csv/i });
    expect(uploadLink).toHaveAttribute("href", "/upload");
  });

  it("renders error state when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    );
    renderDashboard();
    expect(
      await screen.findByText(/error loading dashboard/i),
    ).toBeInTheDocument();
  });

  it("renders KPI cards with formatted values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(fullSummary),
        }),
      ),
    );
    renderDashboard();
    expect(await screen.findByText("Total Income")).toBeInTheDocument();
    expect(screen.getByText("$5,000.00")).toBeInTheDocument();
    expect(screen.getByText("$1,200.50")).toBeInTheDocument();
    expect(screen.getByText("$3,799.50")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders category breakdown, monthly trend, and recent transactions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(fullSummary),
        }),
      ),
    );
    renderDashboard();
    expect(await screen.findByText("Spending by Category")).toBeInTheDocument();
    expect(screen.getByText("groceries")).toBeInTheDocument();
    expect(screen.getByText("subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Monthly Trend")).toBeInTheDocument();
    expect(screen.getByText("2026-01")).toBeInTheDocument();
    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
    expect(screen.getByText("Employer Pay")).toBeInTheDocument();
  });

  it("View all links to ledger route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(fullSummary),
        }),
      ),
    );
    renderDashboard();
    const viewAll = await screen.findByRole("link", { name: /view all/i });
    expect(viewAll).toHaveAttribute("href", "/transactions");
  });
});
