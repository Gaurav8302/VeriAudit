"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRODUCT_DOMAINS } from "@/lib/product/localWorkspace";
import type { ProductDomain } from "@/lib/product/workspace";
import { ProductExplainer } from "./ProductExplainer";
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
        You are creating an <Term name="audit">audit</Term> that an AI assistant
        will help you perform. A new execution starts immediately. Humans review
        findings. New work stays unsealed until you close and seal it.
      </p>
      <ProductExplainer
        title="What is the AI doing?"
        body="The assistant analyzes the evidence you provide, performs audit tasks, and records the important actions it takes so the work can be reviewed later."
      />
      <form className="va-section" onSubmit={submit}>
        <h2>Create audit</h2>
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
            Audit type
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
              rows={3}
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
        <section className="va-create-ai">
          <p className="va-kicker">AI audit assistant</p>
          <h3>This audit opens into a working assistant.</h3>
          <p>
            After you create it, attach evidence or try the sample pack. The
            assistant will analyze that material, perform the tasks you assign,
            and record its actions on the execution for later review.
          </p>
          <p className="meta">
            AI assists. Humans review. VeriAudit records the execution. It does
            not approve the audit on its own.
          </p>
        </section>
        {error ? <p className="va-empty">{error}</p> : null}
        <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
          <button type="submit" className="va-btn va-btn-primary">
            Create audit
          </button>
        </div>
      </form>
      <p className="va-empty">
        Evidence is added in the workspace, not on this form. The new audit
        starts open, with one empty execution. Nothing here is sealed or
        verified.
      </p>
    </>
  );
}
