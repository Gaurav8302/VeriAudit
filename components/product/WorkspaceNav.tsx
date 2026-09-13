"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { suffix: "", label: "Workspace" },
  { suffix: "/evidence", label: "Evidence" },
  { suffix: "/findings", label: "Findings" },
  { suffix: "/ai", label: "Ask VeriAudit" },
  { suffix: "/executions", label: "Executions" },
  { suffix: "/trace", label: "Trace" },
] as const;

export function WorkspaceNav({ auditId }: { auditId: string }) {
  const pathname = usePathname();
  const base = `/product/audits/${auditId}`;

  return (
    <nav className="va-tabs" aria-label="Audit workspace">
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const onTrace = pathname.includes("/trace");
        const onExecutions = pathname.includes("/executions");
        const active =
          tab.suffix === ""
            ? pathname === base
            : tab.suffix === "/trace"
              ? onTrace
              : tab.suffix === "/executions"
                ? onExecutions && !onTrace
                : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={active ? "is-active" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
