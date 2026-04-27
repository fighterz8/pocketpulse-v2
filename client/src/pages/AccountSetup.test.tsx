import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../components/ui/tooltip";
import { AccountSetup } from "./AccountSetup";

const { mockCreateAccount, mockLogout } = vi.hoisted(() => ({
  mockCreateAccount: {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null as Error | null,
    reset: vi.fn(),
  },
  mockLogout: {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null as Error | null,
    reset: vi.fn(),
  },
}));

vi.mock("../hooks/use-auth", () => ({
  useAuth: () => ({
    createAccount: mockCreateAccount,
    logout: mockLogout,
  }),
}));

function setup() {
  const onCreated = vi.fn();
  const onSkip = vi.fn();
  render(
    <TooltipProvider delayDuration={0}>
      <AccountSetup onCreated={onCreated} onSkip={onSkip} />
    </TooltipProvider>,
  );
  return { onCreated, onSkip };
}

describe("AccountSetup", () => {
  beforeEach(() => {
    mockCreateAccount.mutateAsync.mockReset();
    mockCreateAccount.reset.mockReset();
    mockCreateAccount.isPending = false;
    mockCreateAccount.error = null;
    mockLogout.mutateAsync.mockReset();
    mockLogout.mutateAsync.mockResolvedValue(undefined);
    mockLogout.isPending = false;
  });

  it("renders the Step 1 of 2 chrome and the new bank-account heading", () => {
    setup();
    expect(screen.getByTestId("text-onboarding-step")).toHaveTextContent(
      /step 1 of 2/i,
    );
    expect(screen.getByTestId("text-account-setup-title")).toHaveTextContent(
      /add your first bank account/i,
    );
    // Subhead explains why we need an account.
    expect(
      screen.getByText(/PocketPulse organizes transactions/i),
    ).toBeInTheDocument();
  });

  it("reveals the account-type hint tooltip when the icon is focused", async () => {
    setup();
    const trigger = screen.getByTestId("hint-account-type");
    expect(trigger).toHaveAttribute("aria-label", "About account type");
    fireEvent.focus(trigger);
    const content = await screen.findByTestId("hint-account-type-content");
    expect(content).toHaveTextContent(/classify transfers/i);
  });

  it("renders the bank-card preview and updates as the user types", () => {
    setup();
    const preview = screen.getByTestId("account-preview");
    expect(preview).toBeInTheDocument();
    expect(screen.getByTestId("text-preview-label")).toHaveTextContent(
      "Your account",
    );
    // The Last 4 input was removed from this onboarding form (Task #119),
    // so the preview no longer shows a masked-card "•••• ••••" row.
    expect(screen.queryByTestId("text-preview-digits")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("input-account-last-four"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-account-label"), {
      target: { value: "Chase Checking" },
    });
    fireEvent.change(screen.getByTestId("input-account-type"), {
      target: { value: "checking" },
    });

    expect(screen.getByTestId("text-preview-label")).toHaveTextContent(
      "Chase Checking",
    );
    expect(screen.getByTestId("text-preview-type")).toHaveTextContent(
      "checking",
    );
  });

  it("submits with only label + accountType (no lastFour key in payload)", async () => {
    mockCreateAccount.mutateAsync.mockResolvedValueOnce({
      account: {
        id: 9,
        userId: 1,
        label: "Chase",
        lastFour: null,
        accountType: "checking",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    setup();
    fireEvent.change(screen.getByTestId("input-account-label"), {
      target: { value: "Chase" },
    });
    fireEvent.change(screen.getByTestId("input-account-type"), {
      target: { value: "checking" },
    });
    fireEvent.click(screen.getByTestId("button-create-account"));
    await waitFor(() => {
      expect(mockCreateAccount.mutateAsync).toHaveBeenCalledTimes(1);
    });
    const payload = mockCreateAccount.mutateAsync.mock.calls[0][0];
    expect(payload).toEqual({ label: "Chase", accountType: "checking" });
    expect(payload).not.toHaveProperty("lastFour");
  });

  it("submits the form and calls onCreated with the created account on success", async () => {
    const created = {
      id: 7,
      userId: 1,
      label: "Chase",
      lastFour: null,
      accountType: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockCreateAccount.mutateAsync.mockResolvedValueOnce({ account: created });
    const { onCreated, onSkip } = setup();

    fireEvent.change(screen.getByTestId("input-account-label"), {
      target: { value: "Chase" },
    });
    fireEvent.click(screen.getByTestId("button-create-account"));

    await waitFor(() => {
      expect(mockCreateAccount.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ label: "Chase" }),
      );
      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith(created);
    });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("does NOT call onCreated when createAccount fails", async () => {
    mockCreateAccount.mutateAsync.mockRejectedValueOnce(
      new Error("Network down"),
    );
    mockCreateAccount.error = new Error("Network down");
    const { onCreated } = setup();
    fireEvent.change(screen.getByTestId("input-account-label"), {
      target: { value: "Chase" },
    });
    fireEvent.click(screen.getByTestId("button-create-account"));
    await waitFor(() => {
      expect(mockCreateAccount.mutateAsync).toHaveBeenCalled();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("calls onSkip when the user clicks Skip for now", () => {
    const { onSkip, onCreated } = setup();
    const link = screen.getByTestId("link-skip-onboarding-step-1");
    expect(link).toHaveTextContent(/skip for now/i);
    fireEvent.click(link);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    expect(mockCreateAccount.mutateAsync).not.toHaveBeenCalled();
  });

  it("renders only the Nickname → Account type fields (Last 4 removed)", () => {
    setup();
    const labels = Array.from(
      document.querySelectorAll<HTMLSpanElement>(".auth-label"),
    ).map((el) => (el.textContent ?? "").trim());
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/^Nickname/);
    expect(labels[1]).toMatch(/^Account type/);
    // Belt-and-braces: the Last 4 hint and input must be gone.
    expect(screen.queryByTestId("hint-last-four")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("input-account-last-four"),
    ).not.toBeInTheDocument();
  });

  it("renders the nickname hint trigger", () => {
    setup();
    const hint = screen.getByTestId("hint-nickname");
    expect(hint).toHaveAttribute("aria-label", "About the nickname");
  });

  it("calls logout when the user clicks Back to login", async () => {
    setup();
    const back = screen.getByTestId("link-back-to-login");
    expect(back).toHaveTextContent(/back to login/i);
    fireEvent.click(back);
    await waitFor(() => {
      expect(mockLogout.mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("blocks empty submission with an inline validation error", async () => {
    setup();
    const form = screen.getByTestId("input-account-label").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByTestId("error-account-setup")).toHaveTextContent(
        /account name is required/i,
      );
    });
    expect(mockCreateAccount.mutateAsync).not.toHaveBeenCalled();
  });
});
