import { describe, expect, it } from "vitest";
import { FAQS } from "@/components/marketing/copy";
import { PRODUCT_SHORTCUT } from "@/components/marketing/product-shortcut";

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

  it("keeps the product pathway pointed at the workspace", () => {
    expect(PRODUCT_SHORTCUT.href).toBe("/product");
    expect(PRODUCT_SHORTCUT.label).toMatch(/explore the product/i);
    expect(PRODUCT_SHORTCUT.note).toMatch(/you've seen the demonstration/i);
  });

  it("explains verification without claiming the AI was correct", () => {
    const verify = FAQS.find((item) => item.q === "What does verification mean?");
    expect(verify?.a).toMatch(/cryptographic evidence/i);
    expect(verify?.a).toMatch(/does not prove the AI was correct/i);
  });
});
