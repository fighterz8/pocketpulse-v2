import { FormEvent, useState } from "react";

const BETA_CODE =
  (import.meta.env.VITE_BETA_CODE as string | undefined)?.trim().toLowerCase() ||
  "pennysavers2025";

export function ComingSoon({ onUnlock }: { onUnlock: () => void }) {
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.trim().toLowerCase() === BETA_CODE) {
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setTimeout(() => setError(false), 2500);
    }
  }

  return (
    <main className="app-main auth-main auth-main--centered auth-main--editorial" style={{ minHeight: "100vh" }}>
      <div className="auth-card auth-card--capture" style={{ maxWidth: "26rem", textAlign: "center" }}>

        <div className="auth-brand-row" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
          <span className="auth-brand" data-testid="cs-brand">PocketPulse</span>
          <span className="auth-brand-dot" aria-hidden="true" />
        </div>

        <div aria-hidden="true" style={{
          position: "relative",
          margin: "0 auto 1.75rem",
          width: "9rem",
          height: "4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "cs-pulse 2.8s ease-in-out infinite",
        }}>
          <div style={{
            position: "absolute",
            inset: "-12px 0",
            borderRadius: "999px",
            background: "radial-gradient(ellipse at center, rgb(14 165 233 / 0.18), transparent 72%)",
            filter: "blur(8px)",
          }} />
          <svg
            viewBox="0 0 32 14"
            fill="none"
            style={{ width: "100%", height: "100%", position: "relative", filter: "drop-shadow(0 0 8px rgb(14 165 233 / 0.55))" }}
          >
            <defs>
              <linearGradient id="cs-logo-grad" x1="0" y1="0" x2="32" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <polyline
              points="0,7 6,7 9,1 12,13 15,7 32,7"
              stroke="url(#cs-logo-grad)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="auth-title" style={{ textAlign: "center", marginBottom: "0.5rem" }} data-testid="cs-heading">
          Coming Soon
        </h1>
        <p className="auth-subtitle" style={{ textAlign: "center", marginBottom: "1.5rem" }} data-testid="cs-tagline">
          Smart financial clarity for everyone.
          <br />
          We're putting the finishing touches on PocketPulse.
        </p>

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          justifyContent: "center",
          marginBottom: "1.75rem",
        }}>
          {["CSV Import", "AI Classification", "Spending Insights"].map((label) => (
            <span key={label} style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              padding: "0.25rem 0.7rem",
              borderRadius: "999px",
              background: "rgb(14 165 233 / 0.1)",
              color: "#0369a1",
              border: "1px solid rgb(14 165 233 / 0.2)",
            }}>{label}</span>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgb(15 23 42 / 0.08)", paddingTop: "1.25rem" }}>
          {!showInput ? (
            <button
              type="button"
              data-testid="cs-beta-toggle"
              onClick={() => setShowInput(true)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                font: "inherit",
                fontSize: "0.78rem",
                color: "#94a3b8",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Have a beta access code?
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              data-testid="cs-beta-form"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                animation: shaking ? "cs-shake 0.45s ease" : undefined,
              }}
            >
              <label style={{ textAlign: "left" }}>
                <span style={{
                  display: "block",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}>
                  Beta Access Code
                </span>
                <input
                  className="auth-input"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={code}
                  data-testid="cs-code-input"
                  onChange={(e) => { setCode(e.target.value); setError(false); }}
                  placeholder="Enter code"
                  style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
                />
              </label>
              {error && (
                <p role="alert" data-testid="cs-error" style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "#dc2626",
                  textAlign: "center",
                }}>
                  Invalid code — try again.
                </p>
              )}
              <button className="auth-submit" type="submit" data-testid="cs-submit">
                Unlock
              </button>
              <button
                type="button"
                onClick={() => { setShowInput(false); setCode(""); setError(false); }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: "0.78rem",
                  color: "#94a3b8",
                }}
              >
                Cancel
              </button>
            </form>
          )}
        </div>

      </div>

      <style>{`
        @keyframes cs-pulse {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 22px rgb(14 165 233 / 0.38); }
          50%       { transform: scale(1.07); box-shadow: 0 0 32px rgb(14 165 233 / 0.55); }
        }
        @keyframes cs-shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}
