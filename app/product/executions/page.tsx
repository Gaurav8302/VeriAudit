import { GlobalExecutionList } from "@/components/product/GlobalExecutionList";
import { listWorkspaceExecutions } from "@/lib/product/workspace";

export default function ExecutionsPage() {
  const executions = listWorkspaceExecutions();

  return (
    <>
      <p className="va-intro">
        An audit is the long-lived case. An execution is one recorded run.
        Reopening later creates a new execution rather than rewrite the old
        one.
      </p>
      <GlobalExecutionList catalog={executions} />
    </>
  );
}
