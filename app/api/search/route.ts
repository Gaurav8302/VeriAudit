/**
 * GET /api/search?q=... — deterministic historical search.
 *
 * Query params:
 *   q            free text (empty → recent activity)
 *   after        ISO timestamp (inclusive)
 *   before       ISO timestamp (inclusive)
 *   since        7 | 30 | 90  (days before DEMO_TODAY)
 *   domain       financial | legal | cyber | procurement
 *   type         activity or event type
 *   audit        audit id
 *   status       completed | exception | in_review | scheduled | open
 *   evidence     cool | none | any
 */
import { NextResponse } from "next/server";
import { search } from "@/lib/search";
import type { SearchFilters } from "@/lib/search/types";
import type { Scenario } from "@/lib/audit/types";

export const runtime = "nodejs";

const DOMAINS = new Set<Scenario>(["financial", "legal", "cyber", "procurement"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? "";

  const sinceRaw = params.get("since");
  const sinceDays =
    sinceRaw === "7" || sinceRaw === "30" || sinceRaw === "90"
      ? (Number(sinceRaw) as 7 | 30 | 90)
      : undefined;
  if (sinceRaw !== null && sinceDays === undefined) {
    return NextResponse.json({ error: "since must be 7, 30, or 90" }, { status: 400 });
  }

  const domain = params.get("domain");
  if (domain !== null && !DOMAINS.has(domain as Scenario)) {
    return NextResponse.json({ error: `unknown domain ${domain}` }, { status: 400 });
  }

  const evidence = params.get("evidence");
  if (evidence !== null && evidence !== "cool" && evidence !== "none" && evidence !== "any") {
    return NextResponse.json({ error: "evidence must be cool, none, or any" }, { status: 400 });
  }

  const filters: SearchFilters = {
    ...(params.get("after") ? { after: params.get("after")! } : {}),
    ...(params.get("before") ? { before: params.get("before")! } : {}),
    ...(sinceDays === undefined ? {} : { sinceDays }),
    ...(domain === null ? {} : { domain: domain as Scenario }),
    ...(params.get("type") ? { type: params.get("type")! } : {}),
    ...(params.get("audit") ? { auditId: params.get("audit")! } : {}),
    ...(params.get("status") ? { status: params.get("status") as SearchFilters["status"] } : {}),
    ...(evidence === null || evidence === "any" ? {} : { evidence }),
  };

  return NextResponse.json(search(q, filters));
}
