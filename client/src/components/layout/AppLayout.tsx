import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "../../lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Ledger" },
  { href: "/leaks", label: "Recurring Leak Review" },
  { href: "/upload", label: "Upload" },
] as const;

export function AppLayout({
  children,
  onLogout,
  logoutPending = false,
}: {
  children: ReactNode;
  onLogout: () => void;
  logoutPending?: boolean;
}) {
  const [location] = useLocation();

  return (
    <div className="app-protected">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span className="app-sidebar-brand-dot" />
          <p className="app-nav-brand">PocketPulse</p>
        </div>

        <nav className="app-nav" aria-label="Main navigation">
          <ul className="app-nav-list">
            {NAV_ITEMS.map(({ href, label }) => {
              const isActive = location === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={cn("app-nav-link", isActive && "app-nav-link--active")}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="app-sidebar-footer">
          <button
            type="button"
            className="app-nav-logout"
            disabled={logoutPending}
            onClick={() => onLogout()}
            data-testid="btn-logout"
          >
            {logoutPending ? "Signing out…" : "Logout"}
          </button>
        </div>
      </aside>

      <main className="app-layout-main">{children}</main>
    </div>
  );
}
