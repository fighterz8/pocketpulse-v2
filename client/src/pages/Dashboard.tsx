import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, TrendingUp, RefreshCcw, Download, Upload, ListChecks } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useMemo, useState } from "react";

interface CashflowSummary {
  totalInflows: number;
  totalOutflows: number;
  recurringIncome: number;
  recurringExpenses: number;
  oneTimeIncome: number;
  oneTimeExpenses: number;
  safeToSpend: number;
  netCashflow: number;
  utilitiesBaseline: number;
  subscriptionsBaseline: number;
  discretionarySpend: number;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const LEDGER_DRILLDOWN_KEY = "ledger-drilldown";
const METRIC_FILTERS: Record<string, Record<string, string>> = {
  totalInflows: {
    transactionClass: "income",
  },
  totalOutflows: {
    transactionClass: "expense",
  },
  recurringIncome: {
    transactionClass: "income",
    recurrenceType: "recurring",
  },
  recurringExpenses: {
    transactionClass: "expense",
    recurrenceType: "recurring",
  },
  oneTimeIncome: {
    transactionClass: "income",
    recurrenceType: "one-time",
  },
  oneTimeExpenses: {
    transactionClass: "expense",
    recurrenceType: "one-time",
  },
  safeToSpend: {
    transactionClass: "income,expense",
    recurrenceType: "recurring",
  },
  netCashflow: {
    transactionClass: "income,expense",
  },
  utilitiesBaseline: {
    transactionClass: "expense",
    category: "utilities",
  },
  subscriptionsBaseline: {
    transactionClass: "expense",
    category: "subscriptions,business_software",
  },
  discretionarySpend: {
    transactionClass: "expense",
    category: "dining,shopping,entertainment",
  },
};

export default function Dashboard() {
  const [days, setDays] = useState(90);
  const cashflowUrl = useMemo(() => `/api/cashflow?days=${days}`, [days]);

  const { data: cashflow, isLoading: cfLoading } = useQuery<CashflowSummary>({
    queryKey: [cashflowUrl],
  });

  const handleExport = () => {
    window.open(`/api/export/summary?days=${days}`, "_blank");
  };

  const metricHref = (metric: string) => {
    const params = new URLSearchParams({
      metric,
      days: String(days),
      ...METRIC_FILTERS[metric],
    });
    return `/transactions?${params.toString()}`;
  };

  const openMetricLedger = (metric: string) => {
    const href = metricHref(metric);
    const parsedHref = new URL(href, window.location.origin);
    window.sessionStorage.setItem(
      LEDGER_DRILLDOWN_KEY,
      JSON.stringify({
        metric,
        days: String(days),
        ...METRIC_FILTERS[metric],
      }),
    );
    window.location.href = parsedHref.pathname + parsedHref.search;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">A simple view of income, expenses, and monthly spending room for the selected window.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/upload">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Upload Data
            </Button>
          </Link>
          <Link href="/transactions">
            <Button variant="outline">
              <ListChecks className="mr-2 h-4 w-4" />
              Review Transactions
            </Button>
          </Link>
          <div className="flex items-center gap-2 rounded-md border bg-background p-1">
            {[30, 60, 90].map((windowDays) => (
              <Button
                key={windowDays}
                variant={days === windowDays ? "default" : "ghost"}
                size="sm"
                onClick={() => setDays(windowDays)}
                data-testid={`button-window-${windowDays}`}
              >
                {windowDays}D
              </Button>
            ))}
          </div>
          <Button variant="outline" onClick={handleExport} data-testid="button-export">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className="md:col-span-2 border-primary/20 shadow-sm transition-colors hover:border-primary/40 cursor-pointer"
          onClick={() => {
            openMetricLedger("safeToSpend");
          }}
        >
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-sm">Safe-to-Spend Estimate</CardDescription>
            {cfLoading ? (
              <Skeleton className="h-12 w-48" />
            ) : (
              <CardTitle className="text-4xl md:text-5xl text-primary font-bold tracking-tight" data-testid="text-safe-to-spend">
                {fmt(cashflow?.safeToSpend ?? 0)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm mt-2 text-muted-foreground">
              <Link href={metricHref("netCashflow")}>
                <span
                  className="flex items-center font-medium bg-primary/10 text-primary px-2 py-0.5 rounded mr-2 hover:bg-primary/15"
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    openMetricLedger("netCashflow");
                  }}
                >
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Net: {fmt(cashflow?.netCashflow ?? 0)}
                </span>
              </Link>
              Based on the last {days} days of recurring income minus recurring expenses.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-sm">How This Dashboard Works</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight mt-1">
              Three simple steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Upload a CSV export from a bank or accounting tool.</p>
            <p>2. The app stores each transaction and suggests categories automatically.</p>
            <p>3. The dashboard summarizes income, expenses, and safe to spend.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Income" value={cashflow?.totalInflows} href={metricHref("totalInflows")} icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />} loading={cfLoading} testId="text-total-inflows" />
        <SummaryCard label="Total Expenses" value={cashflow?.totalOutflows} href={metricHref("totalOutflows")} icon={<ArrowDownRight className="h-4 w-4 text-destructive" />} loading={cfLoading} testId="text-total-outflows" />
        <SummaryCard label="Recurring Income" value={cashflow?.recurringIncome} href={metricHref("recurringIncome")} icon={<RefreshCcw className="h-4 w-4 text-emerald-500 opacity-70" />} loading={cfLoading} sub="Monthly baseline" testId="text-recurring-income" />
        <SummaryCard label="Recurring Expenses" value={cashflow?.recurringExpenses} href={metricHref("recurringExpenses")} icon={<RefreshCcw className="h-4 w-4 text-destructive opacity-70" />} loading={cfLoading} sub="Monthly baseline" testId="text-recurring-expenses" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard label="One-time Income" value={cashflow?.oneTimeIncome} href={metricHref("oneTimeIncome")} icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />} loading={cfLoading} testId="text-onetime-income" />
        <SummaryCard label="One-time Expenses" value={cashflow?.oneTimeExpenses} href={metricHref("oneTimeExpenses")} icon={<ArrowDownRight className="h-4 w-4 text-destructive" />} loading={cfLoading} testId="text-onetime-expenses" />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Plain-English Explanations</CardTitle>
          <CardDescription>Each core feature is meant to be easy to explain to a non-technical audience.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="font-medium">Upload data</p>
            <p className="mt-1 text-sm text-muted-foreground">The user imports a CSV file so the app has business transactions to work with.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Categorize transactions</p>
            <p className="mt-1 text-sm text-muted-foreground">The app suggests labels like income, utilities, or subscriptions using simple matching rules.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Review transactions</p>
            <p className="mt-1 text-sm text-muted-foreground">The user can inspect rows and correct any category or recurrence values that look wrong.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium">Safe to spend</p>
            <p className="mt-1 text-sm text-muted-foreground">Recurring income minus recurring expenses, shown as a monthly spending cushion.</p>
          </div>
        </CardContent>
      </Card>

      {!cfLoading && cashflow?.totalInflows === 0 && cashflow?.totalOutflows === 0 && (
        <Card className="shadow-sm border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No transaction data yet. Upload a CSV to get started.</p>
            <Link href="/upload">
              <Button data-testid="button-go-upload">Upload CSV</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value, href, icon, loading, sub, testId }: { label: string; value?: number; href: string; icon: React.ReactNode; loading: boolean; sub?: string; testId: string }) {
  return (
    <Card
      className="shadow-sm transition-colors hover:border-primary/30 cursor-pointer"
      onClick={() => {
        const metric = new URL(href, window.location.origin).searchParams.get("metric");
        const days = new URL(href, window.location.origin).searchParams.get("days");
        if (metric) {
          window.sessionStorage.setItem(
            LEDGER_DRILLDOWN_KEY,
            JSON.stringify({
              metric,
              days,
            }),
          );
        }
        window.location.href = href;
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : (
          <div className="text-2xl font-bold" data-testid={testId}>{fmt(value ?? 0)}</div>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
