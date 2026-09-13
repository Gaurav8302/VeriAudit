import Link from "next/link";
import { AuditList } from "@/components/product/AuditList";
import { SampleExport } from "@/components/product/SampleExport";
import { Term } from "@/components/product/Term";

export default function AuditsPage() {
  return (
    <>
      <p className="va-intro">
        An <Term name="audit">audit</Term> is the workspace. An{" "}
        <Term name="execution">execution</Term> is a particular run inside it.
        Not ready to upload your own data? Use the sample audits to explore the
        workspace.
      </p>
      <div className="va-actions">
        <Link href="/product/audits/new" className="va-btn va-btn-primary">
          Create audit
        </Link>
        <SampleExport />
        <Link href="/product/data" className="va-btn">
          Sample data
        </Link>
      </div>
      <AuditList />
    </>
  );
}
