import { ExecutionBoard } from "@/components/product/ExecutionBoard";
import { Term } from "@/components/product/Term";

export const dynamic = "force-dynamic";

export default async function AuditExecutionsPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;

  return (
    <>
      <p className="va-lede">
        An <Term name="audit">audit</Term> is the case. An{" "}
        <Term name="execution">execution</Term> is a particular run of work.
        Reopening later creates a new execution. It does not rewrite the
        original sealed trail.
      </p>
      <ExecutionBoard auditId={auditId} />
    </>
  );
}
