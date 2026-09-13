import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FAQS } from "@/components/marketing/copy";

describe("public landing copy", () => {
  it("keeps the FAQ honest about product maturity", () => {
    const ready = FAQS.find((item) => item.q === "Is the product production-ready?");
    expect(ready?.a).toMatch(/early product build/i);
    expect(ready?.a).toMatch(/work in progress/i);
    expect(ready?.a).not.toMatch(/production-scale enterprise/i);
  });

  it("does not claim CooL proves the AI was correct", () => {
    const cool = FAQS.find((item) => item.q === "What does CooL do?");
    expect(cool?.a).toMatch(/does not prove the AI was correct/i);
    expect(cool?.a).toMatch(/cryptographic evidence/i);
  });

  it("defines TRACE as a reconstructable path, not a new explanation", () => {
    const trace = FAQS.find((item) => item.q === "What is an execution trace?");
    expect(trace?.a).toMatch(/recorded causal path/i);
    expect(trace?.a).toMatch(/not a new explanation/i);
  });

  it("does not expose a direct product shortcut on the public landing page", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/marketing/ProductLanding.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/PRODUCT_SHORTCUT/);
    expect(source).not.toMatch(/Explore the Product/);
    expect(source).not.toMatch(/href=["']\/product["']/);
  });

  it("explains verification without claiming the AI was correct", () => {
    const verify = FAQS.find((item) => item.q === "What does verification mean?");
    expect(verify?.a).toMatch(/cryptographic evidence/i);
    expect(verify?.a).toMatch(/does not prove the AI was correct/i);
  });
});
