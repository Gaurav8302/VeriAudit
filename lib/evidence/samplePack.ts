export interface SampleFile {
  readonly filename: string;
  readonly path: string;
  readonly kind: string;
  readonly domain: "financial" | "legal" | "cyber" | "procurement";
}

export const SAMPLE_PACKS: readonly SampleFile[] = [
  {
    filename: "revenue-recognition-policy.txt",
    path: "/product-samples/revenue-recognition-policy.txt",
    kind: "Policy",
    domain: "financial",
  },
  {
    filename: "q4-general-ledger.csv",
    path: "/product-samples/q4-general-ledger.csv",
    kind: "Ledger",
    domain: "financial",
  },
  {
    filename: "dpa-processor-addendum.txt",
    path: "/product-samples/dpa-processor-addendum.txt",
    kind: "Contract",
    domain: "legal",
  },
  {
    filename: "privileged-access-review.txt",
    path: "/product-samples/privileged-access-review.txt",
    kind: "Access log",
    domain: "cyber",
  },
  {
    filename: "purchase-orders.csv",
    path: "/product-samples/purchase-orders.csv",
    kind: "Approval record",
    domain: "procurement",
  },
];

export function sampleFilesFor(domain?: string): readonly SampleFile[] {
  if (!domain) return SAMPLE_PACKS;
  const matched = SAMPLE_PACKS.filter((item) => item.domain === domain);
  return matched.length ? matched : SAMPLE_PACKS.filter((item) => item.domain === "financial");
}
