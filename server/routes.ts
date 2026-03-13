import type { Express, Request, Response } from "express";
import { type Server } from "http";
import multer from "multer";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireTrustedOrigin } from "./auth";
import { parseCSV } from "./csvParser";
import {
  buildCashflowAnalysis,
  calculateCashflow,
  detectLeaks,
  getDashboardMetricDefinition,
  getDashboardMetricTransactions,
  getDashboardMetricValue,
  type DashboardMetric,
} from "./cashflow";
import { updateTransactionSchema, insertAccountSchema } from "@shared/schema";
import { resolveDateRange } from "./dateRanges";
import { maybeApplyLlmLabels } from "./llmLabeler";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 25 } });
const CSV_MIME_TYPES = new Set(["text/csv", "application/vnd.ms-excel", "application/csv", "text/plain"]);
const CSV_PROCESSING_ERROR_MESSAGE = "The CSV could not be processed. Please verify the format and try again.";

const batchUploadMetadataSchema = z.array(z.object({
  clientId: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  proposedAccountName: z.string().trim().min(1),
  proposedLastFour: z.string().trim().regex(/^\d{4}$/).optional(),
  selectedExistingAccountId: z.number().int().positive().nullable().optional(),
}));

type BatchUploadMetadataItem = z.infer<typeof batchUploadMetadataSchema>[number];

function normalizeAccountName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeLastFour(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildAccountKey(name: string, lastFour?: string | null): string {
  return `${normalizeAccountName(name)}::${normalizeLastFour(lastFour) ?? ""}`;
}

function validateCsvFile(file: Express.Multer.File): string {
  const originalName = String(file.originalname || "").trim();
  const lowerName = originalName.toLowerCase();
  if (!lowerName.endsWith(".csv")) {
    throw new Error("Upload a CSV file.");
  }

  if (file.mimetype && !CSV_MIME_TYPES.has(file.mimetype)) {
    throw new Error("Unsupported file type. Upload a CSV export.");
  }

  return originalName;
}

function parseBatchUploadMetadata(metadata: unknown): BatchUploadMetadataItem[] {
  if (typeof metadata !== "string") {
    throw new Error("Upload metadata is required.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    throw new Error("Upload metadata must be valid JSON.");
  }

  const result = batchUploadMetadataSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Upload metadata is invalid.");
  }

  const clientIds = new Set<string>();
  for (const item of result.data) {
    if (clientIds.has(item.clientId)) {
      throw new Error("Upload metadata contains duplicate file identifiers.");
    }
    clientIds.add(item.clientId);
  }

  return result.data;
}

async function importCsvForAccount(params: {
  userId: number;
  accountId: number;
  file: Express.Multer.File;
}) {
  const originalName = validateCsvFile(params.file);

  try {
    const csvContent = params.file.buffer.toString("utf-8");
    const uploadRecord = await storage.createUpload(params.userId, params.accountId, originalName, 0);
    const parsedTransactions = parseCSV(csvContent, params.userId, params.accountId, uploadRecord.id);
    const enrichedLabels = await maybeApplyLlmLabels(parsedTransactions.map((transaction) => ({
      rawDescription: transaction.rawDescription,
      amount: parseFloat(String(transaction.amount)),
      transactionClass: transaction.transactionClass as "income" | "expense" | "transfer" | "refund",
      recurrenceType: transaction.recurrenceType as "recurring" | "one-time",
      category: (transaction.category ?? "other") as
        | "income"
        | "transfers"
        | "utilities"
        | "subscriptions"
        | "insurance"
        | "housing"
        | "groceries"
        | "transportation"
        | "dining"
        | "shopping"
        | "health"
        | "debt"
        | "business_software"
        | "entertainment"
        | "fees"
        | "other",
      aiAssisted: Boolean(transaction.aiAssisted),
      labelSource: (transaction.labelSource ?? "rule") as "rule" | "llm" | "manual",
      labelConfidence: transaction.labelConfidence ?? null,
      labelReason: transaction.labelReason ?? null,
    })));
    const txns = parsedTransactions.map((transaction, index) => {
      const decision = enrichedLabels[index];
      return {
        ...transaction,
        transactionClass: decision.transactionClass,
        recurrenceType: decision.recurrenceType,
        category: decision.category,
        labelSource: decision.labelSource,
        labelConfidence: decision.labelConfidence,
        labelReason: decision.labelReason,
        aiAssisted: decision.aiAssisted,
      };
    });
    const created = await storage.createTransactions(txns);
    await storage.updateUploadRowCount(uploadRecord.id, params.userId, created.length);

    return {
      uploadId: uploadRecord.id,
      filename: originalName,
      transactionCount: created.length,
    };
  } catch {
    throw new Error(CSV_PROCESSING_ERROR_MESSAGE);
  }
}

function toCsvCell(value: unknown): string {
  const raw = String(value ?? "").replace(/\r?\n/g, " ").trim();
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function hasRangeQuery(query: Request["query"]): boolean {
  return ["days", "preset", "startDate", "endDate", "year"].some((key) => query[key] !== undefined);
}

function getResolvedRange(query: Request["query"], fallbackToRecent = false) {
  if (!fallbackToRecent && !hasRangeQuery(query)) {
    return undefined;
  }

  return resolveDateRange({
    days: query.days,
    preset: query.preset,
    startDate: query.startDate,
    endDate: query.endDate,
    year: query.year,
  });
}

function parseDashboardMetric(value: unknown): DashboardMetric | undefined {
  const metric = String(value ?? "");
  const allowedMetrics: DashboardMetric[] = [
    "totalInflows",
    "totalOutflows",
    "recurringIncome",
    "recurringExpenses",
    "oneTimeIncome",
    "oneTimeExpenses",
    "safeToSpend",
    "netCashflow",
    "utilitiesBaseline",
    "subscriptionsBaseline",
    "discretionarySpend",
  ];
  return allowedMetrics.includes(metric as DashboardMetric) ? (metric as DashboardMetric) : undefined;
}

function buildTransactionFilters(query: Request["query"], options: { fallbackToRecent?: boolean } = {}) {
  const filters: {
    flowType?: string;
    accountId?: number;
    search?: string;
    merchant?: string;
    category?: string;
    transactionClass?: string;
    recurrenceType?: string;
    startDate?: string;
    endDate?: string;
  } = {};

  if (query.flowType) filters.flowType = query.flowType as string;
  if (query.accountId) filters.accountId = parseInt(String(query.accountId), 10);
  if (query.search) filters.search = query.search as string;
  if (query.merchant) filters.merchant = query.merchant as string;
  if (query.category) filters.category = query.category as string;
  if (query.transactionClass) filters.transactionClass = query.transactionClass as string;
  if (query.recurrenceType) filters.recurrenceType = query.recurrenceType as string;

  const range = getResolvedRange(query, options.fallbackToRecent);
  if (range) {
    filters.startDate = range.startDate;
    filters.endDate = range.endDate;
  }

  return { filters, range, metric: parseDashboardMetric(query.metric) };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // ── Accounts ──────────────────────────────────────────
  app.get("/api/accounts", requireAuth, async (req: Request, res: Response) => {
    const accounts = await storage.getAccounts(req.user!.id);
    res.json(accounts);
  });

  app.post("/api/accounts", requireAuth, requireTrustedOrigin, async (req: Request, res: Response) => {
    const parsed = insertAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid account data" });
    const account = await storage.createAccount(req.user!.id, parsed.data);
    res.status(201).json(account);
  });

  // ── CSV Upload ────────────────────────────────────────
  app.post("/api/upload", requireAuth, requireTrustedOrigin, upload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const accountId = parseInt(String(req.body.accountId), 10);
    if (!accountId) return res.status(400).json({ message: "Account ID is required" });

    const originalName = String(req.file.originalname || "").trim();
    const lowerName = originalName.toLowerCase();
    if (!lowerName.endsWith(".csv")) {
      return res.status(400).json({ message: "Upload a CSV file." });
    }

    if (req.file.mimetype && !CSV_MIME_TYPES.has(req.file.mimetype)) {
      return res.status(400).json({ message: "Unsupported file type. Upload a CSV export." });
    }

    const account = await storage.getAccount(accountId, req.user!.id);
    if (!account) return res.status(404).json({ message: "Account not found" });

    try {
      const created = await importCsvForAccount({
        userId: req.user!.id,
        accountId,
        file: req.file,
      });
      res.status(201).json({
        uploadId: created.uploadId,
        filename: created.filename,
        transactionCount: created.transactionCount,
      });
    } catch {
      res.status(422).json({ message: CSV_PROCESSING_ERROR_MESSAGE });
    }
  });

  app.post("/api/uploads/batch", requireAuth, requireTrustedOrigin, upload.array("files"), async (req: Request, res: Response) => {
    const files = ((req.files as Express.Multer.File[] | undefined) ?? []).filter(Boolean);
    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    let metadata: BatchUploadMetadataItem[];
    try {
      metadata = parseBatchUploadMetadata(req.body.metadata);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Upload metadata is invalid." });
    }

    if (metadata.length !== files.length) {
      return res.status(400).json({ message: "Upload metadata must include one row per file." });
    }

    for (let index = 0; index < metadata.length; index += 1) {
      const item = metadata[index];
      if (item.filename !== String(files[index]?.originalname ?? "").trim()) {
        return res.status(400).json({ message: "Upload metadata does not match the uploaded files." });
      }
    }

    const availableAccounts = await storage.getAccounts(req.user!.id);
    const createdAccountCache = new Map<string, (typeof availableAccounts)[number]>();
    const results: Array<{
      clientId: string;
      filename: string;
      status: "success" | "error";
      resolvedAccount?: { id: number; name: string; lastFour: string | null };
      uploadId?: number;
      transactionCount?: number;
      error?: string;
    }> = [];

    for (let index = 0; index < metadata.length; index += 1) {
      const item = metadata[index];
      const file = files[index];

      try {
        let resolvedAccount = item.selectedExistingAccountId
          ? availableAccounts.find((account) => account.id === item.selectedExistingAccountId)
          : undefined;

        if (item.selectedExistingAccountId && !resolvedAccount) {
          throw new Error("Selected account not found.");
        }

        if (!resolvedAccount) {
          const exactMatch = availableAccounts.find((account) =>
            buildAccountKey(account.name, account.lastFour) === buildAccountKey(item.proposedAccountName, item.proposedLastFour)
          );

          if (exactMatch) {
            resolvedAccount = exactMatch;
          } else {
            const cacheKey = buildAccountKey(item.proposedAccountName, item.proposedLastFour);
            const cachedAccount = createdAccountCache.get(cacheKey);
            if (cachedAccount) {
              resolvedAccount = cachedAccount;
            } else {
              resolvedAccount = await storage.createAccount(req.user!.id, {
                name: item.proposedAccountName.trim(),
                lastFour: normalizeLastFour(item.proposedLastFour),
              });
              availableAccounts.push(resolvedAccount);
              createdAccountCache.set(cacheKey, resolvedAccount);
            }
          }
        }

        const created = await importCsvForAccount({
          userId: req.user!.id,
          accountId: resolvedAccount.id,
          file,
        });

        results.push({
          clientId: item.clientId,
          filename: created.filename,
          status: "success",
          resolvedAccount: {
            id: resolvedAccount.id,
            name: resolvedAccount.name,
            lastFour: resolvedAccount.lastFour,
          },
          uploadId: created.uploadId,
          transactionCount: created.transactionCount,
        });
      } catch (error) {
        results.push({
          clientId: item.clientId,
          filename: item.filename,
          status: "error",
          error: error instanceof Error ? error.message : CSV_PROCESSING_ERROR_MESSAGE,
        });
      }
    }

    const summary = results.reduce((acc, result) => {
      acc.totalFiles += 1;
      if (result.status === "success") {
        acc.succeeded += 1;
        acc.totalTransactions += result.transactionCount ?? 0;
      } else {
        acc.failed += 1;
      }
      return acc;
    }, {
      totalFiles: 0,
      succeeded: 0,
      failed: 0,
      totalTransactions: 0,
    });

    res.status(201).json({ summary, results });
  });

  app.get("/api/uploads", requireAuth, async (req: Request, res: Response) => {
    const uploads = await storage.getUploads(req.user!.id);
    res.json(uploads);
  });

  // ── Transactions ──────────────────────────────────────
  app.get("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    const { filters, range, metric } = buildTransactionFilters(req.query);
    const page = parseInt(String(req.query.page ?? ""), 10) || 1;
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? ""), 10) || 50, 1), 100);
    if (!metric) {
      const txns = await storage.getTransactionPage(req.user!.id, {
        ...filters,
        page,
        pageSize,
      });
      return res.json(txns);
    }

    const sourceRows = await storage.getTransactions(req.user!.id, filters);
    const metricRows = getDashboardMetricTransactions(sourceRows, metric);
    const totalCount = metricRows.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const offset = (currentPage - 1) * pageSize;
    const rows = metricRows.slice(offset, offset + pageSize);
    const metricDefinition = getDashboardMetricDefinition(metric);

    return res.json({
      rows,
      totalCount,
      page: currentPage,
      pageSize,
      totalPages,
      metric,
      metricLabel: metricDefinition.label,
      metricDescription: metricDefinition.description,
      metricTotal: getDashboardMetricValue(metricRows, metric, { rangeDays: range?.rangeDays }),
    });
  });

  app.patch("/api/transactions/:id", requireAuth, requireTrustedOrigin, async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const parsed = updateTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid update data" });

    const updated = await storage.updateTransaction(id, req.user!.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Transaction not found" });
    res.json(updated);
  });

  app.post("/api/transactions/reprocess", requireAuth, requireTrustedOrigin, async (req: Request, res: Response) => {
    const result = await storage.reprocessTransactions(req.user!.id);
    res.json(result);
  });

  app.delete("/api/transactions", requireAuth, requireTrustedOrigin, async (req: Request, res: Response) => {
    const result = await storage.wipeImportedData(req.user!.id);
    res.json(result);
  });

  app.delete("/api/workspace-data", requireAuth, requireTrustedOrigin, async (req: Request, res: Response) => {
    const result = await storage.wipeWorkspaceData(req.user!.id);
    res.json(result);
  });

  // ── Cashflow Summary ──────────────────────────────────
  app.get("/api/cashflow", requireAuth, async (req: Request, res: Response) => {
    const { filters, range } = buildTransactionFilters(req.query, { fallbackToRecent: true });
    const txns = await storage.getTransactions(req.user!.id, filters);
    const summary = calculateCashflow(txns, { rangeDays: range?.rangeDays });
    res.json({ ...summary, range });
  });

  // ── Leak Detection ────────────────────────────────────
  app.get("/api/leaks", requireAuth, async (req: Request, res: Response) => {
    const { filters, range } = buildTransactionFilters(req.query, { fallbackToRecent: true });
    const txns = await storage.getTransactions(req.user!.id, filters);
    const leaks = detectLeaks(txns, { rangeDays: range?.rangeDays });
    res.json(leaks);
  });

  app.get("/api/analysis", requireAuth, async (req: Request, res: Response) => {
    const range = getResolvedRange(req.query, true)!;
    const [currentTransactions, previousTransactions] = await Promise.all([
      storage.getTransactions(req.user!.id, {
        startDate: range.startDate,
        endDate: range.endDate,
      }),
      storage.getTransactions(req.user!.id, {
        startDate: range.previousStartDate,
        endDate: range.previousEndDate,
      }),
    ]);

    const analysis = buildCashflowAnalysis(currentTransactions, previousTransactions, {
      rangeDays: range.rangeDays,
    });

    res.json({
      range,
      analysis,
      currentTransactionCount: currentTransactions.length,
      previousTransactionCount: previousTransactions.length,
    });
  });

  // ── CSV Export ─────────────────────────────────────────
  app.get("/api/export/summary", requireAuth, async (req: Request, res: Response) => {
    const { filters, range } = buildTransactionFilters(req.query, { fallbackToRecent: true });
    const txns = await storage.getTransactions(req.user!.id, filters);
    const summary = calculateCashflow(txns, { rangeDays: range?.rangeDays });

    const csvRows = [
      "Metric,Value",
      `Window,${range?.label ?? "Custom range"}`,
      `Start Date,${range?.startDate ?? ""}`,
      `End Date,${range?.endDate ?? ""}`,
      `Total Inflows,$${summary.totalInflows}`,
      `Total Outflows,$${summary.totalOutflows}`,
      `Recurring Income,$${summary.recurringIncome}`,
      `Recurring Expenses,$${summary.recurringExpenses}`,
      `One-time Income,$${summary.oneTimeIncome}`,
      `One-time Expenses,$${summary.oneTimeExpenses}`,
      `Utilities Baseline,$${summary.utilitiesBaseline}`,
      `Subscriptions Baseline,$${summary.subscriptionsBaseline}`,
      `Discretionary Spend,$${summary.discretionarySpend}`,
      `Safe to Spend,$${summary.safeToSpend}`,
      `Net Cashflow,$${summary.netCashflow}`,
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=cashflow-summary.csv");
    res.send(csvRows.join("\n"));
  });

  app.get("/api/export/transactions", requireAuth, async (req: Request, res: Response) => {
    const { filters, range, metric } = buildTransactionFilters(req.query);
    const sourceRows = await storage.getTransactions(req.user!.id, filters);
    const txns = metric ? getDashboardMetricTransactions(sourceRows, metric) : sourceRows;
    const metricDefinition = metric ? getDashboardMetricDefinition(metric) : undefined;
    const metricTotal = metric ? getDashboardMetricValue(txns, metric, { rangeDays: range?.rangeDays }) : undefined;

    const csvRows = [
      `${toCsvCell("Window")},${toCsvCell(range?.label ?? "All transactions")}`,
      ...(metricDefinition
        ? [`${toCsvCell("Metric")},${toCsvCell(metricDefinition.label)}`, `${toCsvCell("Metric Total")},${toCsvCell(`$${metricTotal}`)}`]
        : []),
      "Date,Merchant,Amount,Type,Class,Recurrence,Category,Label Source,Label Confidence,Label Reason,Raw Description",
      ...txns.map(tx =>
        [
          toCsvCell(tx.date),
          toCsvCell(tx.merchant),
          tx.amount,
          toCsvCell(tx.flowType),
          toCsvCell(tx.transactionClass),
          toCsvCell(tx.recurrenceType),
          toCsvCell(tx.category),
          toCsvCell(tx.labelSource),
          toCsvCell(tx.labelConfidence ?? ""),
          toCsvCell(tx.labelReason ?? ""),
          toCsvCell(tx.rawDescription),
        ].join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=transactions-export.csv");
    res.send(csvRows.join("\n"));
  });

  return httpServer;
}
