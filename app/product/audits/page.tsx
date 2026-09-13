import Link from "next/link";
import { AuditList } from "@/components/product/AuditList";

export default function AuditsPage() {
  return (
    <>
      <div className="va-actions">
        <Link href="/product/audits/new" className="va-btn va-btn-primary">
          Create Audit
        </Link>
      </div>
      <AuditList />
    </>
  );
}
