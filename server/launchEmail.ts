/**
 * PocketPulse launch email — HTML template sent to all waitlist subscribers
 * on May 23, 2025.
 *
 * Design mirrors the Coming Soon card: dark navy background, blue accent,
 * pulse waveform motif, clean typography.
 */
export function buildLaunchEmailHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PocketPulse is live!</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;background:linear-gradient(160deg,#1e293b 0%,#0f172a 100%);
                      border:1px solid rgba(99,179,237,0.18);border-radius:20px;
                      box-shadow:0 0 48px rgba(99,179,237,0.08);overflow:hidden;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#3b82f6,#60a5fa,#3b82f6);"></td>
          </tr>

          <!-- Logo / header -->
          <tr>
            <td align="center" style="padding:40px 40px 0;">
              <!-- Pulse waveform SVG logo -->
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="52" height="52" rx="14" fill="#1e3a5f"/>
                <polyline points="6,26 14,26 18,14 22,38 26,20 30,32 34,26 46,26"
                          fill="none" stroke="#60a5fa" stroke-width="2.8"
                          stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p style="margin:14px 0 2px;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#f1f5f9;">
                PocketPulse
              </p>
              <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#60a5fa;font-weight:600;">
                We&rsquo;re live
              </p>
            </td>
          </tr>

          <!-- Hero text -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#f8fafc;line-height:1.25;letter-spacing:-0.5px;">
                Your finances,<br/>finally under control.
              </h1>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#94a3b8;">
                Today is the day you signed up for. PocketPulse — the CSV&#8209;based
                financial transaction analyser — is now open to everyone.
                Import your bank exports, categorise transactions automatically,
                and get the clarity your money deserves.
              </p>
            </td>
          </tr>

          <!-- Feature pills -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
                <tr>
                  <td style="padding:0 6px 0 0;">
                    <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);
                                border-radius:10px;padding:16px 14px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:20px;">📊</p>
                      <p style="margin:0;font-size:12px;font-weight:600;color:#93c5fd;">Dashboard</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#64748b;line-height:1.4;">
                        Spending trends at a glance
                      </p>
                    </div>
                  </td>
                  <td style="padding:0 6px;">
                    <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);
                                border-radius:10px;padding:16px 14px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:20px;">🏷️</p>
                      <p style="margin:0;font-size:12px;font-weight:600;color:#93c5fd;">Auto-Categorize</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#64748b;line-height:1.4;">
                        Smart labels from import
                      </p>
                    </div>
                  </td>
                  <td style="padding:0 0 0 6px;">
                    <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);
                                border-radius:10px;padding:16px 14px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:20px;">🔄</p>
                      <p style="margin:0;font-size:12px;font-weight:600;color:#93c5fd;">Recurring</p>
                      <p style="margin:4px 0 0;font-size:11px;color:#64748b;line-height:1.4;">
                        Subscriptions detected
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:32px 40px 0;">
              <a href="https://pocket-pulse.com"
                 style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);
                        color:#fff;font-size:16px;font-weight:700;text-decoration:none;
                        padding:14px 40px;border-radius:12px;
                        box-shadow:0 4px 24px rgba(59,130,246,0.35);letter-spacing:0.2px;">
                Get started &rarr;
              </a>
            </td>
          </tr>

          <!-- Quote / value prop -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="background:rgba(99,179,237,0.06);border-left:3px solid #3b82f6;
                          border-radius:0 8px 8px 0;padding:16px 18px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#94a3b8;font-style:italic;">
                  &ldquo;PocketPulse turns a messy CSV export into a clear picture of
                  where your money actually goes — in seconds.&rdquo;
                </p>
                <p style="margin:8px 0 0;font-size:12px;color:#60a5fa;font-weight:600;">
                  — Team PennySavers, NUS CIS490B
                </p>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:28px 40px 0;">
              <div style="height:1px;background:rgba(99,179,237,0.12);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#475569;">
                You signed up for the PocketPulse waitlist — that&rsquo;s why you&rsquo;re hearing from us.
              </p>
              <p style="margin:0;font-size:11px;color:#334155;">
                &copy; 2025 PocketPulse &middot; NUS CIS490B &middot; Team PennySavers
              </p>
            </td>
          </tr>

          <!-- Bottom accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#3b82f6,#60a5fa,#3b82f6);"></td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildLaunchEmailText(): string {
  return `Hey there,

PocketPulse is officially live!

The CSV-based financial transaction analyser you signed up for is now open to everyone.

What you get:
• Dashboard — spending trends at a glance
• Auto-Categorize — smart labels from the moment you import
• Recurring detection — subscriptions caught automatically

Get started: https://pocket-pulse.com

—
Team PennySavers, NUS CIS490B
You're receiving this because you joined the PocketPulse waitlist.
© 2025 PocketPulse`;
}
