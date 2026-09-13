import { GlobalExecutionList } from "@/components/product/GlobalExecutionList";
import { listWorkspaceExecutions } from "@/lib/product/workspace";

export default function ExecutionsPage() {
  const executions = listWorkspaceExecutions();

  return (
    <>
      <p className="va-intro">
        Activity across recorded executions. An execution is one run inside an
        audit. Reopening creates a new execution and leaves the old one unchanged.
      </p>
      <GlobalExecutionList catalog={executions} />
    </>
  );
}
