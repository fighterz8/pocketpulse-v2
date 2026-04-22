import { useEffect, useRef } from "react";

export const DEFAULT_INACTIVITY_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

/**
 * Fires `onTimeout` after `timeoutMs` of no user activity (defaults to 30
 * minutes). Any mouse move, click, keypress, touch, or scroll resets the
 * timer. Pass `enabled: false` (e.g. when the user is not authenticated) to
 * skip attaching listeners entirely.
 */
export function useInactivityLogout({
  enabled,
  onTimeout,
  timeoutMs = DEFAULT_INACTIVITY_MS,
}: {
  enabled: boolean;
  onTimeout: () => void;
  timeoutMs?: number;
}) {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;

    let timerId: ReturnType<typeof setTimeout>;

    function reset() {
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        onTimeoutRef.current();
      }, timeoutMs);
    }

    reset();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      clearTimeout(timerId);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [enabled, timeoutMs]);
}
