"use client";

import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";

export function ClearLocalWorkspace() {
  const workspace = useWorkspace();
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="va-section">
      <h2>Local workspace</h2>
      <p className="va-empty">
        Local audits, sample evidence, and findings live in this browser. The
        September revenue example is a protected sample and is not deleted.
      </p>
      <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
        {!confirming ? (
          <button type="button" className="va-btn" onClick={() => setConfirming(true)}>
            Clear local work
          </button>
        ) : (
          <>
            <button type="button" className="va-btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="va-btn va-btn-primary"
              onClick={() => {
                workspace.clearLocal();
                setConfirming(false);
              }}
            >
              Confirm clear local work
            </button>
          </>
        )}
      </div>
    </section>
  );
}