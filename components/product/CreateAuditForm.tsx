"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRODUCT_DOMAINS } from "@/lib/product/localWorkspace";
import type { ProductDomain } from "@/lib/product/workspace";
import { ProductExplainer } from "./ProductExplainer";
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
      <p className="va-intro">Create an AI-assisted audit workspace. The assistant starts as soon as the execution opens.</p>
      <ProductExplainer
        title="What happens next?"
        body="You will land in the workspace. Attach evidence, then ask the AI audit assistant to begin. Humans review findings. Nothing is sealed until you close the execution and request a CooL seal."
      />
      <form className="va-section" onSubmit={submit}>
        <h2>New workspace</h2>
        <div className="va-form">
          <label>
            Audit name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="September Revenue Recognition"
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
            Objective / controls
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What should the assistant investigate? Which controls or policies apply?"
            />
          </label>
          <label>
            Period
            <input
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              placeholder="2026-Q3"
            />
          </label>
          <label>
            Reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="ENG-2026-14"
            />
          </label>
        </div>
        <section className="va-create-ai">
          <p className="va-kicker">AI audit assistant</p>
          <h3>Your next step is to ask the AI to begin the audit.</h3>
          <p>Evidence is attached in the workspace. The assistant reviews that material and records every meaningful action on the new execution.</p>
        </section>
        {error ? <p className="va-empty">{error}</p> : null}
        <div className="va-actions" style={{ padding: "0 1rem 1rem" }}>
          <button type="submit" className="va-btn va-btn-primary">
            Create workspace
          </button>
        </div>
      </form>
    </>
  );
}
