import Link from "next/link";
import { AuditList } from "@/components/product/AuditList";
import { StartSampleAudit } from "@/components/product/StartSampleAudit";

export default function AuditsPage() {
  return (
    <>
      <div className="va-actions">
        <StartSampleAudit />
        <Link href="/product/audits/new" className="va-btn">
          Create Audit
        </Link>
      </div>
      <AuditList />
    </>
  );
}
