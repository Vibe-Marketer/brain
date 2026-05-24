import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Edge-function shim: when vitest imports a module from supabase/functions/_shared,
// any top-level `Deno.env.get(...)` call resolves through this stub instead of
// throwing ReferenceError. Falls back to process.env so tests can still drive
// configuration through real env vars when needed.
const denoGlobal = globalThis as unknown as {
  Deno?: { env: { get: (key: string) => string | undefined } };
};
if (!denoGlobal.Deno) {
  denoGlobal.Deno = { env: { get: (key: string) => process.env[key] } };
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Mock localStorage for Supabase auth
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorageMock.clear();
});
