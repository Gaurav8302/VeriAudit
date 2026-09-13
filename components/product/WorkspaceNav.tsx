"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { suffix: "", label: "Workspace" },
  { suffix: "/evidence", label: "Evidence" },
  { suffix: "/findings", label: "Findings" },
  { suffix: "/trace", label: "Activity" },
] as const;

export function WorkspaceNav({ auditId }: { auditId: string }) {
  const pathname = usePathname();
  const base = `/product/audits/${auditId}`;

  return (
    <nav className="va-tabs" aria-label="Audit workspace">
      {TABS.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const onWorkspace = pathname === base || pathname.endsWith("/ai");
        const onActivity = pathname.includes("/trace") || pathname.includes("/executions");
        const active =
          tab.suffix === ""
            ? onWorkspace && !pathname.includes("/evidence") && !pathname.includes("/findings")
            : tab.suffix === "/trace"
              ? onActivity
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
