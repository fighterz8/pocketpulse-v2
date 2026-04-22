import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Auth } from "./Auth";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
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
  },
}));

vi.mock("../hooks/use-auth", () => ({
  useAuth: () => mockAuthState,
}));

describe("Auth page inactivity notice", () => {
  beforeEach(() => {
    mockAuthState.login.mutateAsync.mockReset();
    mockAuthState.login.isPending = false;
    mockAuthState.login.error = null;
    mockAuthState.login.reset.mockReset();
    mockAuthState.register.mutateAsync.mockReset();
    mockAuthState.register.isPending = false;
    mockAuthState.register.error = null;
    mockAuthState.register.reset.mockReset();
  });

  it("shows the inactivity notice when inactivityLogout is true", () => {
    render(<Auth inactivityLogout={true} />);
    const notice = screen.getByTestId("inactivity-notice");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(/logged out due to inactivity/i);
    expect(notice).toHaveAttribute("role", "status");
  });

  it("does not show the inactivity notice when inactivityLogout is false", () => {
    render(<Auth inactivityLogout={false} />);
    expect(screen.queryByTestId("inactivity-notice")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/logged out due to inactivity/i),
    ).not.toBeInTheDocument();
  });

  it("does not show the inactivity notice when inactivityLogout is omitted (default false)", () => {
    render(<Auth />);
    expect(screen.queryByTestId("inactivity-notice")).not.toBeInTheDocument();
  });
});
