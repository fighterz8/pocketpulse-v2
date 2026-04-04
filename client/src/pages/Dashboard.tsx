import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";

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

// ─── Animation variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.07, ease: [0.25, 0, 0, 1] as [number, number, number, number] },
  }),
};

// ─── Glass Card ──────────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`glass-card ${className}`}
    >
      {children}
    </motion.div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent = "neutral",
  "data-testid": testId,
  index = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "blue" | "neutral";
  "data-testid"?: string;
  index?: number;
}) {
  const colorMap = {
    green: "text-emerald-600",
    red: "text-red-500",
    blue: "text-blue-600",
    neutral: "text-slate-800",
  };
  return (
    <GlassCard index={index}>
      <p className="kpi-label">{label}</p>
      <p data-testid={testId} className={`kpi-value ${colorMap[accent]}`}>{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </GlassCard>
  );
}

function safeToSpendStatus(safeToSpend: number, income: number): {
  label: string;
  badge: string;
} {
  if (income === 0) return { label: "No income data", badge: "badge-neutral" };
  if (safeToSpend > income * 0.2) return { label: "Healthy buffer", badge: "badge-green" };
  if (safeToSpend > 0) return { label: "Tight but positive", badge: "badge-yellow" };
  if (safeToSpend > -income * 0.2) return { label: "Slightly over", badge: "badge-orange" };
  return { label: "Over budget", badge: "badge-red" };
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Dashboard() {
  const [period, setPeriod] = useState<PeriodPreset>("90D");
  const { data, isLoading, error } = useDashboardSummary({ period });

  const periods: PeriodPreset[] = ["30D", "60D", "90D"];

  const headerRow = (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      custom={0}
      className="flex items-center justify-between mb-6"
    >
      <div>
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Cashflow overview for your business</p>
      </div>
      <div
        className="period-selector"
        data-testid="period-selector"
      >
        {periods.map((p) => (
          <button
            key={p}
            data-testid={`period-btn-${p}`}
            onClick={() => setPeriod(p)}
            className={`period-btn ${period === p ? "period-btn--active" : ""}`}
          >
            {p}
          </button>
        ))}
      </div>
    </motion.div>
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
        <GlassCard index={1} className="dash-empty-card">
          <p className="dash-empty-msg">No transaction data yet.</p>
          <Link href="/upload" className="dash-empty-link" data-testid="link-upload-first">
            Upload your first CSV →
          </Link>
        </GlassCard>
      </div>
    );
  }

  const { totals, expenseLeaks, categoryBreakdown, monthlyTrend, recentTransactions } = data;
  const totalSpending = categoryBreakdown.reduce((s, c) => s + c.total, 0);
  const safeToSpend = totals.safeToSpend;
  const spendStatus = safeToSpendStatus(safeToSpend, totals.recurringIncome);
  const safeColor = safeToSpend > 0
    ? "text-emerald-600"
    : safeToSpend > -totals.recurringIncome * 0.2
    ? "text-orange-500"
    : "text-red-500";

  const recurringRatio = totals.recurringIncome > 0
    ? Math.min(100, (totals.recurringExpenses / Math.max(totals.recurringIncome, totals.recurringExpenses)) * 100)
    : 0;

  return (
    <div>
      {headerRow}

      {/* ── Row 1: Safe-to-Spend Hero + Expense Leaks ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Safe-to-Spend Hero */}
        <GlassCard className="lg:col-span-2" index={1}>
          <p className="kpi-label">Safe-to-Spend Estimate</p>
          <p
            data-testid="safe-to-spend-value"
            className={`dash-hero-value ${safeColor}`}
          >
            {currency(safeToSpend)}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`dash-badge ${spendStatus.badge}`}>
              {spendStatus.label}
            </span>
            <span className="text-xs text-slate-400">
              Recurring income minus recurring expenses · last {period}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Recurring expenses</span>
              <span>Recurring income</span>
            </div>
            <div className="h-2 bg-blue-50 rounded-full overflow-hidden border border-blue-100">
              {totals.recurringIncome > 0 && (
                <div
                  className={`h-full rounded-full transition-all ${safeToSpend >= 0 ? "bg-emerald-500" : "bg-red-400"}`}
                  style={{ width: `${recurringRatio}%` }}
                />
              )}
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className="text-red-500 font-semibold">{currency(totals.recurringExpenses)}</span>
              <span className="text-emerald-600 font-semibold">{currency(totals.recurringIncome)}</span>
            </div>
          </div>
        </GlassCard>

        {/* Expense Leaks */}
        <GlassCard className="flex flex-col justify-between" index={2}>
          <div>
            <p className="kpi-label">Expense Leaks</p>
            <p data-testid="leak-count" className="dash-hero-value text-slate-900">
              {expenseLeaks.count > 0 ? expenseLeaks.count : "—"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
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
            className="dash-leaks-link"
          >
            Review Recurring →
          </Link>
        </GlassCard>
      </div>

      {/* ── Row 2: 4 KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard label="Total Income" value={currencyShort(totals.totalInflow)} sub={`${period} total`} accent="green" data-testid="kpi-total-income" index={3} />
        <KpiCard label="Total Spending" value={currencyShort(totals.totalOutflow)} sub={`${period} total`} accent="red" data-testid="kpi-total-spending" index={4} />
        <KpiCard label="Recurring Income" value={currencyShort(totals.recurringIncome)} sub="Baseline revenue" accent="green" data-testid="kpi-recurring-income" index={5} />
        <KpiCard label="Recurring Expenses" value={currencyShort(totals.recurringExpenses)} sub="Baseline costs" accent="red" data-testid="kpi-recurring-expenses" index={6} />
      </div>

      {/* ── Row 3: 3 KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard label="One-Time Income" value={currencyShort(totals.oneTimeIncome)} sub="Non-recurring revenue" accent="blue" data-testid="kpi-one-time-income" index={7} />
        <KpiCard label="One-Time Expenses" value={currencyShort(totals.oneTimeExpenses)} sub="Non-recurring costs" accent="neutral" data-testid="kpi-one-time-expenses" index={8} />
        <KpiCard label="Discretionary Spend" value={currencyShort(totals.discretionarySpend)} sub={`${period} — dining, coffee, delivery…`} accent="neutral" data-testid="kpi-discretionary-spend" index={9} />
      </div>

      {/* ── Row 4: Monthly baselines ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <KpiCard label="Utilities / Month" value={currency(totals.utilitiesMonthly)} sub={`${period} avg`} accent="neutral" data-testid="kpi-utilities-monthly" index={10} />
        <KpiCard label="Software & Subscriptions / Month" value={currency(totals.softwareMonthly)} sub={`${period} avg`} accent="neutral" data-testid="kpi-software-monthly" index={11} />
      </div>

      {/* ── Row 5: Spending by category + Monthly trend ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <GlassCard index={12}>
          <h2 className="glass-section-title mb-4">Spending by Category</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="app-placeholder">No outflow transactions.</p>
          ) : (
            <ul className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <li key={cat.category} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-slate-600 capitalize truncate">
                    {capitalize(cat.category)}
                  </span>
                  <div className="flex-1 h-1.5 bg-blue-50 rounded-full overflow-hidden border border-blue-100">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: pct(cat.total, totalSpending) }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-20 text-right shrink-0">
                    {currency(cat.total)}
                  </span>
                  <span className="text-xs text-slate-400 w-10 text-right shrink-0">
                    {pct(cat.total, totalSpending)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard index={13}>
          <h2 className="glass-section-title mb-4">Monthly Trend</h2>
          {monthlyTrend.length === 0 ? (
            <p className="app-placeholder">No monthly data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-400 pb-2">Month</th>
                    <th className="text-right text-xs font-semibold text-slate-400 pb-2">Income</th>
                    <th className="text-right text-xs font-semibold text-slate-400 pb-2">Spending</th>
                    <th className="text-right text-xs font-semibold text-slate-400 pb-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTrend.map((m) => (
                    <tr key={m.month} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 text-slate-600 text-xs">{m.month}</td>
                      <td className="py-2 text-right text-xs font-medium text-emerald-600">{currency(m.inflow)}</td>
                      <td className="py-2 text-right text-xs font-medium text-red-500">{currency(m.outflow)}</td>
                      <td className={`py-2 text-right text-xs font-bold ${m.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {currency(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ── Row 6: Recent Transactions ────────────────────────────────── */}
      <GlassCard index={14} className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="glass-section-title">Recent Transactions</h2>
          <Link href="/transactions" data-testid="link-view-all-transactions" className="text-xs text-blue-600 font-medium hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-400 pb-2">Date</th>
                <th className="text-left text-xs font-semibold text-slate-400 pb-2">Merchant</th>
                <th className="text-left text-xs font-semibold text-slate-400 pb-2">Category</th>
                <th className="text-right text-xs font-semibold text-slate-400 pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((txn) => {
                const n = parseFloat(txn.amount);
                return (
                  <tr key={txn.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-xs text-slate-400">{txn.date}</td>
                    <td className="py-2 text-xs text-slate-700 max-w-[160px] truncate">{txn.merchant}</td>
                    <td className="py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                        {txn.category}
                      </span>
                    </td>
                    <td className={`py-2 text-right text-xs font-semibold ${n >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {currency(n)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ── Tech-stack footer ──────────────────────────────────────────── */}
      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={15}
        className="dash-tech-footer"
      >
        React · TailwindCSS · Framer Motion · Chart.js · Glass UI
      </motion.p>
    </div>
  );
}
