/**
 * Unit tests for the password-reset storage layer.
 *
 * `db` is mocked so these tests never touch real PostgreSQL — they verify:
 *   1. `constantTimeHashEquals` behaves correctly across length, encoding,
 *      and value mismatches (the timing-safe verification primitive).
 *   2. `issuePasswordResetToken` first invalidates the user's older live
 *      tokens, then inserts and returns the new row.
 *   3. `consumePasswordResetTokenAndUpdatePassword` looks up by tokenId
 *      (not by hash equality), runs the timing-safe comparison BEFORE
 *      checking used/expired (so attackers can't time-distinguish), and
 *      atomically writes both the consume mark and the new password
 *      hash inside one transaction. Bad selector / bad verifier / used /
 *      expired all return null cleanly.
 *   4. `deleteExpiredPasswordResetTokens` issues a DELETE filtered on
 *      `expires_at <= now()`.
 */
import crypto from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---- mock db.js BEFORE importing storage.js ----
// vi.mock factories are hoisted, so any references they make must come
// from vi.hoisted() to avoid the "Cannot access X before initialization"
// temporal-dead-zone error.
const { txMock, dbMock } = vi.hoisted(() => {
  const tx = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };
  const db = {
    transaction: vi.fn(
      async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx),
    ),
    delete: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };
  return { txMock: tx, dbMock: db };
});

vi.mock("./db.js", () => ({
  db: dbMock,
  pool: {},
  ensureUserPreferences: vi.fn(),
}));

import {
  constantTimeHashEquals,
  consumePasswordResetTokenAndUpdatePassword,
  deleteExpiredPasswordResetTokens,
  issuePasswordResetToken,
} from "./storage.js";

const sha256Hex = (s: string) =>
  crypto.createHash("sha256").update(s).digest("hex");

/**
 * Minimal chainable query-builder stub that pretends to be a Drizzle
 * fluent chain. Each method returns `this` until the chain is awaited
 * (or `.then` is invoked), at which point the configured `result` is
 * returned. `.returning()` returns the result directly so callers using
 * `await tx.update(...).returning()` get an array back as expected.
 */
function chain<T>(result: T) {
  const calls: { method: string; args: unknown[] }[] = [];
  const recorder = {
    calls,
    set(...args: unknown[]) {
      calls.push({ method: "set", args });
      return recorder;
    },
    where(...args: unknown[]) {
      calls.push({ method: "where", args });
      return recorder;
    },
    from(...args: unknown[]) {
      calls.push({ method: "from", args });
      return recorder;
    },
    values(...args: unknown[]) {
      calls.push({ method: "values", args });
      return recorder;
    },
    limit(...args: unknown[]) {
      calls.push({ method: "limit", args });
      return Promise.resolve(result);
    },
    returning(...args: unknown[]) {
      calls.push({ method: "returning", args });
      return Promise.resolve(result);
    },
    then(onFulfilled: (v: T) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return recorder;
}

describe("constantTimeHashEquals", () => {
  it("returns true for identical hex strings", () => {
    const h = sha256Hex("hello");
    expect(constantTimeHashEquals(h, h)).toBe(true);
  });

  it("returns false for differing hashes of the same length", () => {
    expect(
      constantTimeHashEquals(sha256Hex("a"), sha256Hex("b")),
    ).toBe(false);
  });

  it("returns false when lengths differ (no throw)", () => {
    expect(constantTimeHashEquals("abcd", "abcdef")).toBe(false);
    expect(constantTimeHashEquals("", sha256Hex("x"))).toBe(false);
  });

  it("returns false for non-hex input (no throw)", () => {
    const valid = sha256Hex("x");
    const bogus = "z".repeat(valid.length);
    expect(constantTimeHashEquals(valid, bogus)).toBe(false);
  });

  it("returns false for non-string input (no throw)", () => {
    // @ts-expect-error — testing runtime guard
    expect(constantTimeHashEquals(undefined, "ab")).toBe(false);
    // @ts-expect-error — testing runtime guard
    expect(constantTimeHashEquals("ab", null)).toBe(false);
  });
});

describe("issuePasswordResetToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("first invalidates the user's older unused tokens, then inserts and returns the new row", async () => {
    const newRow = {
      id: 5,
      userId: 42,
      tokenHash: "h",
      expiresAt: new Date("2030-01-01"),
      usedAt: null,
      createdAt: new Date("2030-01-01"),
    };
    const updateChain = chain([]);
    const insertChain = chain([newRow]);
    txMock.update.mockReturnValueOnce(updateChain);
    txMock.insert.mockReturnValueOnce(insertChain);

    const result = await issuePasswordResetToken(
      42,
      "verifierhash",
      new Date("2030-01-01"),
    );
    expect(result).toEqual(newRow);

    // The invalidating UPDATE happens before the INSERT.
    expect(txMock.update).toHaveBeenCalledTimes(1);
    expect(txMock.insert).toHaveBeenCalledTimes(1);
    const updateOrder = (txMock.update.mock.invocationCallOrder[0] ?? 0);
    const insertOrder = (txMock.insert.mock.invocationCallOrder[0] ?? 0);
    expect(updateOrder).toBeLessThan(insertOrder);

    // The UPDATE sets usedAt (mark older live tokens consumed).
    const setCall = updateChain.calls.find((c) => c.method === "set");
    expect(setCall).toBeDefined();
    expect(setCall!.args[0]).toMatchObject({ usedAt: expect.any(Date) });

    // The INSERT carries the supplied userId / verifier hash / expiry.
    const valuesCall = insertChain.calls.find((c) => c.method === "values");
    expect(valuesCall).toBeDefined();
    expect(valuesCall!.args[0]).toEqual({
      userId: 42,
      tokenHash: "verifierhash",
      expiresAt: new Date("2030-01-01"),
    });
  });

  it("throws when the insert returns no row (DB invariant violation)", async () => {
    txMock.update.mockReturnValueOnce(chain([]));
    txMock.insert.mockReturnValueOnce(chain([]));
    await expect(
      issuePasswordResetToken(1, "h", new Date(Date.now() + 60_000)),
    ).rejects.toThrow(/insert did not return/i);
  });
});

describe("consumePasswordResetTokenAndUpdatePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null without touching the DB for invalid tokenId", async () => {
    expect(
      await consumePasswordResetTokenAndUpdatePassword(0, "x", "p"),
    ).toBeNull();
    expect(
      await consumePasswordResetTokenAndUpdatePassword(-1, "x", "p"),
    ).toBeNull();
    expect(
      // @ts-expect-error — runtime guard
      await consumePasswordResetTokenAndUpdatePassword(1.5, "x", "p"),
    ).toBeNull();
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it("returns null when the selector points to no row", async () => {
    txMock.select.mockReturnValueOnce(chain([])); // empty result
    const result = await consumePasswordResetTokenAndUpdatePassword(
      99,
      sha256Hex("anything"),
      "newhash",
    );
    expect(result).toBeNull();
    expect(txMock.update).not.toHaveBeenCalled();
  });

  it("returns null when the verifier hash mismatches (timing-safe path rejects)", async () => {
    const stored = sha256Hex("real-verifier");
    txMock.select.mockReturnValueOnce(
      chain([
        {
          id: 1,
          userId: 7,
          tokenHash: stored,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        },
      ]),
    );
    const result = await consumePasswordResetTokenAndUpdatePassword(
      1,
      sha256Hex("wrong-verifier"),
      "newhash",
    );
    expect(result).toBeNull();
    // Crucially: no UPDATE was issued — we did not even attempt the
    // conditional consume because the verifier failed up front.
    expect(txMock.update).not.toHaveBeenCalled();
  });

  it("returns null when the row exists but is already used", async () => {
    const verifier = "real-verifier";
    txMock.select.mockReturnValueOnce(
      chain([
        {
          id: 1,
          userId: 7,
          tokenHash: sha256Hex(verifier),
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: new Date(Date.now() - 1_000),
        },
      ]),
    );
    const result = await consumePasswordResetTokenAndUpdatePassword(
      1,
      sha256Hex(verifier),
      "newhash",
    );
    expect(result).toBeNull();
    expect(txMock.update).not.toHaveBeenCalled();
  });

  it("returns null when the row exists but is expired", async () => {
    const verifier = "real-verifier";
    txMock.select.mockReturnValueOnce(
      chain([
        {
          id: 1,
          userId: 7,
          tokenHash: sha256Hex(verifier),
          expiresAt: new Date(Date.now() - 60_000),
          usedAt: null,
        },
      ]),
    );
    const result = await consumePasswordResetTokenAndUpdatePassword(
      1,
      sha256Hex(verifier),
      "newhash",
    );
    expect(result).toBeNull();
    expect(txMock.update).not.toHaveBeenCalled();
  });

  it("on a valid live token, marks it used and rotates the user's password (atomic)", async () => {
    const verifier = "real-verifier";
    const computed = sha256Hex(verifier);
    txMock.select.mockReturnValueOnce(
      chain([
        {
          id: 1,
          userId: 7,
          tokenHash: computed,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        },
      ]),
    );
    const consumeUpdate = chain([{ id: 1, userId: 7 }]);
    const passwordUpdate = chain([]);
    txMock.update
      .mockReturnValueOnce(consumeUpdate) // mark used
      .mockReturnValueOnce(passwordUpdate); // rotate password

    const result = await consumePasswordResetTokenAndUpdatePassword(
      1,
      computed,
      "new-bcrypt-hash",
    );
    expect(result).toEqual({ userId: 7 });

    // Both updates ran inside the same transaction, in order.
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(txMock.update).toHaveBeenCalledTimes(2);

    // Consume sets usedAt; password update sets the new hash.
    const consumeSet = consumeUpdate.calls.find((c) => c.method === "set");
    expect(consumeSet!.args[0]).toMatchObject({ usedAt: expect.any(Date) });
    const pwSet = passwordUpdate.calls.find((c) => c.method === "set");
    expect(pwSet!.args[0]).toMatchObject({ password: "new-bcrypt-hash" });
  });

  it("returns null if the conditional consume UPDATE matches no rows (race lost)", async () => {
    const verifier = "real-verifier";
    const computed = sha256Hex(verifier);
    txMock.select.mockReturnValueOnce(
      chain([
        {
          id: 1,
          userId: 7,
          tokenHash: computed,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        },
      ]),
    );
    // Conditional UPDATE returns no rows (e.g. concurrent consumer
    // got there first).
    txMock.update.mockReturnValueOnce(chain([]));

    const result = await consumePasswordResetTokenAndUpdatePassword(
      1,
      computed,
      "new-bcrypt-hash",
    );
    expect(result).toBeNull();
    // Password rotate must NOT have run.
    expect(txMock.update).toHaveBeenCalledTimes(1);
  });
});

describe("deleteExpiredPasswordResetTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a DELETE filtered by expiresAt", async () => {
    const deleteChain = chain([]);
    dbMock.delete.mockReturnValueOnce(deleteChain);
    await deleteExpiredPasswordResetTokens();
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(
      deleteChain.calls.some((c) => c.method === "where"),
    ).toBe(true);
  });
});
