"use client";

import { useState } from "react";
import { APPROVED_CLAIMS } from "@/lib/demo/copy";

const CHAIN = [
  "Evidence",
  "Ingestion",
  "Retrieval",
  "Model",
  "Control",
  "Finding",
  "Review",
  "Conclusion",
  "Verification",
] as const;

const PRODUCT_FLOW = [
  "Upload",
  "Work with AI",
  "AI performs actions",
  "Human reviews / edits",
  "Consequential actions recorded",
  "Searchable execution memory",
  "Reconstruct",
  "Verify",
] as const;

const DIRECTION = [
  "Upload documents",
  "AI audit agents",
  "Conversational AI workspace",
  "Real-time AI action recording",
  "Human-in-the-loop review",
  "Persistent organizational memory",
  "Execution and version history",
  "Search",
  "Team workspaces",
  "Authentication",
  "Access control",
  "CooL sealing",
  "Reconstruction",
  "Verification",
] as const;

const BUYERS = [
  "Internal audit teams",
  "Compliance teams",
  "Financial teams",
  "Legal teams",
  "Risk teams",
  "Enterprise AI teams",
] as const;

const CONCERNS = [
  "Can we explain what our AI did?",
  "Can we reconstruct the reasoning process?",
  "Can we distinguish new work from historical changes?",
  "Can we prove that a historical execution has not been rewritten?",
] as const;

export function Landing({
  completed,
  onStart,
}: {
  completed: boolean;
  onStart: () => void;
}) {
  return (
    <div className="home">
      <header className="home-bar">
        <p className="chrome-mark">VeriAudit</p>
        <button type="button" className="primary tight" onClick={onStart}>
          {completed ? "Start the demo again" : "Start the demo"}
        </button>
      </header>

      {completed ? <Completed onStart={onStart} /> : <Entry onStart={onStart} />}
    </div>
  );
}

function Entry({ onStart }: { onStart: () => void }) {
  return (
    <main className="home-grid">
      <section className="home-hero">
        <p className="kicker">VeriAudit</p>
        <h1 className="display home-display">Verify the execution, not just the outcome.</h1>
        <p className="lede">
          AI can produce an answer in seconds. Months later, someone may ask:
        </p>
        <blockquote className="quote">
          <p>Why did it make that decision?</p>
        </blockquote>
        <p className="lede lede-follow">
          {APPROVED_CLAIMS.welcome} VeriAudit preserves the execution trail so
          teams can reconstruct, understand, and verify what happened.
        </p>
        <button type="button" className="primary" onClick={onStart}>
          Start the demo
        </button>
      </section>

      <aside className="home-aside" aria-label="How an execution is held">
        <p className="kicker">The record</p>
        <ol className="concept">
          {CHAIN.map((step, index) => (
            <li key={step}>
              {index > 0 && <span className="concept-line" aria-hidden="true" />}
              <span className="concept-dot" aria-hidden="true" />
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="home-aside-note">
          Evidence, decision, and human review stay attached to one execution.
        </p>
      </aside>
    </main>
  );
}

function Completed({ onStart }: { onStart: () => void }) {
  const [declared, setDeclared] = useState(false);

  return (
    <main className="home-done">
      <section className="home-hero">
        <p className="kicker">You&apos;ve seen the principle</p>
        <h1 className="display home-display">Now imagine this running across an organization.</h1>
        <p className="lede">
          Today&apos;s experience demonstrates the core idea using a controlled
          audit scenario.
        </p>
        <p className="lede lede-follow">
          The same principle — findable, reconstructable, and cryptographically
          verifiable work — can hold wherever AI helps with decisions people may
          later need to explain.
        </p>
      </section>

      <section className="home-block">
        <p className="section-label">The product we can build</p>
        <ol className="concept product-flow">
          {PRODUCT_FLOW.map((step, index) => (
            <li key={step}>
              {index > 0 && <span className="concept-line" aria-hidden="true" />}
              <span className="concept-dot" aria-hidden="true" />
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-split">
        <div>
          <p className="section-label">Product direction</p>
          <p className="home-vision-lead">
            Not already implemented. Capabilities a real product would need:
          </p>
          <ul className="direction">
            {DIRECTION.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="section-label">Who would use this</p>
          <ul className="plain buyers">
            {BUYERS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="section-label">What they ask</p>
          <ul className="plain buyers">
            {CONCERNS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-block home-close">
        <p className="kicker">The work ahead</p>
        <h2 className="home-sub">Built as a demonstration. Designed to become a product.</h2>
        <p className="lede">
          Today, VeriAudit demonstrates one focused capability: making
          AI-assisted audit work traceable and verifiable.
        </p>
        <p className="lede lede-follow">
          The larger product is an AI workspace where companies can perform
          consequential work while maintaining a searchable, reconstructable
          history of what happened.
        </p>
        <p className="lede lede-follow">
          Employees could use it for audit, compliance, legal review, financial
          analysis, cybersecurity investigations, procurement, and other
          workflows where an AI-generated decision may need to be explained
          later.
        </p>
        <p className="lede lede-follow">
          With focused development over the next six months, the goal is to turn
          this from a demonstrated concept into a product companies can actually
          use.
        </p>
        <div className="home-close-actions">
          <button type="button" className="primary" onClick={onStart}>
            Start the demo again
          </button>
          {declared ? (
            <p className="home-thanks">
              <span className="kicker">Thank you</span>
              You won&apos;t regret it.
            </p>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() => setDeclared(true)}
            >
              Or declare this as the winning project
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
