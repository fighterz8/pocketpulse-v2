import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { readApiErrorMessage } from "@/lib/queryClient";

interface Account {
  id: number;
  name: string;
  lastFour: string | null;
}

interface PendingUpload {
  id: string;
  file: File;
  filename: string;
  accountName: string;
  lastFour: string;
  selectedExistingAccountId: string;
  status: "ready" | "uploading" | "success" | "error";
  errorMessage: string | null;
  transactionCount?: number;
  uploadId?: number;
  resolvedAccount?: Account | null;
}

interface BatchUploadResponse {
  summary: {
    totalFiles: number;
    succeeded: number;
    failed: number;
    totalTransactions: number;
  };
  results: Array<{
    clientId: string;
    filename: string;
    status: "success" | "error";
    resolvedAccount?: Account;
    uploadId?: number;
    transactionCount?: number;
    error?: string;
  }>;
}

const AUTO_MATCH_VALUE = "__auto__";

function createFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeLastFour(value?: string | null): string {
  return (value ?? "").trim();
}

function guessAccountName(filename: string): string {
  return filename
    .replace(/\.csv$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildPendingUpload(file: File): PendingUpload {
  return {
    id: createFileKey(file),
    file,
    filename: file.name,
    accountName: guessAccountName(file.name),
    lastFour: "",
    selectedExistingAccountId: AUTO_MATCH_VALUE,
    status: "ready",
    errorMessage: null,
    resolvedAccount: null,
  };
}

function getExactAccountMatch(row: PendingUpload, accounts: Account[]): Account | undefined {
  const normalizedName = normalizeName(row.accountName);
  const normalizedLastFour = normalizeLastFour(row.lastFour);
  return accounts.find((account) =>
    normalizeName(account.name) === normalizedName && normalizeLastFour(account.lastFour) === normalizedLastFour
  );
}

function getRowValidationMessage(row: PendingUpload): string | null {
  if (!row.accountName.trim()) {
    return "Account name is required.";
  }

  if (row.lastFour && !/^\d{4}$/.test(row.lastFour)) {
    return "Last four must be exactly 4 digits.";
  }

  return null;
}

export default function UploadPage() {
  const { toast } = useToast();
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [batchSummary, setBatchSummary] = useState<BatchUploadResponse["summary"] | null>(null);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  useEffect(() => {
    setPendingUploads((current) => current.map((row) => {
      if (row.selectedExistingAccountId === AUTO_MATCH_VALUE) {
        return row;
      }

      const stillExists = accounts.some((account) => account.id.toString() === row.selectedExistingAccountId);
      return stillExists ? row : { ...row, selectedExistingAccountId: AUTO_MATCH_VALUE };
    }));
  }, [accounts]);

  const rowsToSubmit = useMemo(
    () => pendingUploads.filter((row) => row.status !== "success"),
    [pendingUploads]
  );

  const invalidRowCount = useMemo(
    () => rowsToSubmit.filter((row) => getRowValidationMessage(row)).length,
    [rowsToSubmit]
  );

  const uploadMutation = useMutation({
    mutationFn: async (rows: PendingUpload[]) => {
      const formData = new FormData();
      const metadata = rows.map((row) => ({
        clientId: row.id,
        filename: row.filename,
        proposedAccountName: row.accountName.trim(),
        proposedLastFour: row.lastFour || undefined,
        selectedExistingAccountId: row.selectedExistingAccountId === AUTO_MATCH_VALUE
          ? undefined
          : Number(row.selectedExistingAccountId),
      }));

      rows.forEach((row) => {
        formData.append("files", row.file);
      });
      formData.append("metadata", JSON.stringify(metadata));

      const res = await fetch("/api/uploads/batch", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res));
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("The upload service returned an unexpected response. Please refresh the app and try again.");
      }

      return res.json() as Promise<BatchUploadResponse>;
    },
    onMutate: (rows) => {
      setBatchSummary(null);
      const rowIds = new Set(rows.map((row) => row.id));
      setPendingUploads((current) => current.map((row) => (
        rowIds.has(row.id)
          ? {
              ...row,
              status: "uploading",
              errorMessage: null,
              transactionCount: undefined,
              uploadId: undefined,
              resolvedAccount: null,
            }
          : row
      )));

      return { rowIds };
    },
    onSuccess: (data, _rows, context) => {
      const resultMap = new Map(data.results.map((result) => [result.clientId, result]));

      setBatchSummary(data.summary);
      setPendingUploads((current) => current.map((row) => {
        if (!context?.rowIds.has(row.id)) {
          return row;
        }

        const result = resultMap.get(row.id);
        if (!result) {
          return {
            ...row,
            status: "error",
            errorMessage: "The server did not return a result for this file.",
          };
        }

        if (result.status === "success") {
          return {
            ...row,
            status: "success",
            errorMessage: null,
            transactionCount: result.transactionCount,
            uploadId: result.uploadId,
            resolvedAccount: result.resolvedAccount ?? null,
          };
        }

        return {
          ...row,
          status: "error",
          errorMessage: result.error ?? "Upload failed.",
          transactionCount: undefined,
          uploadId: undefined,
          resolvedAccount: null,
        };
      }));

      queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/transactions"),
      });
      queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/cashflow"),
      });
      queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/leaks"),
      });
      queryClient.invalidateQueries({
        predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/analysis"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });

      toast({
        title: data.summary.failed > 0 ? "Batch import finished with issues" : "Batch import complete",
        description: `${data.summary.totalTransactions} transactions imported across ${data.summary.succeeded} file${data.summary.succeeded === 1 ? "" : "s"}.`,
        variant: data.summary.failed > 0 ? "destructive" : "default",
      });
    },
    onError: (err: Error, _rows, context) => {
      setPendingUploads((current) => current.map((row) => (
        context?.rowIds.has(row.id)
          ? { ...row, status: "error", errorMessage: err.message }
          : row
      )));

      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) {
      return;
    }

    let invalidCount = 0;
    let duplicateCount = 0;

    setBatchSummary(null);
    setPendingUploads((current) => {
      const knownKeys = new Set(current.map((row) => createFileKey(row.file)));
      const nextRows = [...current];

      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".csv")) {
          invalidCount += 1;
          continue;
        }

        const key = createFileKey(file);
        if (knownKeys.has(key)) {
          duplicateCount += 1;
          continue;
        }

        knownKeys.add(key);
        nextRows.push(buildPendingUpload(file));
      }

      return nextRows;
    });

    if (invalidCount > 0) {
      toast({
        title: "Some files were skipped",
        description: `${invalidCount} file${invalidCount === 1 ? "" : "s"} were not CSVs.`,
        variant: "destructive",
      });
    }

    if (duplicateCount > 0) {
      toast({
        title: "Duplicate files skipped",
        description: `${duplicateCount} file${duplicateCount === 1 ? "" : "s"} were already added to this batch.`,
      });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const updateRow = (rowId: string, updater: (row: PendingUpload) => PendingUpload) => {
    setBatchSummary(null);
    setPendingUploads((current) => current.map((row) => (
      row.id === rowId
        ? {
            ...updater(row),
            status: "ready",
            errorMessage: null,
            transactionCount: undefined,
            uploadId: undefined,
            resolvedAccount: null,
          }
        : row
    )));
  };

  const handleUpload = () => {
    if (rowsToSubmit.length === 0 || invalidRowCount > 0) {
      return;
    }

    uploadMutation.mutate(rowsToSubmit);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground mt-1">
          Drop one or more CSV exports, confirm the account details for each file, and import the full batch in one step.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Batch CSV Import</CardTitle>
          <CardDescription>
            The app detects transaction columns automatically. For each file, confirm the account name and last four or override the account match if needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors border-muted-foreground/25 bg-muted/30 hover:bg-muted/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="space-y-4 flex flex-col items-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                <UploadIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {pendingUploads.length > 0 ? "Add more CSV files" : "Drag & drop your CSV files"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Upload bank or accounting exports in one batch. Each file keeps its own account details and import status. Max file size 10MB per file.
                </p>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Input type="file" accept=".csv" multiple className="hidden" id="file-upload" onChange={handleFileChange} />
                <Label
                  htmlFor="file-upload"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 cursor-pointer transition-colors"
                  data-testid="button-select-file"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Select CSV Files
                  </span>
                </Label>
                {pendingUploads.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBatchSummary(null);
                      setPendingUploads([]);
                    }}
                    disabled={uploadMutation.isPending}
                  >
                    Clear Batch
                  </Button>
                )}
              </div>
            </div>
          </div>

          {batchSummary && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Batch import summary</p>
                  <p className="text-sm text-muted-foreground">
                    Imported {batchSummary.totalTransactions} transactions from {batchSummary.succeeded} file{batchSummary.succeeded === 1 ? "" : "s"}.
                    {batchSummary.failed > 0 ? ` ${batchSummary.failed} file${batchSummary.failed === 1 ? "" : "s"} still need attention.` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}

          {pendingUploads.length > 0 ? (
            <div className="space-y-4">
              {pendingUploads.map((row, index) => {
                const selectedExistingAccount = row.selectedExistingAccountId !== AUTO_MATCH_VALUE
                  ? accounts.find((account) => account.id.toString() === row.selectedExistingAccountId)
                  : undefined;
                const exactMatch = getExactAccountMatch(row, accounts);
                const previewAccount = selectedExistingAccount ?? exactMatch;
                const sameNameMatches = accounts.filter((account) => normalizeName(account.name) === normalizeName(row.accountName));
                const validationMessage = getRowValidationMessage(row);

                return (
                  <div key={row.id} className="rounded-xl border bg-background p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{row.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            File {index + 1} of {pendingUploads.length} • {formatFileSize(row.file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBatchSummary(null);
                          setPendingUploads((current) => current.filter((item) => item.id !== row.id));
                        }}
                        disabled={uploadMutation.isPending}
                        className="self-start"
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_260px]">
                      <div className="space-y-2">
                        <Label htmlFor={`account-name-${row.id}`}>Account Name</Label>
                        <Input
                          id={`account-name-${row.id}`}
                          value={row.accountName}
                          onChange={(e) => updateRow(row.id, (current) => ({ ...current, accountName: e.target.value }))}
                          disabled={uploadMutation.isPending}
                          placeholder="Main Checking"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`account-last-four-${row.id}`}>Last 4</Label>
                        <Input
                          id={`account-last-four-${row.id}`}
                          inputMode="numeric"
                          placeholder="4589"
                          value={row.lastFour}
                          onChange={(e) => updateRow(row.id, (current) => ({
                            ...current,
                            lastFour: e.target.value.replace(/\D/g, "").slice(0, 4),
                          }))}
                          disabled={uploadMutation.isPending}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`account-match-${row.id}`}>Account Match</Label>
                        <Select
                          value={row.selectedExistingAccountId}
                          onValueChange={(value) => updateRow(row.id, (current) => ({ ...current, selectedExistingAccountId: value }))}
                          disabled={uploadMutation.isPending || accountsLoading}
                        >
                          <SelectTrigger id={`account-match-${row.id}`}>
                            <SelectValue placeholder="Choose account match behavior" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={AUTO_MATCH_VALUE}>Auto: exact match or create new</SelectItem>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id.toString()}>
                                {account.name}{account.lastFour ? ` (...${account.lastFour})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {validationMessage ? (
                        <p className="text-sm text-destructive">{validationMessage}</p>
                      ) : previewAccount ? (
                        <p className="text-sm text-muted-foreground">
                          This file will import into the existing account <span className="font-medium text-foreground">{previewAccount.name}{previewAccount.lastFour ? ` (...${previewAccount.lastFour})` : ""}</span>.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No exact account match found. A new account will be created when this file is imported.
                        </p>
                      )}

                      {!previewAccount && sameNameMatches.length > 0 && row.selectedExistingAccountId === AUTO_MATCH_VALUE && (
                        <p className="text-sm text-amber-600">
                          {sameNameMatches.length === 1
                            ? "A similarly named existing account was found. Add the correct last four or choose it from the account match list."
                            : "Multiple similarly named accounts were found. Add the correct last four or choose one from the account match list."}
                        </p>
                      )}

                      {row.status === "uploading" && (
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>Importing and parsing transactions...</span>
                          </div>
                          <Progress value={50} className="h-2 animate-pulse" />
                        </div>
                      )}

                      {row.status === "success" && (
                        <p className="text-sm text-emerald-600">
                          Imported {row.transactionCount ?? 0} transactions{row.resolvedAccount ? ` into ${row.resolvedAccount.name}` : ""}.
                        </p>
                      )}

                      {row.status === "error" && row.errorMessage && (
                        <p className="text-sm text-destructive">{row.errorMessage}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              Add one or more CSV files to start building the import batch. Each file gets its own account name, last four, and match status.
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/30 border-t justify-between items-center py-4">
          <p className="text-xs text-muted-foreground flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            Transactions are categorized automatically after import and can be reviewed in the ledger afterward.
          </p>
          {pendingUploads.length > 0 && rowsToSubmit.length === 0 ? (
            <Button data-testid="button-view-ledger" onClick={() => window.location.href = "/transactions"}>
              Review Transactions
            </Button>
          ) : (
            <Button
              onClick={handleUpload}
              disabled={rowsToSubmit.length === 0 || invalidRowCount > 0 || uploadMutation.isPending}
              data-testid="button-process-upload"
            >
              {uploadMutation.isPending
                ? "Processing..."
                : rowsToSubmit.length === pendingUploads.length
                  ? `Import ${rowsToSubmit.length} File${rowsToSubmit.length === 1 ? "" : "s"}`
                  : `Import Remaining ${rowsToSubmit.length} File${rowsToSubmit.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
