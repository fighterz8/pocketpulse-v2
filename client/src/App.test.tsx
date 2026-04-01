import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    isLoading: false,
    isAuthenticated: false as boolean,
    user: null as null | { id: number; email: string; displayName: string },
    meError: null as Error | null,
    refetch: vi.fn(),
    accounts: null as null | { id: number; label: string }[],
    accountsLoading: false,
    accountsError: null as Error | null,
    refetchAccounts: vi.fn(),
    login: {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null as Error | null,
      reset: vi.fn(),
    },
    register: {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null as Error | null,
      reset: vi.fn(),
    },
    createAccount: {
      mutateAsync: vi.fn(),
      isPending: false,
      error: null as Error | null,
      reset: vi.fn(),
    },
  },
}));

vi.mock("./hooks/use-auth", () => ({
  useAuth: () => mockAuthState,
}));

describe("app shell", () => {
  beforeEach(() => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
    mockAuthState.meError = null;
    mockAuthState.refetch.mockReset();
    mockAuthState.login.mutateAsync.mockReset();
    mockAuthState.login.isPending = false;
    mockAuthState.login.error = null;
    mockAuthState.login.reset.mockReset();
    mockAuthState.register.mutateAsync.mockReset();
    mockAuthState.register.isPending = false;
    mockAuthState.register.error = null;
    mockAuthState.register.reset.mockReset();
    mockAuthState.accounts = null;
    mockAuthState.accountsLoading = false;
    mockAuthState.accountsError = null;
    mockAuthState.refetchAccounts.mockReset();
    mockAuthState.createAccount.mutateAsync.mockReset();
    mockAuthState.createAccount.isPending = false;
    mockAuthState.createAccount.error = null;
    mockAuthState.createAccount.reset.mockReset();
  });

  it("renders the app root", () => {
    render(<App />);
    expect(screen.getByTestId("app-root")).toBeInTheDocument();
  });

  it("routes signed-out users to the auth screen", () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    render(<App />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create an account/i }),
    ).toBeInTheDocument();
  });

  it("routes authenticated users with no accounts to account setup onboarding", () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      id: 1,
      email: "user@example.com",
      displayName: "Test User",
    };
    mockAuthState.accountsLoading = false;
    mockAuthState.accounts = [];
    mockAuthState.accountsError = null;
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /set up your first account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /account name/i }),
    ).toBeInTheDocument();
  });

  it("keeps the signed-in workspace shell when the user already has accounts", () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      id: 1,
      email: "user@example.com",
      displayName: "Test User",
    };
    mockAuthState.accountsLoading = false;
    mockAuthState.accounts = [{ id: 10, label: "Cash" }];
    mockAuthState.accountsError = null;
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /^PocketPulse$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/workspace shell/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /set up your first account/i }),
    ).not.toBeInTheDocument();
  });
});
