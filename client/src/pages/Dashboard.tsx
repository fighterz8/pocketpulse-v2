import { Link } from "wouter";

import { useDashboardSummary } from "../hooks/use-dashboard";

function formatCurrency(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

function formatPct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function KpiCard({
  label,
  value,
  borderClass,
  valueClassName,
}: {
  label: string;
  value: string;
  borderClass: string;
  valueClassName?: string;
}) {
  return (
    <div className={`dash-kpi ${borderClass}`}>
      <div className="dash-kpi-label">{label}</div>
      <div
        className={
          valueClassName
            ? `dash-kpi-value ${valueClassName}`
            : "dash-kpi-value"
        }
      >
        {value}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data, isLoading, error } = useDashboardSummary();

  if (isLoading) {
    return (
      <>
        <h1 className="app-page-title">Dashboard</h1>
        <p className="app-placeholder">Loading dashboard…</p>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="app-page-title">Dashboard</h1>
        <p className="app-placeholder">Error loading dashboard.</p>
      </>
    );
  }

  if (!data || data.totals.transactionCount === 0) {
    return (
      <>
        <h1 className="app-page-title">Dashboard</h1>
        <div className="dash-empty">
          <p>No transaction data yet.</p>
          <Link href="/upload" className="dash-empty-link">
            Upload your first CSV →
          </Link>
        </div>
      </>
    );
  }

  const { totals, categoryBreakdown, monthlyTrend, recentTransactions } = data;
  const totalSpending = categoryBreakdown.reduce((s, c) => s + c.total, 0);

  return (
    <>
      <h1 className="app-page-title">Dashboard</h1>

      <div className="dash-kpi-row">
        <KpiCard
          label="Total Income"
          value={formatCurrency(totals.totalInflow)}
          borderClass="dash-kpi--inflow"
          valueClassName="ledger-amount--inflow"
        />
        <KpiCard
          label="Total Spending"
          value={formatCurrency(totals.totalOutflow)}
          borderClass="dash-kpi--outflow"
          valueClassName="ledger-amount--outflow"
        />
        <KpiCard
          label="Net Cashflow"
          value={formatCurrency(totals.netCashflow)}
          borderClass="dash-kpi--net"
          valueClassName={
            totals.netCashflow >= 0
              ? "ledger-amount--inflow"
              : "ledger-amount--outflow"
          }
        />
        <KpiCard
          label="Transactions"
          value={totals.transactionCount.toLocaleString()}
          borderClass="dash-kpi--net"
        />
      </div>

      <div className="dash-grid">
        <section className="dash-section dash-card">
          <h2 className="dash-section-title">Spending by Category</h2>
          {categoryBreakdown.length === 0 ? (
            <p className="app-placeholder">No outflow transactions.</p>
          ) : (
            <ul className="dash-category-list">
              {categoryBreakdown.map((cat) => (
                <li key={cat.category} className="dash-category-item">
                  <span className="dash-category-name">{cat.category}</span>
                  <span className="dash-category-bar-track">
                    <span
                      className="dash-category-bar-fill"
                      style={{ width: formatPct(cat.total, totalSpending) }}
                    />
                  </span>
                  <span className="dash-category-amount ledger-amount--outflow">
                    {formatCurrency(cat.total)}
                  </span>
                  <span className="dash-category-pct">
                    {formatPct(cat.total, totalSpending)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-section dash-card">
          <h2 className="dash-section-title">Monthly Trend</h2>
          {monthlyTrend.length === 0 ? (
            <p className="app-placeholder">No monthly data.</p>
          ) : (
            <table className="dash-trend-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="dash-trend-num">Income</th>
                  <th className="dash-trend-num">Spending</th>
                  <th className="dash-trend-num">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTrend.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className="dash-trend-num ledger-amount--inflow">
                      {formatCurrency(m.inflow)}
                    </td>
                    <td className="dash-trend-num ledger-amount--outflow">
                      {formatCurrency(m.outflow)}
                    </td>
                    <td
                      className={`dash-trend-num ${m.net >= 0 ? "ledger-amount--inflow" : "ledger-amount--outflow"}`}
                    >
                      {formatCurrency(m.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="dash-section dash-card">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Recent Transactions</h2>
          <Link href="/transactions" className="dash-view-all">
            View all →
          </Link>
        </div>
        <table className="dash-recent-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Category</th>
              <th className="dash-trend-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((txn) => {
              const n = parseFloat(txn.amount);
              return (
                <tr key={txn.id}>
                  <td>{txn.date}</td>
                  <td>{txn.merchant}</td>
                  <td>
                    <span className="dash-cat-badge">{txn.category}</span>
                  </td>
                  <td
                    className={`dash-trend-num ${n >= 0 ? "ledger-amount--inflow" : "ledger-amount--outflow"}`}
                  >
                    {formatCurrency(n)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
