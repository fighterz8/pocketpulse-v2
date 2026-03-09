# Next Update Roadmap

This file contains only the remaining backlog after the latest implementation audit.

For historical context and what is already complete, see `NEXT_UPDATE_SECURITY.md`.

## Security Follow-Up

### 1. Durable rate limiting

- Replace the in-memory auth limiter with a shared durable store.
- Preferred direction:
  - PostgreSQL-backed counters keyed by IP/email scope, or
  - a dedicated external rate-limit store if deployment architecture grows
- Goal:
  - limits survive restarts
  - limits work correctly across multiple app instances

### 2. Stronger CSRF protection

- Keep the existing `Origin` / `Referer` validation.
- Decide whether to add a token-based CSRF layer for authenticated write requests.
- Apply consistently across all cookie-authenticated state-changing routes.

## Privacy and LLM Controls

### 3. User-facing LLM privacy controls

- Add a settings/privacy surface that explains:
  - when LLM labeling is enabled
  - what transaction fields may be sent to third-party providers
  - how to disable that behavior
- Add clear product copy before enabling LLM labeling in production by default.
- Keep LLM labeling disabled by default in production unless consent/product messaging is finalized.

## Upload Hardening

### 4. Upload abuse protections

- Add CSV row-count limits.
- Reject obviously malformed files earlier in the upload pipeline.
- Add per-user upload throttling.

### 5. Duplicate import protection

- Prevent importing the same CSV into the same account from silently duplicating rows.
- Preferred protections:
  - upload fingerprinting / dedup heuristics
  - duplicate-row detection during import
  - clear user feedback when a likely duplicate import is detected

## Deployment and Secret Hygiene

### 6. Deployment security checklist

- Create a dedicated production checklist covering:
  - `SESSION_SECRET`
  - `DATABASE_URL`
  - optional sensitive provider keys like `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
  - cookie/session expectations on Replit deployment
  - custom domain / HTTPS expectations
  - key rotation procedures

### 7. Secret-hygiene review

- Review whether any environment snapshots, cache artifacts, or generated files contain secrets.
- Confirm those artifacts are not exposed in deployed assets or shared backups.
- Remove or exclude sensitive caches where appropriate.

### 8. Replit security scan follow-up

- Run the Replit security scan after the above items are in place.
- Triage and fix any platform-specific findings that remain.

## UX and Product Polish

### 9. Analysis drilldown parity

- Bring non-metric Analysis drilldowns closer to dashboard drilldown behavior.
- Candidate improvements:
  - richer ledger banner/summary context for non-metric drilldowns
  - clearer labeling for range-based and recurring-confidence drilldowns

### 10. Data refresh clarity

- Continue reducing stale-data confusion after imports, reprocesses, and manual edits.
- Candidate improvements:
  - explicit refresh states after reprocess/import
  - stronger cache refresh behavior where helpful
  - user-facing confirmation that downstream analytics have been recalculated
