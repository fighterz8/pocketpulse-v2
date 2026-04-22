import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "../../lib/api";

type SampleListItem = {
  id: number;
  createdAt: string;
  completedAt: string | null;
  sampleSize: number;
  categoryAccuracy: number | null;
  classAccuracy: number | null;
  recurrenceAccuracy: number | null;
  confirmedCount: number;
  correctedCount: number;
  skippedCount: number;
};

/** Spec §6: every percent must be paired with a raw fraction. */
function pctWithFraction(
  acc: number | null,
  s: { sampleSize: number; skippedCount: number },
): string {
  if (acc == null) return "—";
  const denom = s.sampleSize - s.skippedCount;
  if (denom <= 0) return "—";
  const num = Math.round(acc * denom);
  return `${(acc * 100).toFixed(0)}% (${num}/${denom})`;
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function TestSuiteIndex() {
  const [samples, setSamples] = useState<SampleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const classRes = await apiFetch("/api/dev/classification-samples");
        if (!classRes.ok) throw new Error(`Failed to load samples (${classRes.status})`);
        const cBody = (await classRes.json()) as { samples: SampleListItem[] };
        if (!cancelled) {
          setSamples(cBody.samples);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleDelete(s: SampleListItem) {
    const label = s.completedAt ? "completed" : "in-progress";
    const confirmed = window.confirm(
      `Delete this ${label} classification sample (started ${fmtDate(s.createdAt)})? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(s.id);
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/dev/classification-samples/${s.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setSamples((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="acc-page" data-testid="page-test-suite-index">
      <div className="acc-page-header">
        <div>
          <h1 className="acc-page-title">Dev Test Suite</h1>
          <p className="acc-page-subtitle">
            Measure PocketPulse on your own data. Verdicts are sandboxed — they do not modify any
            real transactions.
          </p>
        </div>
      </div>

      <div className="acc-explainer glass-card">
        <h2 className="acc-explainer-title">Tools</h2>
        <div className="acc-explainer-grid">
          <div className="acc-explainer-item">
            <span className="acc-explainer-num">A</span>
            <div>
              <strong>Classification sampler</strong>
              <p>
                Pulls 50 random transactions and asks you to verify the classifier's category, class,
                and recurrence. The report breaks accuracy down per dimension and per labelSource so
                you can tell which subsystem is failing.
              </p>
              <p>
                <Link
                  href="/dev/test-suite/classification"
                  className="acc-run-btn"
                  data-testid="link-start-classification"
                >
                  Start classification sample
                </Link>
              </p>
            </div>
          </div>
          <div className="acc-explainer-item">
            <span className="acc-explainer-num">T</span>
            <div>
              <strong>Team side-by-side</strong>
              <p>
                Compares the latest completed classification sample for each whitelisted teammate.
                Useful for milestone documentation.
              </p>
              <p>
                <Link
                  href="/dev/test-suite/team"
                  className="acc-run-btn"
                  data-testid="link-team-summary"
                >
                  Open team view
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="acc-merchants glass-card">
        <h2 className="acc-merchants-title">Past classification samples</h2>
        {deleteError && (
          <div className="acc-error" role="alert" data-testid="text-delete-error">
            {deleteError}
          </div>
        )}
        {error ? (
          <div className="acc-error" role="alert" data-testid="text-samples-error">{error}</div>
        ) : loading ? (
          <p className="acc-empty-text" data-testid="text-samples-loading">Loading…</p>
        ) : samples.length === 0 ? (
          <p className="acc-empty-text" data-testid="text-samples-empty">
            No samples yet. Start one above to see it listed here.
          </p>
        ) : (
          <div className="acc-merchants-table-wrap">
            <table className="acc-merchants-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Size</th>
                  <th>Category</th>
                  <th>Class</th>
                  <th>Recurrence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} data-testid={`row-sample-${s.id}`}>
                    <td>{fmtDate(s.createdAt)}</td>
                    <td>{s.completedAt ? "Completed" : "In progress"}</td>
                    <td>{s.sampleSize}</td>
                    <td>{pctWithFraction(s.categoryAccuracy, s)}</td>
                    <td>{pctWithFraction(s.classAccuracy, s)}</td>
                    <td>{pctWithFraction(s.recurrenceAccuracy, s)}</td>
                    <td>
                      <Link
                        href={`/dev/test-suite/classification/${s.id}`}
                        data-testid={`link-open-sample-${s.id}`}
                      >
                        Open
                      </Link>
                      {" · "}
                      <button
                        type="button"
                        className="acc-link-button"
                        onClick={() => void handleDelete(s)}
                        disabled={deletingId === s.id}
                        data-testid={`button-delete-sample-${s.id}`}
                      >
                        {deletingId === s.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
