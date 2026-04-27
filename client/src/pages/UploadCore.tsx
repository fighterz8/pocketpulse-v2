/**
 * UploadCore is the embeddable CSV-upload UI: dropzone, queue, per-file
 * preview, bulk account assignment, per-file status pills, and the import
 * button. It assumes the user already has at least one bank account — the
 * "create your first account" gate lives in the parent (`Upload.tsx`)
 * because the onboarding flow renders its own dedicated bank-account step
 * and shouldn't double-render the gate when it embeds this component.
 *
 * Data shape:
 *   - `accounts` is required and must be a non-empty array (parent enforces).
 *   - Each queue item carries its own status; while a batch upload is in
 *     flight all `pending` rows transition to `uploading`, and on
 *     success/failure they transition to `complete`/`failed` with the
 *     per-file result attached. The standalone results banner from the
 *     pre-refactor Upload page is gone — the queue itself is the result
 *     surface, which avoids the user losing their context (filename,
 *     account picked, preview) the moment the import returns.
 */
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, type AuthAccount } from "../hooks/use-auth";
import { useUploads, type UploadFileResult } from "../hooks/use-uploads";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PREVIEW_BYTES = 10 * 1024;
const PREVIEW_ROWS = 5;

type QueueStatus = "pending" | "uploading" | "complete" | "failed";

type QueuedFile = {
  file: File;
  accountId: number | null;
  key: string;
  status: QueueStatus;
  /** Populated after the import returns. */
  result?: UploadFileResult;
  showPreview?: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type UploadCoreProps = {
  /**
   * The user's bank accounts. Caller is responsible for ensuring this
   * is non-empty — the gate is rendered by the parent.
   */
  accounts: AuthAccount[];
  /**
   * Optional hook called once an import has finished AND the user has
   * dismissed the queue (clicked "Upload more files"). Onboarding uses
   * this to advance to the next step.
   */
  onAllImportsDismissed?: () => void;
};

export function UploadCore({ accounts, onAllImportsDismissed }: UploadCoreProps) {
  const { upload } = useUploads();

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [dragActive, setDragActive] = useState(false);
  const [bulkAccount, setBulkAccount] = useState<number | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyCounter = useRef(0);
  const dragDepth = useRef(0);

  /**
   * Are any rows still "complete"/"failed" from a previous import?
   * If yes, the queue is in a "results-shown" state and the import
   * button is replaced with a dismiss button.
   */
  const hasFinishedRows = queue.some(
    (q) => q.status === "complete" || q.status === "failed",
  );
  const allFinished =
    queue.length > 0 &&
    queue.every((q) => q.status === "complete" || q.status === "failed");

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const newFiles: QueuedFile[] = [];
      const errors: Record<string, string> = {};

      for (const file of Array.from(fileList)) {
        if (!file.name.toLowerCase().endsWith(".csv")) {
          errors[file.name] = `"${file.name}" is not a CSV file`;
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors[file.name] =
            `"${file.name}" exceeds the 5 MB size limit (${formatFileSize(file.size)})`;
          continue;
        }
        if (file.size === 0) {
          errors[file.name] = `"${file.name}" is empty`;
          continue;
        }

        // Default to the only account when the user has exactly one,
        // so the trivial single-account case doesn't make them tap a
        // dropdown for every file.
        const defaultAccount = accounts.length === 1 ? accounts[0]!.id : null;
        keyCounter.current += 1;
        newFiles.push({
          file,
          accountId: defaultAccount,
          key: `file-${keyCounter.current}`,
          status: "pending",
        });
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors((prev) => ({ ...prev, ...errors }));
      }
      if (newFiles.length > 0) {
        // Drop only finished (complete/failed) rows from a prior batch
        // — the user clearly wants to start fresh. CRITICALLY we never
        // remove `uploading` rows: the import response is still in
        // flight and needs to merge back into them. The dropzone is
        // also disabled while `upload.isPending`, so this branch
        // shouldn't normally fire mid-upload, but the defense-in-depth
        // prevents a state-loss bug if the file input is somehow
        // triggered (e.g. via keyboard or a race).
        setQueue((prev) => {
          const keep = prev.filter(
            (q) => q.status === "pending" || q.status === "uploading",
          );
          return [...keep, ...newFiles];
        });
      }
    },
    [accounts],
  );

  const removeFile = useCallback((key: string) => {
    setQueue((prev) => prev.filter((q) => q.key !== key));
  }, []);

  const setAccountForFile = useCallback(
    (key: string, accountId: number | null) => {
      setQueue((prev) =>
        prev.map((q) => (q.key === key ? { ...q, accountId } : q)),
      );
    },
    [],
  );

  const togglePreview = useCallback((key: string) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.key === key ? { ...q, showPreview: !q.showPreview } : q,
      ),
    );
  }, []);

  function applyBulkAccount() {
    if (bulkAccount === "") return;
    setQueue((prev) =>
      prev.map((q) =>
        q.status === "pending" ? { ...q, accountId: bulkAccount } : q,
      ),
    );
  }

  function dismissResults() {
    setQueue([]);
    setValidationErrors({});
    upload.reset();
    onAllImportsDismissed?.();
  }

  const pendingQueue = queue.filter((q) => q.status === "pending");
  const canImport =
    pendingQueue.length > 0 &&
    pendingQueue.every((q) => q.accountId !== null) &&
    !upload.isPending;

  async function handleImport() {
    if (!canImport) return;

    setValidationErrors({});

    // The server keys per-file metadata + result rows by filename
    // (`file.originalname`). Two queued files with the same name would
    // collide on both halves of the round-trip — wrong account would
    // be picked AND the response merge would assign the same result to
    // both rows. Refuse the batch up front with a clear error rather
    // than silently mis-attributing.
    const seen = new Map<string, string[]>();
    for (const q of pendingQueue) {
      const list = seen.get(q.file.name) ?? [];
      list.push(q.key);
      seen.set(q.file.name, list);
    }
    const dupeNames = [...seen.entries()]
      .filter(([, keys]) => keys.length > 1)
      .map(([name]) => name);
    if (dupeNames.length > 0) {
      setValidationErrors({
        __batch__: `Two files share the same name: ${dupeNames
          .map((n) => `"${n}"`)
          .join(", ")}. Rename or remove duplicates before importing.`,
      });
      return;
    }

    // Snapshot the keys we're about to upload so the result-merge
    // step doesn't get confused if the user removes files mid-flight
    // (the disabled state should prevent it but be defensive).
    const uploadingKeys = new Set(pendingQueue.map((q) => q.key));
    setQueue((prev) =>
      prev.map((q) =>
        uploadingKeys.has(q.key) ? { ...q, status: "uploading" } : q,
      ),
    );

    const metadata: Record<string, { accountId: number }> = {};
    for (const q of pendingQueue) {
      metadata[q.file.name] = { accountId: q.accountId! };
    }

    try {
      const response = await upload.mutateAsync({
        files: pendingQueue.map((q) => q.file),
        metadata,
      });
      const resultsByName = new Map<string, UploadFileResult>();
      for (const r of response.results) resultsByName.set(r.filename, r);

      setQueue((prev) =>
        prev.map((q) => {
          if (!uploadingKeys.has(q.key)) return q;
          const result = resultsByName.get(q.file.name);
          if (!result) {
            // The server didn't return a result for this file — surface
            // it as a generic failure rather than leaving it stuck
            // showing "Uploading…".
            return {
              ...q,
              status: "failed",
              result: {
                filename: q.file.name,
                uploadId: null,
                status: "failed",
                rowCount: 0,
                error: "No response received from server",
              },
            };
          }
          return {
            ...q,
            status: result.status === "complete" ? "complete" : "failed",
            result,
          };
        }),
      );
    } catch (err) {
      // Whole-batch failure (network, 4xx/5xx). Mark every uploading
      // row as failed with the same message.
      const message = err instanceof Error ? err.message : "Upload failed";
      setQueue((prev) =>
        prev.map((q) =>
          uploadingKeys.has(q.key)
            ? {
                ...q,
                status: "failed",
                result: {
                  filename: q.file.name,
                  uploadId: null,
                  status: "failed",
                  rowCount: 0,
                  error: message,
                },
              }
            : q,
        ),
      );
    }
  }

  // ─── Drag-and-drop handlers ────────────────────────────────────
  // We use a `dragDepth` counter so dragenter/dragleave on child
  // elements (e.g. the hint text inside the dropzone) don't cause the
  // active state to flicker.

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  return (
    <div className="upload-core">
      {/* Dropzone */}
      <div
        className={`upload-dropzone ${dragActive ? "upload-dropzone--active" : ""} ${upload.isPending ? "upload-dropzone--disabled" : ""}`}
        data-testid="upload-dropzone"
        data-drag-active={dragActive ? "true" : "false"}
        data-disabled={upload.isPending ? "true" : "false"}
        aria-disabled={upload.isPending ? "true" : "false"}
        onDrop={upload.isPending ? (e) => e.preventDefault() : onDrop}
        onDragOver={upload.isPending ? (e) => e.preventDefault() : onDragOver}
        onDragEnter={upload.isPending ? (e) => e.preventDefault() : onDragEnter}
        onDragLeave={upload.isPending ? (e) => e.preventDefault() : onDragLeave}
        onClick={() => {
          if (upload.isPending) return;
          fileInputRef.current?.click();
        }}
        role="button"
        tabIndex={upload.isPending ? -1 : 0}
        onKeyDown={(e) => {
          if (upload.isPending) return;
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
      >
        <p className="upload-dropzone-text">
          {dragActive ? "Drop to add files" : "Drop CSV files here or click to browse"}
        </p>
        <p className="upload-dropzone-hint">
          Up to 5&nbsp;MB per file &middot; .csv format
        </p>
        <p
          className="upload-dropzone-formats"
          data-testid="text-supported-formats"
        >
          Supported: Chase, Amex, Bank of America, Citi, Discover, Capital
          One — others are auto-detected best-effort.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          disabled={upload.isPending}
          className="upload-file-input"
          onChange={(e) => {
            if (upload.isPending) return;
            if (e.target.files && e.target.files.length > 0) {
              addFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </div>

      {/* File-level validation errors (rejected before queueing) */}
      {Object.keys(validationErrors).length > 0 && (
        <div
          className="upload-validation-errors"
          role="alert"
          data-testid="upload-validation-errors"
        >
          {Object.entries(validationErrors).map(([name, msg]) => (
            <p key={name} className="upload-validation-error">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="upload-queue glass-card" data-testid="upload-queue">
          <ResultsHeadline queue={queue} />

          {/* Bulk-assign bar: only when 2+ pending files AND the user
              actually has 2+ accounts to choose between. */}
          {pendingQueue.length >= 2 && accounts.length >= 2 && (
            <div className="upload-bulk-bar" data-testid="upload-bulk-bar">
              <label className="upload-bulk-label" htmlFor="upload-bulk-select">
                Set account for all
              </label>
              <select
                id="upload-bulk-select"
                className="upload-select upload-bulk-select"
                value={bulkAccount === "" ? "" : String(bulkAccount)}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setBulkAccount(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                disabled={upload.isPending}
                data-testid="select-bulk-account"
              >
                <option value="">Choose an account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.lastFour ? ` (****${a.lastFour})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="upload-bulk-apply"
                disabled={bulkAccount === "" || upload.isPending}
                onClick={applyBulkAccount}
                data-testid="button-apply-bulk-account"
              >
                Apply to all
              </button>
            </div>
          )}

          <ul className="upload-queue-list">
            {queue.map((q) => (
              <QueueRow
                key={q.key}
                item={q}
                accounts={accounts}
                onRemove={removeFile}
                onSetAccount={setAccountForFile}
                onTogglePreview={togglePreview}
                disabled={upload.isPending}
              />
            ))}
          </ul>

          {/* Whole-batch error (only relevant when the mutation itself
              hasn't yet been resolved into per-row errors). Per-row
              errors are shown on the row itself. */}
          {upload.error && !hasFinishedRows && (
            <p
              className="upload-error"
              role="alert"
              data-testid="text-upload-error"
            >
              {upload.error.message}
            </p>
          )}

          {allFinished ? (
            <button
              type="button"
              className="upload-btn upload-btn--secondary"
              onClick={dismissResults}
              data-testid="button-upload-more"
            >
              Upload more files
            </button>
          ) : (
            <button
              type="button"
              className="upload-btn upload-btn--primary"
              disabled={!canImport}
              onClick={() => void handleImport()}
              data-testid="button-import"
            >
              {upload.isPending
                ? "Importing…"
                : `Import ${pendingQueue.length} file${pendingQueue.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsHeadline({ queue }: { queue: QueuedFile[] }) {
  const completed = queue.filter((q) => q.status === "complete");
  const failed = queue.filter((q) => q.status === "failed");
  if (completed.length === 0 && failed.length === 0) {
    return (
      <h2 className="upload-queue-title" data-testid="text-queue-title">
        {queue.length} file{queue.length !== 1 ? "s" : ""} ready
      </h2>
    );
  }

  const totalAdded = completed.reduce(
    (sum, q) => sum + (q.result?.rowCount ?? 0),
    0,
  );
  const totalDuplicates = completed.reduce(
    (sum, q) =>
      sum +
      (q.result?.previouslyImported ?? 0) +
      (q.result?.intraBatchDuplicates ?? 0),
    0,
  );

  return (
    <div className="upload-results-summary">
      <h2 className="upload-queue-title" data-testid="text-import-headline">
        {failed.length === 0
          ? `Import complete — ${totalAdded} transaction${totalAdded !== 1 ? "s" : ""} added`
          : `Import finished — ${completed.length} of ${queue.length} succeeded`}
      </h2>
      {totalDuplicates > 0 && (
        <p
          className="upload-results-skipped-line"
          data-testid="text-results-duplicates"
        >
          {totalDuplicates} duplicate row{totalDuplicates !== 1 ? "s" : ""}{" "}
          skipped
        </p>
      )}
      {completed.length > 0 && (
        <a
          href="/transactions"
          className="upload-results-link"
          data-testid="link-review-ledger"
        >
          Review in Ledger →
        </a>
      )}
    </div>
  );
}

// ─── Per-row queue item ────────────────────────────────────────────

function QueueRow({
  item,
  accounts,
  onRemove,
  onSetAccount,
  onTogglePreview,
  disabled,
}: {
  item: QueuedFile;
  accounts: AuthAccount[];
  onRemove: (key: string) => void;
  onSetAccount: (key: string, accountId: number | null) => void;
  onTogglePreview: (key: string) => void;
  disabled: boolean;
}) {
  const isFinished = item.status === "complete" || item.status === "failed";
  return (
    <li
      className={`upload-queue-item upload-queue-item--${item.status}`}
      data-testid={`row-queue-${item.key}`}
      data-status={item.status}
    >
      <div className="upload-queue-item-header">
        <span className="upload-queue-filename">{item.file.name}</span>
        <span className="upload-queue-filesize">
          {formatFileSize(item.file.size)}
        </span>
        <StatusPill item={item} />
        <button
          type="button"
          className="upload-queue-remove"
          onClick={() => onRemove(item.key)}
          aria-label={`Remove ${item.file.name}`}
          disabled={disabled && !isFinished}
          data-testid={`button-remove-file-${item.key}`}
        >
          &times;
        </button>
      </div>

      {/* Per-file failure detail (more visible than just the pill) */}
      {item.status === "failed" && item.result?.error && (
        <p
          className="upload-queue-item-error"
          role="alert"
          data-testid={`text-row-error-${item.key}`}
        >
          {item.result.error}
        </p>
      )}

      {/* Account selector + preview toggle row (only while pending) */}
      {item.status === "pending" && (
        <div className="upload-queue-item-fields">
          <label className="upload-field">
            <span className="upload-field-label">Account</span>
            <AccountSelector
              accounts={accounts}
              value={item.accountId}
              onChange={(id) => onSetAccount(item.key, id)}
              disabled={disabled}
              fileKey={item.key}
            />
          </label>
          <button
            type="button"
            className="upload-preview-toggle"
            onClick={() => onTogglePreview(item.key)}
            data-testid={`button-toggle-preview-${item.key}`}
            aria-expanded={item.showPreview ? "true" : "false"}
          >
            {item.showPreview ? "Hide preview" : "Preview first 5 rows"}
          </button>
        </div>
      )}

      {item.status === "pending" && item.showPreview && (
        <FilePreview file={item.file} fileKey={item.key} />
      )}

      {/* Result detail for completed rows */}
      {item.status === "complete" && item.result && (
        <p
          className="upload-queue-item-result"
          data-testid={`text-row-result-${item.key}`}
        >
          {item.result.rowCount} new
          {(item.result.previouslyImported ?? 0) > 0 && (
            <span className="upload-result-skipped">
              {" · "}
              {item.result.previouslyImported} already in ledger
            </span>
          )}
          {(item.result.intraBatchDuplicates ?? 0) > 0 && (
            <span className="upload-result-skipped">
              {" · "}
              {item.result.intraBatchDuplicates} duplicate row
              {item.result.intraBatchDuplicates !== 1 ? "s" : ""} in file
            </span>
          )}
        </p>
      )}
    </li>
  );
}

function StatusPill({ item }: { item: QueuedFile }) {
  if (item.status === "pending") {
    return (
      <span
        className="upload-status-pill upload-status-pill--pending"
        data-testid={`status-pill-${item.key}`}
      >
        Pending
      </span>
    );
  }
  if (item.status === "uploading") {
    return (
      <span
        className="upload-status-pill upload-status-pill--uploading"
        role="status"
        data-testid={`status-pill-${item.key}`}
      >
        <span className="upload-loading-spinner" aria-hidden="true" />
        Uploading…
      </span>
    );
  }
  if (item.status === "complete") {
    return (
      <span
        className="upload-status-pill upload-status-pill--complete"
        data-testid={`status-pill-${item.key}`}
      >
        Done
      </span>
    );
  }
  return (
    <span
      className="upload-status-pill upload-status-pill--failed"
      data-testid={`status-pill-${item.key}`}
    >
      Error
    </span>
  );
}

// ─── Per-file CSV preview ──────────────────────────────────────────
//
// Reads the first ~10KB of the file with FileReader and renders the
// header + first 5 data rows in a small table. Uses a tiny inline
// CSV split rather than pulling in papaparse — we only need
// best-effort header/row inspection, not perfect quote/escape handling.

function parsePreview(text: string): { header: string[]; rows: string[][] } {
  // Split into lines, dropping a trailing empty line if the file ended in \n.
  const lines = text
    .split(/\r?\n/)
    .filter((l, i, arr) => !(i === arr.length - 1 && l === ""));
  if (lines.length === 0) return { header: [], rows: [] };

  // Naive CSV split that handles double-quoted fields.
  function splitRow(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQuote = false;
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQuote = true;
      } else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  const header = splitRow(lines[0]!);
  const rows = lines.slice(1, 1 + PREVIEW_ROWS).map(splitRow);
  return { header, rows };
}

const KNOWN_HEADER_KEYWORDS = [
  "date",
  "amount",
  "description",
  "merchant",
  "transaction",
  "debit",
  "credit",
];

function looksLikeKnownFormat(header: string[]): boolean {
  const lower = header.map((h) => h.toLowerCase());
  // Heuristic: a recognizable bank export should contain at least a
  // date column and either an amount column or a debit/credit column.
  const hasDate = lower.some((h) => h.includes("date"));
  const hasMoney = lower.some(
    (h) => h.includes("amount") || h.includes("debit") || h.includes("credit"),
  );
  return (
    hasDate &&
    hasMoney &&
    lower.some((h) => KNOWN_HEADER_KEYWORDS.some((k) => h.includes(k)))
  );
}

function FilePreview({ file, fileKey }: { file: File; fileKey: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled) return;
      const result = reader.result;
      if (typeof result === "string") setText(result);
      else setError("Could not read file");
    };
    reader.onerror = () => {
      if (!cancelled) setError("Could not read file");
    };
    // Slice so we never read more than ~10KB even for very large files.
    reader.readAsText(file.slice(0, PREVIEW_BYTES));
    return () => {
      cancelled = true;
      reader.abort();
    };
  }, [file]);

  const parsed = useMemo(
    () => (text ? parsePreview(text) : null),
    [text],
  );
  const isKnown = parsed ? looksLikeKnownFormat(parsed.header) : true;

  if (error) {
    return (
      <p
        className="upload-preview-error"
        data-testid={`preview-error-${fileKey}`}
      >
        {error}
      </p>
    );
  }
  if (!parsed) {
    return (
      <p
        className="upload-preview-loading"
        data-testid={`preview-loading-${fileKey}`}
      >
        Reading file…
      </p>
    );
  }
  if (parsed.header.length === 0) {
    return (
      <p
        className="upload-preview-error"
        data-testid={`preview-error-${fileKey}`}
      >
        File appears to be empty.
      </p>
    );
  }

  return (
    <div
      className="upload-preview"
      data-testid={`preview-table-${fileKey}`}
    >
      {!isKnown && (
        <p
          className="upload-preview-warning"
          role="status"
          data-testid={`preview-warning-${fileKey}`}
        >
          Header doesn't match a known bank format — best-effort parsing will
          be used.
        </p>
      )}
      <div className="upload-preview-scroll">
        <table className="upload-preview-table">
          <thead>
            <tr>
              {parsed.header.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.length === 0 ? (
              <tr>
                <td colSpan={parsed.header.length}>
                  No data rows in the first {PREVIEW_BYTES / 1024}&nbsp;KB.
                </td>
              </tr>
            ) : (
              parsed.rows.map((row, i) => (
                <tr key={i}>
                  {parsed.header.map((_, ci) => (
                    <td key={ci}>{row[ci] ?? ""}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Account selector ──────────────────────────────────────────────
//
// Carried over from the pre-refactor Upload page essentially as-is —
// it lets a power user create a new account inline without leaving
// the upload flow even after they have one. The bank-account *gate*
// in the parent only triggers when the user has zero accounts.

function AccountSelector({
  accounts,
  value,
  onChange,
  disabled,
  fileKey,
}: {
  accounts: AuthAccount[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  fileKey: string;
}) {
  const { createAccount } = useAuth();
  const [creating, setCreating] = useState(false);
  const [prevAccountId, setPrevAccountId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [accountType, setAccountType] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const mutationError =
    createAccount.error instanceof Error ? createAccount.error.message : null;
  const shownError = formError ?? mutationError;
  const busy = createAccount.isPending;

  function openCreateForm(currentId: number | null) {
    setPrevAccountId(currentId);
    onChange(null);
    setCreating(true);
    createAccount.reset();
    setFormError(null);
    setLabel("");
    setLastFour("");
    setAccountType("");
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === "__create__") {
      openCreateForm(value);
    } else {
      onChange(Number(e.target.value));
    }
  }

  function handleCancel() {
    onChange(prevAccountId);
    setCreating(false);
    setFormError(null);
    createAccount.reset();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createAccount.reset();
    const trimmed = label.trim();
    if (!trimmed) {
      setFormError("Account name is required");
      return;
    }
    try {
      const result = await createAccount.mutateAsync({
        label: trimmed,
        ...(lastFour !== "" ? { lastFour } : {}),
        ...(accountType.trim() !== ""
          ? { accountType: accountType.trim() }
          : {}),
      });
      onChange(result.account.id);
      setCreating(false);
    } catch {
      /* shown via shownError */
    }
  }

  if (creating) {
    return (
      <form
        className="upload-new-account"
        onSubmit={(e) => void handleCreate(e)}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleCancel();
        }}
        data-testid={`form-new-account-${fileKey}`}
      >
        <p className="upload-new-account-title">New account</p>
        <div className="upload-new-account-fields">
          <input
            className="upload-new-account-input"
            type="text"
            placeholder="e.g. Chase Checking, Business Visa"
            autoComplete="off"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
            required
            autoFocus
            data-testid={`input-new-account-label-${fileKey}`}
          />
          <input
            className="upload-new-account-input upload-new-account-input--short"
            type="text"
            placeholder="Last 4 digits (optional)"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={lastFour}
            onChange={(e) =>
              setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            disabled={busy}
            data-testid={`input-new-account-last-four-${fileKey}`}
          />
          <input
            className="upload-new-account-input"
            type="text"
            placeholder="e.g. checking, savings, cash"
            autoComplete="off"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            disabled={busy}
            data-testid={`input-new-account-type-${fileKey}`}
          />
        </div>
        {shownError && (
          <p
            className="upload-new-account-error"
            role="alert"
            data-testid={`error-new-account-${fileKey}`}
          >
            {shownError}
          </p>
        )}
        <div className="upload-new-account-actions">
          <button
            type="submit"
            className="upload-new-account-submit"
            disabled={busy}
            data-testid={`button-create-account-${fileKey}`}
          >
            {busy ? "Creating…" : "Create account"}
          </button>
          <button
            type="button"
            className="upload-new-account-cancel"
            onClick={handleCancel}
            disabled={busy}
            data-testid={`button-cancel-new-account-${fileKey}`}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <select
      className="upload-select"
      value={value ?? ""}
      onChange={handleSelectChange}
      disabled={disabled}
      data-testid={`select-account-${fileKey}`}
    >
      {value === null && <option value="">Select account…</option>}
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label}
          {a.lastFour ? ` (****${a.lastFour})` : ""}
        </option>
      ))}
      <option value="__create__">+ New account…</option>
    </select>
  );
}
