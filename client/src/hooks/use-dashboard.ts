import { useQuery } from "@tanstack/react-query";

export const dashboardSummaryQueryKey = ["/api/dashboard-summary"] as const;

export type DashboardSummary = {
  totals: {
    totalInflow: number;
    totalOutflow: number;
    netCashflow: number;
    transactionCount: number;
    recurringIncome: number;
    recurringExpenses: number;
    oneTimeIncome: number;
    oneTimeExpenses: number;
    discretionarySpend: number;
    safeToSpend: number;
    utilitiesMonthly: number;
    softwareMonthly: number;
    periodDays: number;
  };
  expenseLeaks: {
    count: number;
    monthlyAmount: number;
  };
  categoryBreakdown: Array<{
    category: string;
    total: number;
    count: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
  recentTransactions: Array<{
    id: number;
    date: string;
    merchant: string;
    amount: string;
    category: string;
    transactionClass: string;
  }>;
  accountCount: number;
};

export type PeriodPreset = "30D" | "60D" | "90D";

export const PERIOD_DAYS: Record<PeriodPreset, number> = {
  "30D": 30,
  "60D": 60,
  "90D": 90,
};

export type DashboardFilters = {
  period?: PeriodPreset;
  dateFrom?: string;
  dateTo?: string;
};

function presetToRange(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - PERIOD_DAYS[preset]);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
}

export function useDashboardSummary(filters?: DashboardFilters) {
  const range = filters?.period
    ? presetToRange(filters.period)
    : { dateFrom: filters?.dateFrom, dateTo: filters?.dateTo };

  return useQuery<DashboardSummary>({
    queryKey: [...dashboardSummaryQueryKey, filters],
    staleTime: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range.dateFrom) params.set("dateFrom", range.dateFrom);
      if (range.dateTo) params.set("dateTo", range.dateTo);
      const qs = params.toString();
      const url = `/api/dashboard-summary${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });
}
