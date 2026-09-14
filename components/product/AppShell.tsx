"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { isAuditWorkspace, isStudioWorkspace, pageMeta } from "@/lib/product/pageMeta";
import "./app.css";

const PRIMARY = [
  { href: "/product", label: "Home", exact: true },
  { href: "/product/audits", label: "Audits" },
  { href: "/product/audits/new", label: "Create Audit", exact: true },
] as const;

const STUDIO_PRIMARY = PRIMARY.filter((item) => item.label !== "Create Audit");

const SECONDARY = [
  { href: "/product/evidence", label: "Evidence" },
  { href: "/product/executions", label: "Activity" },
] as const;

const INVESTIGATION = [
  { href: "/product/evidence", label: "Evidence" },
  { href: "/product/findings", label: "Findings" },
  { href: "/product/executions", label: "Activity" },
] as const;

function active(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  if (href === "/product/audits") return pathname === href || /^\/product\/audits\/(?!new$).+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = pageMeta(pathname);
  const workspace = isAuditWorkspace(pathname);
  const studio = isStudioWorkspace(pathname);

  return (
    <div className={studio ? "va is-studio" : "va"}>
      <aside className="va-side" aria-label="Product">
        <BrandMark href="/product" variant="compact" />
        <nav className="va-nav">
          <p className="va-group">Primary</p>
          {(studio ? STUDIO_PRIMARY : PRIMARY).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={active(pathname, item.href, "exact" in item && item.exact) ? "va-link is-active" : "va-link"}
            >
              {item.label}
            </Link>
          ))}
          {studio ? (
            <>
              <p className="va-group">Secondary</p>
              {SECONDARY.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={active(pathname, item.href) ? "va-link is-active" : "va-link"}
                >
                  {item.label}
                </Link>
              ))}
            </>
          ) : (
            <>
              <p className="va-group">Investigation</p>
              {INVESTIGATION.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={active(pathname, item.href) ? "va-link is-active" : "va-link"}
                >
                  {item.label}
                </Link>
              ))}
              <p className="va-group">Secondary</p>
              <Link
                href="/product/data"
                className={active(pathname, "/product/data") ? "va-link is-active" : "va-link"}
              >
                Sample data
              </Link>
              <Link
                href="/product/settings"
                className={active(pathname, "/product/settings") ? "va-link is-active" : "va-link"}
              >
                Settings
              </Link>
            </>
          )}
        </nav>
        <div className="va-side-foot">
          <Link href="/" className="va-back">
            ← Back to VeriAudit
          </Link>
          <Link href="/demo">View demo</Link>
        </div>
      </aside>
      <div className="va-main">
        {studio ? null : (
          <header className="va-chrome">
            <p className="va-chrome-label">{meta.chrome}</p>
            <nav className="va-chrome-actions" aria-label="Workspace actions">
              <Link href="/" className="va-back">
                ← Back to VeriAudit
              </Link>
              <Link href="/#faq">Help</Link>
              <Link href="/demo">Replay demo</Link>
            </nav>
          </header>
        )}
        <div className="va-body">
          {!workspace && (
            <header className="va-page">
              <h1>{meta.title}</h1>
              <p>{meta.lede}</p>
            </header>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
