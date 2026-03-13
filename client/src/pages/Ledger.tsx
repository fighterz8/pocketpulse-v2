import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, ArrowDownRight, ArrowUpRight, Clock, CalendarDays, Download, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Transaction {
  id: number;
  date: string;
  rawDescription: string;
  merchant: string;
  amount: string;
  flowType: string;
  transactionClass: string;
  recurrenceType: string;
  category: string;
  labelSource: "rule" | "llm" | "manual";
  labelConfidence: string | null;
  labelReason: string | null;
  aiAssisted: boolean;
  userCorrected: boolean;
  accountId: number;
}

interface Account {
  id: number;
  name: string;
  lastFour: string | null;
}

interface TransactionPage {
  rows: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  metric?: string;
  metricLabel?: string;
  metricDescription?: string;
  metricTotal?: number;
}

const CATEGORY_OPTIONS = [
  "income",
  "transfers",
  "utilities",
  "subscriptions",
  "insurance",
  "housing",
  "groceries",
  "transportation",
  "dining",
  "shopping",
  "health",
  "debt",
  "business_software",
  "entertainment",
  "fees",
  "other",
];
const LEDGER_DRILLDOWN_KEY = "ledger-drilldown";
function normalizeLedgerSearch(search: string): string {
  const params = new URLSearchParams(search);
  const hasQueryFilters = [
    "search",
    "accountId",
    "page",
    "category",
    "startDate",
    "endDate",
    "metric",
    "merchant",
    "transactionClass",
    "recurrenceType",
    "days",
  ].some((key) => params.has(key));

  if (!hasQueryFilters) {
    const storedValue = window.sessionStorage.getItem(LEDGER_DRILLDOWN_KEY);
    if (storedValue) {
      try {
        const stored = JSON.parse(storedValue) as Partial<Record<string, string>>;
        for (const [key, value] of Object.entries(stored)) {
          if (value) {
            params.set(key, value);
          }
        }
      } catch {
        // Ignore malformed drilldown payloads.
      } finally {
        window.sessionStorage.removeItem(LEDGER_DRILLDOWN_KEY);
      }
    }
  } else {
    window.sessionStorage.removeItem(LEDGER_DRILLDOWN_KEY);
  }

  return params.toString();
}

function parseLedgerUrlState(search: string) {
  const params = new URLSearchParams(search);
  return {
    search: params.get("search") ?? "",
    accountId: params.get("accountId") ?? "all",
    page: parseInt(params.get("page") || "1", 10) || 1,
    category: params.get("category") ?? "all",
    startDate: params.get("startDate") ?? "",
    endDate: params.get("endDate") ?? "",
    metric: params.get("metric") ?? "",
    merchant: params.get("merchant") ?? "",
    transactionClass: params.get("transactionClass") ?? "",
    recurrenceType: params.get("recurrenceType") ?? "",
    days: params.get("days") ?? "",
  };
}

function getVisiblePages(currentPage: number, totalPages: number): Array<number | "ellipsis-left" | "ellipsis-right"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis-right", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis-left", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages];
}

function TransactionTable({ transactions, updateMutation }: { transactions: Transaction[]; updateMutation: any }) {
  if (transactions.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        No transactions in this account yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead className="w-[200px]">Merchant / Desc</TableHead>
            <TableHead className="w-[120px] text-right">Amount</TableHead>
            <TableHead className="w-[140px]">Classification</TableHead>
            <TableHead className="w-[150px]">Category</TableHead>
            <TableHead className="w-[140px]">Recurrence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="group hover:bg-muted/10">
              <TableCell className="font-medium text-xs whitespace-nowrap">{tx.date}</TableCell>
              <TableCell>
                <div className="font-medium text-sm flex items-center">
                  {tx.merchant}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {tx.labelSource === "manual" && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">
                      Manual review
                    </Badge>
                  )}
                  {tx.userCorrected && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Protected</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5" title={tx.rawDescription}>
                  {tx.rawDescription}
                </div>
                {tx.labelReason && tx.labelSource === "manual" && (
                  <div className="text-[11px] text-muted-foreground mt-1 truncate max-w-[220px]" title={tx.labelReason}>
                    {tx.labelReason}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className={`font-semibold ${tx.flowType === "inflow" ? "text-emerald-600" : ""}`}>
                  {tx.flowType === "inflow" ? "+" : ""}
                  {parseFloat(tx.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  defaultValue={tx.transactionClass}
                  onValueChange={(val) => updateMutation.mutate({ id: tx.id, data: { transactionClass: val } })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`select-class-${tx.id}`}>
                    <div className="flex items-center gap-1.5">
                      {tx.transactionClass === "income" ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> :
                       tx.transactionClass === "expense" ? <ArrowDownRight className="w-3 h-3 text-destructive" /> : null}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  defaultValue={tx.category}
                  onValueChange={(val) => updateMutation.mutate({ id: tx.id, data: { category: val } })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`select-category-${tx.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  defaultValue={tx.recurrenceType}
                  onValueChange={(val) => updateMutation.mutate({ id: tx.id, data: { recurrenceType: val } })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`select-recurrence-${tx.id}`}>
                    <div className="flex items-center gap-1.5">
                      {tx.recurrenceType === "recurring" ? <Clock className="w-3 h-3 text-primary" /> :
                       <CalendarDays className="w-3 h-3 text-muted-foreground" />}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Ledger() {
  const { toast } = useToast();
  const [normalizedSearch, setNormalizedSearch] = useState(() => normalizeLedgerSearch(window.location.search));
  const initialUrlState = useMemo(() => parseLedgerUrlState(normalizedSearch), [normalizedSearch]);
  const [searchTerm, setSearchTerm] = useState(initialUrlState.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialUrlState.search);
  const [activeTab, setActiveTab] = useState(initialUrlState.accountId);
  const [page, setPage] = useState(initialUrlState.page);
  const [categoryFilter, setCategoryFilter] = useState(initialUrlState.category);
  const [startDateFilter, setStartDateFilter] = useState(initialUrlState.startDate);
  const [endDateFilter, setEndDateFilter] = useState(initialUrlState.endDate);
  const pageSize = 50;
  const urlState = useMemo(() => parseLedgerUrlState(normalizedSearch), [normalizedSearch]);
  const metricFilter = urlState.metric;
  const merchantFilter = urlState.merchant;
  const transactionClassFilter = urlState.transactionClass;
  const recurrenceTypeFilter = urlState.recurrenceType;
  const daysFilter = urlState.days;

  useEffect(() => {
    const nextSearch = normalizeLedgerSearch(window.location.search);
    if (nextSearch !== normalizedSearch) {
      const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname;
      window.history.replaceState({}, "", nextUrl);
      setNormalizedSearch(nextSearch);
    }
  }, [normalizedSearch]);

  useEffect(() => {
    setSearchTerm(urlState.search);
    setDebouncedSearch(urlState.search);
    setActiveTab(urlState.accountId);
    setPage(urlState.page);
    setCategoryFilter(urlState.category);
    setStartDateFilter(urlState.startDate);
    setEndDateFilter(urlState.endDate);
  }, [urlState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab, categoryFilter, startDateFilter, endDateFilter]);

  const transactionUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    if (activeTab !== "all") {
      params.set("accountId", activeTab);
    }

    if (categoryFilter !== "all") {
      params.set("category", categoryFilter);
    }

    if (merchantFilter) {
      params.set("merchant", merchantFilter);
    }

    if (transactionClassFilter) {
      params.set("transactionClass", transactionClassFilter);
    }

    if (recurrenceTypeFilter) {
      params.set("recurrenceType", recurrenceTypeFilter);
    }

    if (daysFilter) {
      params.set("days", daysFilter);
    }

    if (startDateFilter) {
      params.set("startDate", startDateFilter);
    }

    if (endDateFilter) {
      params.set("endDate", endDateFilter);
    }

    if (metricFilter) {
      params.set("metric", metricFilter);
    }

    return `/api/transactions?${params.toString()}`;
  }, [activeTab, categoryFilter, debouncedSearch, daysFilter, endDateFilter, merchantFilter, metricFilter, page, recurrenceTypeFilter, startDateFilter, transactionClassFilter]);

  const { data: transactionPage, isLoading } = useQuery<TransactionPage>({
    queryKey: [transactionUrl],
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/transactions/${id}`, data);
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/transactions"),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/cashflow"),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/leaks"),
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/analysis"),
          refetchType: "all",
        }),
      ]);
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const transactions = transactionPage?.rows ?? [];
  const totalCount = transactionPage?.totalCount ?? 0;
  const totalPages = transactionPage?.totalPages ?? 1;
  const visiblePages = getVisiblePages(page, totalPages);
  const firstRowNumber = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRowNumber = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  const handleExportTransactions = () => {
    const params = new URLSearchParams(transactionUrl.split("?")[1] ?? "");
    params.delete("page");
    params.delete("pageSize");
    window.open(`/api/export/transactions?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted-foreground mt-1">Review imported transactions, search the ledger, and correct categories or recurrence values.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 text-xs">
            Editable after import
          </Badge>
          <Button variant="outline" size="sm" onClick={handleExportTransactions} data-testid="button-export-transactions">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/10">
          <div className="grid w-full gap-4 lg:grid-cols-4">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search merchants or descriptions..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              data-testid="input-ledger-start-date"
            />
            <Input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              data-testid="input-ledger-end-date"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full" data-testid="select-ledger-category-filter">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(metricFilter || merchantFilter || transactionClassFilter || recurrenceTypeFilter || daysFilter || categoryFilter !== "all" || startDateFilter || endDateFilter) && (
          <div className="px-4 py-3 border-b bg-muted/5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Active filters:</span>
            {transactionPage?.metricLabel && <Badge variant="secondary">Metric: {transactionPage.metricLabel}</Badge>}
            {merchantFilter && <Badge variant="secondary">Merchant: {merchantFilter}</Badge>}
            {transactionClassFilter && <Badge variant="secondary">Class: {transactionClassFilter}</Badge>}
            {recurrenceTypeFilter && <Badge variant="secondary">Recurrence: {recurrenceTypeFilter}</Badge>}
            {daysFilter && <Badge variant="secondary">Window: {daysFilter}D</Badge>}
            {startDateFilter && <Badge variant="secondary">From: {startDateFilter}</Badge>}
            {endDateFilter && <Badge variant="secondary">To: {endDateFilter}</Badge>}
            {categoryFilter !== "all" && <Badge variant="secondary">Category: {categoryFilter.replace(/_/g, " ")}</Badge>}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                setSearchTerm("");
                setDebouncedSearch("");
                setCategoryFilter("all");
                setStartDateFilter("");
                setEndDateFilter("");
                window.location.href = "/transactions";
              }}
              data-testid="button-clear-ledger-filters"
            >
              Clear filters
            </Button>
          </div>
        )}

        {transactionPage?.metricLabel && (
          <div className="px-4 py-3 border-b bg-primary/5 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">{transactionPage.metricLabel}</p>
                {transactionPage.metricDescription && (
                  <p className="text-xs text-muted-foreground">{transactionPage.metricDescription}</p>
                )}
              </div>
              <div className="text-sm font-semibold text-primary">
                Metric total: {(transactionPage.metricTotal ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-4 pt-3 border-b bg-muted/5">
              <TabsList className="bg-transparent h-auto p-0 gap-0">
                <TabsTrigger
                  value="all"
                  className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2"
                  data-testid="tab-all-accounts"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  All Accounts
                </TabsTrigger>
                {accounts.map((acc) => (
                  <TabsTrigger
                    key={acc.id}
                    value={acc.id.toString()}
                    className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2"
                    data-testid={`tab-account-${acc.id}`}
                  >
                    {acc.name}
                    {acc.lastFour && <span className="text-muted-foreground ml-1">...{acc.lastFour}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="mt-0">
              {transactions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  {totalCount === 0 ? "No matching transactions found." : "No transactions on this page."}
                </div>
              ) : (
                <TransactionTable transactions={transactions} updateMutation={updateMutation} />
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="p-4 border-t flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground bg-muted/10">
          <div data-testid="text-transaction-count">
            Showing {firstRowNumber}-{lastRowNumber} of {totalCount} transactions. Page {page} of {totalPages}.
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page <= 1}
              data-testid="button-page-prev"
            >
              Previous
            </Button>
            {visiblePages.map((visiblePage) => (
              typeof visiblePage === "number" ? (
                <Button
                  key={visiblePage}
                  variant={visiblePage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(visiblePage)}
                  data-testid={`button-page-${visiblePage}`}
                >
                  {visiblePage}
                </Button>
              ) : (
                <span key={visiblePage} className="px-2 text-muted-foreground">
                  ...
                </span>
              )
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={page >= totalPages}
              data-testid="button-page-next"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
