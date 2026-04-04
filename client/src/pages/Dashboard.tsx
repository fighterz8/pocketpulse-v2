import { useState } from "react";
import { Link } from "wouter";

import { PeriodPreset, useDashboardSummary } from "../hooks/use-dashboard";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, opts?: Intl.NumberFormatOptions): string {
  return Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  });
}

function currency(n: number): string {
  return (n < 0 ? "-$" : "$") + fmt(n);
}

function currencyShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n < 0 ? "-$" : "$") + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n < 0 ? "-$" : "$") + (abs / 1_000).toFixed(1) + "K";
  return currency(n);
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent = "neutral",
  "data-testid": testId,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "blue" | "neutral";
  "data-testid"?: string;
}) {
  const colorMap = {
    green: "text-emerald-600",
    red: "text-red-500",
    blue: "text-blue-600",
    neutral: "text-gray-800",
  };
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p data-testid={testId} className={`text-2xl font-bold ${colorMap[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  );
}

function safeToSpendStatus(safeToSpend: number, income: number): {
  label: string;
  badge: string;
} {
  if (income === 0) return { label: "No income data", badge: "bg-gray-100 text-gray-500" };
  if (safeToSpend > income * 0.2) return { label: "Healthy buffer", badge: "bg-emerald-100 text-emerald-700" };
  if (safeToSpend > 0) return { label: "Tight but positive", badge: "bg-yellow-100 text-yellow-700" };
  if (safeToSpend > -income * 0.2) return { label: "Slightly over", badge: "bg-orange-100 text-orange-700" };
  return { label: "Over budget", badge: "bg-red-100 text-red-600" };
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Dashboard() {
  const [period, setPeriod] = useState<PeriodPreset>("90D");
  const { data, isLoading, error } = useDashboardSummary({ period });

  const periods: PeriodPreset[] = ["30D", "60D", "90D"];

  const headerRow = (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cashflow overview for your business</p>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="flex rounded-lg border border-gray-200 overflow-hidden"
          data-testid="period-selector"
        >
          {periods.map((p) => (
            <button
              key={p}
              data-testid={`period-btn-${p}`}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div>
        {headerRow}
        <p className="app-placeholder">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {headerRow}
        <p className="app-placeholder">Error loading dashboard.</p>
      </div>
    );
  }

  if (!data || data.totals.transactionCount === 0) {
    return (
      <div>
        {headerRow}
        <div className="dash-empty">
          <p>No transaction data yet.</p>
          <Link href="/upload" className="dash-empty-link">
            Upload your first CSV →
          </Link>
        </div>
      </div>
    );
  }

  const { totals, expenseLeaks, categoryBreakdown, monthlyTrend, recentTransactions } = data;
  const totalSpending = categoryBreakdown.reduce((s, c) => s + c.total, 0);
  const safeToSpend = totals.safeToSpend;
  const spendStatus = safeToSpendStatus(safeToSpend, totals.recurringIncome);
  const safeColor = safeToSpend > 0 ? "text-emerald-600" : safeToSpend > -totals.recurringIncome * 0.2 ? "text-orange-500" : "text-red-500";

  return (
    <div>
      {headerRow}

      {/* ── Row 1: Safe-to-Spend Hero + Expense Leaks ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Safe-to-Spend Card */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Safe-to-Spend Estimate
              </p>
              <p
                data-testid="safe-to-spend-value"
                className={`text-5xl font-extrabold tracking-tight ${safeColor}`}
              >
                {currency(safeToSpend)}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${spendStatus.badge}`}
                >
                  {spendStatus.label}
                </span>
                <span className="text-xs text-gray-400">
                  Recurring income minus recurring expenses · last {period}
                </span>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400 mb-1">Net cashflow</p>
              <p
                data-testid="net-cashflow-value"
                className={`text-lg font-bold ${totals.netCashflow >= 0 ? "text-emerald-600" : "text-red-500"}`}
              >
                {currency(totals.netCashflow)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{totals.transactionCount.toLocaleString()} transactions</p>
            </div>
          </div>

          {/* Simple indicator bar */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Recurring expenses</span>
              <span>Recurring income</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              {totals.recurringIncome > 0 && (
                <div
                  className={`h-full rounded-full transition-all ${safeToSpend >= 0 ? "bg-emerald-500" : "bg-red-400"}`}
                  style={{
                    width: `${Math.min(100, (totals.recurringExpenses / Math.max(totals.recurringIncome, totals.recurringExpenses)) * 100)}%`,
                  }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-red-500 font-medium">{currency(totals.recurringExpenses)}</span>
              <span className="text-emerald-600 font-medium">{currency(totals.recurringIncome)}</span>
            </div>
          </div>
        </Card>

        {/* Expense Leaks Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Expense Leaks
            </p>
            <p data-testid="leak-count" className="text-4xl font-extrabold text-gray-900">
              {expenseLeaks.count > 0 ? expenseLeaks.count : "—"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {expenseLeaks.count > 0
                ? `${expenseLeaks.count} recurring charge${expenseLeaks.count !== 1 ? "s" : ""} marked as leaks`
                : "No leaks flagged yet"}
            </p>
            {expenseLeaks.monthlyAmount > 0 && (
              <p className="text-sm text-red-500 font-semibold mt-1">
                ~{currency(expenseLeaks.monthlyAmount / Math.max(1, totals.periodDays / 30))}/mo in recurring charges
              </p>
            )}
          </div>
          <Link
            href="/leaks"
            data-testid="link-review-leaks"
            className="mt-4 block text-center text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors"
          >
            Review Recurring →
          </Link>
        </Card>
      </div>

      {/* ── Row 2: 4 KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard
          label="Total Income"
          value={currencyShort(totals.totalInflow)}
          sub={`${period} total`}
          accent="green"
          data-testid="kpi-total-income"
        />
        <KpiCard
          label="Total Spending"
          value={currencyShort(totals.totalOutflow)}
          sub={`${period} total`}
          accent="red"
          data-testid="kpi-total-spending"
        />
        <KpiCard
          label="Recurring Income"
          value={currencyShort(totals.recurringIncome)}
          sub="Baseline revenue"
          accent="green"
          data-testid="kpi-recurring-income"
        />
        <KpiCard
          label="Recurring Expenses"
          value={currencyShort(totals.recurringExpenses)}
          sub="Baseline costs"
          accent="red"
          data-testid="kpi-recurring-expenses"
        />
      </div>

      {/* ── Row 3: 3 KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard
          label="One-Time Income"
          value={currencyShort(totals.oneTimeIncome)}
          sub="Non-recurring revenue"
          accent="blue"
          data-testid="kpi-one-time-income"
        />
        <KpiCard
          label="One-Time Expenses"
          value={currencyShort(totals.oneTimeExpenses)}
          sub="Non-recurring costs"
          accent="neutral"
          data-testid="kpi-one-time-expenses"
        />
        <KpiCard
          label="Discretionary Spend"
          value={currencyShort(totals.discretionarySpend)}
          sub={`${period} — dining, coffee, delivery…`}
          accent="neutral"
          data-testid="kpi-discretionary-spend"
        />
      </div>

      {/* ── Row 4: Monthly baselines ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <KpiCard
          label="Utilities / Month"
          value={currency(totals.utilitiesMonthly)}
          sub={`${period} avg`}
          accent="neutral"
          data-testid="kpi-utilities-monthly"
        />
        <KpiCard
          label="Software & Subscriptions / Month"
          value={currency(totals.softwareMonthly)}
          sub={`${period} avg`}
          accent="neutral"
          data-testid="kpi-software-monthly"
        />
      </div>

      {/* ── Row 5: Spending by category + Monthly trend ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="app-placeholder">No outflow transactions.</p>
          ) : (
            <ul className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <li key={cat.category} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-gray-600 capitalize truncate">
                    {capitalize(cat.category)}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: pct(cat.total, totalSpending) }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right shrink-0">
                    {currency(cat.total)}
                  </span>
                  <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                    {pct(cat.total, totalSpending)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Trend</h2>
          {monthlyTrend.length === 0 ? (
            <p className="app-placeholder">No monthly data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 pb-2">Month</th>
                    <th className="text-right text-xs font-semibold text-gray-500 pb-2">Income</th>
                    <th className="text-right text-xs font-semibold text-gray-500 pb-2">Spending</th>
                    <th className="text-right text-xs font-semibold text-gray-500 pb-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTrend.map((m) => (
                    <tr key={m.month} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-700 text-xs">{m.month}</td>
                      <td className="py-2 text-right text-xs font-medium text-emerald-600">
                        {currency(m.inflow)}
                      </td>
                      <td className="py-2 text-right text-xs font-medium text-red-500">
                        {currency(m.outflow)}
                      </td>
                      <td
                        className={`py-2 text-right text-xs font-bold ${m.net >= 0 ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {currency(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 6: Recent Transactions ────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Recent Transactions</h2>
          <Link
            href="/transactions"
            data-testid="link-view-all-transactions"
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 pb-2">Date</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2">Merchant</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-2">Category</th>
                <th className="text-right text-xs font-semibold text-gray-500 pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((txn) => {
                const n = parseFloat(txn.amount);
                return (
                  <tr key={txn.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-xs text-gray-500">{txn.date}</td>
                    <td className="py-2 text-xs text-gray-800 max-w-[160px] truncate">{txn.merchant}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                        {txn.category}
                      </span>
                    </td>
                    <td
                      className={`py-2 text-right text-xs font-semibold ${n >= 0 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {currency(n)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
