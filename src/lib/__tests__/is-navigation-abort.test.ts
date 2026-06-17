import { describe, expect, it } from "vitest";
import { isAbortError, isNavigationAbort } from "@/lib/is-navigation-abort";

function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

describe("isNavigationAbort", () => {
  it("swallows a native AbortError when our signal aborted", () => {
    const err = new DOMException("The user aborted a request.", "AbortError");
    expect(isNavigationAbort(err, abortedSignal())).toBe(true);
  });

  it("swallows a supabase-wrapped abort (message prefixed 'AbortError') when our signal aborted", () => {
    // postgrest-js shape: { message: `${err.name}: ${err.message}`, ... }
    const err = {
      message: "AbortError: The user aborted a request.",
      details: "",
      hint: "",
      code: "",
    };
    expect(isNavigationAbort(err, abortedSignal())).toBe(true);
  });

  it("does NOT swallow a real 'Failed to fetch' network error even when the signal aborted", () => {
    const err = new TypeError("Failed to fetch");
    expect(isNavigationAbort(err, abortedSignal())).toBe(false);
  });

  it("does NOT swallow a supabase-wrapped 'TypeError: Failed to fetch' error", () => {
    const err = {
      message: "TypeError: Failed to fetch",
      details: "",
      hint: "",
      code: "",
    };
    expect(isNavigationAbort(err, abortedSignal())).toBe(false);
  });

  it("does NOT swallow an AbortError when the signal was NOT aborted by us", () => {
    const controller = new AbortController();
    const err = new DOMException("aborted", "AbortError");
    expect(isNavigationAbort(err, controller.signal)).toBe(false);
  });

  it("does NOT swallow when no signal is provided", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isNavigationAbort(err, undefined)).toBe(false);
    expect(isNavigationAbort(err, null)).toBe(false);
  });

  it("does NOT swallow a null/undefined error", () => {
    expect(isNavigationAbort(null, abortedSignal())).toBe(false);
    expect(isNavigationAbort(undefined, abortedSignal())).toBe(false);
  });
});

describe("isAbortError", () => {
  it("matches Chrome's no-reason abort wording from controller.abort()", () => {
    // `controller.abort()` with no argument rejects fetch with a DOMException
    // named "AbortError" whose message is "signal is aborted without reason" —
    // the exact error the debug panel was logging on org-switch query cancels.
    const err = new DOMException(
      "signal is aborted without reason",
      "AbortError",
    );
    expect(isAbortError(err)).toBe(true);
  });

  it("matches a native AbortError regardless of any signal", () => {
    const err = new DOMException("The user aborted a request.", "AbortError");
    expect(isAbortError(err)).toBe(true);
  });

  it("matches a supabase-wrapped abort (message prefixed 'AbortError')", () => {
    const err = { message: "AbortError: signal is aborted without reason" };
    expect(isAbortError(err)).toBe(true);
  });

  it("does NOT match a real 'Failed to fetch' network error", () => {
    expect(isAbortError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isAbortError({ message: "TypeError: Failed to fetch" })).toBe(false);
  });

  it("does NOT match null/undefined", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});
