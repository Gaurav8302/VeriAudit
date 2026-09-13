"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuditExecutions } from "./LineageProvider";

export function ReopenAudit({
  auditId,
  stayOnPage = false,
}: {
  auditId: string;
  stayOnPage?: boolean;
}) {
  const router = useRouter();
  const { canReopen, reopen } = useAuditExecutions(auditId);
  const [open, setOpen] = useState(false);

  if (!canReopen) return null;

  function confirm() {
    reopen();
    setOpen(false);
    if (!stayOnPage) {
      router.push(`/product/audits/${auditId}/executions`);
    }
  }

  return (
    <>
      <button type="button" className="va-btn" onClick={() => setOpen(true)}>
        Reopen audit
      </button>
      {open && (
        <div className="va-dialog-back" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="va-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reopen-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reopen-title">Reopen audit?</h2>
            <p>
              This will create a new execution connected to the existing sealed
              execution. The original execution and its trail will remain
              unchanged.
            </p>
            <div className="va-actions">
              <button type="button" className="va-btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="va-btn va-btn-primary" onClick={confirm}>
                Create New Execution
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
