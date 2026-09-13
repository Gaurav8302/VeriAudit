"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRODUCT_DOMAINS } from "@/lib/product/localWorkspace";
import type { ProductDomain } from "@/lib/product/workspace";
import { Term } from "./Term";
import { useWorkspace } from "./WorkspaceProvider";

export function CreateAuditForm() {
  const router = useRouter();
  const workspace = useWorkspace();
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<ProductDomain>("financial");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [period, setPeriod] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const audit = workspace.createAudit({ title, domain, description, reference, period });
      router.push(`/product/audits/${audit.auditId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the audit.");
    }
  }

  return (
    <>
      <p className="va-intro">
        You are creating an <Term name="audit">audit</Term> workspace. A new
        execution starts immediately. AI can assist; humans review findings.
        New work stays unsealed.
      </p>
      <form className="va-section" onSubmit={submit}>
        <h2>New audit</h2>
        <div className="va-form">
          <label>
            Audit name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Q4 Revenue Recognition Review"
              required
            />
          </label>
          <label>
            Domain
            <select value={domain} onChange={(event) => setDomain(event.target.value as ProductDomain)}>
              {PRODUCT_DOMAINS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="What is in scope, and why this review exists."
            />
          </label>
          <label>
            Optional period
            <input
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              placeholder="2026-Q4"
            />
          </label>
          <label>
            Optional audit reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="ENG-2026-14"
            />
          </label>
        </div>
        {error ? <p className="va-empty">{error}</p> : null}
        <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
          <button type="submit" className="va-btn va-btn-primary">
            Create audit
          </button>
        </div>
      </form>
      <p className="va-empty">
        The new audit starts open, with one empty execution. Nothing here is
        sealed or verified.
      </p>
    </>
  );
}
