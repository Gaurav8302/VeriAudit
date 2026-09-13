import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APPROVED_CLAIMS } from "@/lib/demo/copy";
import { DEMO_COMPLETED_KEY, isDemoCompleted, markDemoCompleted } from "@/lib/demo/completion";

function installStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });
  return store;
}

describe("demo completion persistence", () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("is false until verification succeeds", () => {
    expect(isDemoCompleted()).toBe(false);
    markDemoCompleted();
    expect(isDemoCompleted()).toBe(true);
    expect(window.localStorage.getItem(DEMO_COMPLETED_KEY)).toBe("1");
  });

  it("survives a later reread of the same storage", () => {
    markDemoCompleted();
    expect(isDemoCompleted()).toBe(true);
    expect(isDemoCompleted()).toBe(true);
  });
});

describe("product pathway copy", () => {
  it("does not frame the last screen as the end of the demo", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/experience/screens/Verification.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/The demo is complete/);
    expect(source).not.toMatch(/End of demonstration/);
    expect(source).not.toMatch(/Restart demo/);
    expect(source).toMatch(/APPROVED_CLAIMS\.exploreProduct/);
    expect(source).toMatch(/APPROVED_CLAIMS\.restartWalkthrough/);
    expect(APPROVED_CLAIMS.exploreProduct).toBe("Explore the product");
    expect(APPROVED_CLAIMS.restartWalkthrough).toBe("Restart walkthrough");
  });

  it("gates the public landing product CTA on completion", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/marketing/ProductLanding.tsx"),
      "utf8",
    );
    expect(source).toMatch(/completed &&/);
    expect(source).toMatch(/isDemoCompleted/);
    expect(source).not.toMatch(/TEMPORARY DEVELOPMENT SHORTCUT/);
  });
});
