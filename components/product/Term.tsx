import type { ReactNode } from "react";
import { TERMS } from "@/lib/product/terms";

export function Term({
  name,
  children,
}: {
  name: keyof typeof TERMS;
  children: ReactNode;
}) {
  return (
    <abbr className="va-term" title={TERMS[name]}>
      {children}
    </abbr>
  );
}
