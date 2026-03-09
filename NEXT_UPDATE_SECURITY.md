# Update Status Snapshot

This file is now a status snapshot of the work already reviewed against the codebase.

For the remaining forward-looking backlog, refer to `NEXT_UPDATE_ROADMAP.md`.

## Completed

### Session and auth hardening

- `SESSION_SECRET` is required in production.
- Sessions are stored server-side in PostgreSQL.
- Session cookies use `httpOnly`, `sameSite="lax"`, and `secure` in production.
- Logout destroys the server session and clears the cookie.
- The app trusts the proxy so secure cookies work correctly behind TLS termination.

### Basic authentication protections

- Login and registration have basic rate limiting.
- Emails are normalized before auth flows.
- Passwords are length-validated and bcrypt-hashed.
- Company name length is validated on registration.

### API and response hardening

- API response body logging has been removed.
- Internal 5xx responses are generalized instead of exposing raw server errors.
- Baseline security headers are set:
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Strict-Transport-Security` in production

### Upload and export hardening

- CSV uploads require a CSV filename and accepted CSV-like MIME types.
- Exported transaction CSV cells are neutralized against spreadsheet formula injection.

### Authorization boundaries

- Transaction, upload, and account access is scoped by authenticated `userId`.

### Analysis drilldowns and UX

- Analysis summary cards are clickable.
- Analysis delta cards are clickable.
- Analysis category breakdown rows are clickable.
- Analysis leak preview cards are clickable.
- Analysis drilldowns carry the active date range into the ledger.

### Manual ledger edits

- Manual ledger edits auto-save through the transaction update endpoint.
- Manual edits are persisted as manual/user-corrected updates.
- Ledger updates now invalidate and refetch transaction, cashflow, leak, and analysis queries.

### Validation already completed

- `npm run check`: passed
- `npm run build`: passed
- `npm audit --omit=dev`: passed with 0 vulnerabilities

## Partially Completed

### CSRF protection

- Same-origin write protection is in place via `Origin` / `Referer` validation.
- A full token-based CSRF layer is not implemented yet.

### LLM privacy controls

- LLM labeling remains opt-in by environment flag.
- There is still no explicit user-facing consent/settings flow for enabling third-party labeling.

### Upload abuse protections

- File size and file type checks exist.
- Row-count caps, duplicate-import protection, and per-user upload throttling are still missing.

### Analysis drilldown parity

- Clickable Analysis drilldowns exist.
- Some non-metric Analysis drilldowns still do not show the same metric banner/summary treatment as dashboard drilldowns.

## Still Open

1. Replace in-memory auth throttling with a durable shared limiter.
2. Add a user-facing privacy/settings flow for LLM labeling.
3. Add upload row-count limits, duplicate-import protection, and per-user upload throttling.
4. Review and clean up secret hygiene around deployment artifacts and local caches.
5. Create a dedicated deployment/security checklist for production and Replit deployment.
6. Run the Replit security scan and address any remaining platform-specific findings.

## Notes

- A full `npm audit` still reports dev-tooling issues in build-time packages.
- Those do not affect the deployed runtime surface in the same way as production dependencies, but they should still be tracked and updated when safe, especially around `drizzle-kit`.
