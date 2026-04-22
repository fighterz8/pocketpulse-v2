import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInactivityLogout } from "./use-inactivity-logout";

const INACTIVITY_MS = 30 * 60 * 1000;

describe("useInactivityLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onTimeout after 30 minutes of no activity when enabled", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityLogout({ enabled: true, onTimeout }));

    expect(onTimeout).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(INACTIVITY_MS - 1);
    });
    expect(onTimeout).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("resets the timer when activity events occur, so onTimeout does not fire", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityLogout({ enabled: true, onTimeout }));

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    // Repeatedly fire activity events just before the timeout would expire.
    for (const eventName of activityEvents) {
      act(() => {
        vi.advanceTimersByTime(INACTIVITY_MS - 1000);
      });
      act(() => {
        window.dispatchEvent(new Event(eventName));
      });
      expect(onTimeout).not.toHaveBeenCalled();
    }

    // After all those resets the timer should still not have fired even though
    // far more than 30 minutes of wall-clock simulated time has elapsed.
    expect(onTimeout).not.toHaveBeenCalled();

    // But once activity stops, the next full window will trigger it.
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_MS);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does not fire onTimeout when disabled, even after the timeout window", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityLogout({ enabled: false, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(INACTIVITY_MS * 2);
    });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("uses the latest onTimeout callback without re-attaching listeners", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useInactivityLogout({ enabled: true, onTimeout: cb }),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });

    act(() => {
      vi.advanceTimersByTime(INACTIVITY_MS);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
