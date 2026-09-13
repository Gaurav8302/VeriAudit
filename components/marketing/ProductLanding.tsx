"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { FAQS } from "./copy";
import "./marketing.css";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#why", label: "Why VeriAudit" },
  { href: "#faq", label: "FAQ" },
] as const;

const PIPELINE = [
  {
    id: "analysis",
    label: "AI Analysis",
    line: "AI reads the evidence that is actually in the workspace.",
  },
  {
    id: "evidence",
    label: "Evidence",
    line: "The source material used for that analysis stays attached.",
  },
  {
    id: "finding",
    label: "Finding",
    line: "Potential exceptions are named, with a reason you can inspect.",
  },
  {
    id: "decision",
    label: "Decision",
    line: "A person reviews the result. The AI is not treated as automatically correct.",
  },
  {
    id: "trail",
    label: "Execution Trail",
    line: "The important actions stay in one reconstructable record.",
  },
  {
    id: "verify",
    label: "Verification",
    line: "Sealed executions can be checked later against cryptographic evidence.",
  },
] as const;

const HOW = [
  {
    title: "Upload evidence",
    copy: "Ledgers, policies, and supporting files enter the audit workspace.",
  },
  {
    title: "Work with AI",
    copy: "Ask questions against retrieved evidence, not a story invented after the fact.",
  },
  {
    title: "Review decisions",
    copy: "A person accepts, modifies, or rejects what the model suggested.",
  },
  {
    title: "Verify the execution",
    copy: "When work is closed, CooL can seal the recorded history so it can be checked later.",
  },
] as const;

const CAPABILITIES = [
  {
    title: "AI-assisted audit work",
    copy: "Ask VeriAudit about the evidence attached to one execution. Chat explains the work. The trail records it.",
  },
  {
    title: "Evidence management",
    copy: "Uploads and sample packs stay bound to an execution by ID and fingerprint.",
  },
  {
    title: "Real-time execution trace",
    copy: "Started work, retrieved evidence, findings, and reviews appear as an inspectable sequence.",
  },
  {
    title: "Human review",
    copy: "The AI is never treated as the reviewer. Accept, modify, or reject stays a human act.",
  },
  {
    title: "Cryptographic verification",
    copy: "A sealed execution can be checked against CooL receipts. Verified means the record matches its evidence.",
  },
  {
    title: "Execution lineage",
    copy: "Reopening creates a later execution. The earlier sealed run is not rewritten.",
  },
] as const;

const CASES = [
  {
    domain: "Financial audit",
    problem: "Review transactions and policies for potential exceptions.",
    detail:
      "When revenue is recognised, someone may later ask which ledger line, which policy clause, and which review produced the finding.",
  },
  {
    domain: "Legal audit",
    problem: "Compare contractual obligations against actual actions and records.",
    detail:
      "A clause that should have been present, or a duty that was not followed, needs a path back to the source document.",
  },
  {
    domain: "Cybersecurity audit",
    problem: "Review access and security activity against defined controls.",
    detail:
      "Privileged access, missing MFA, or stale reviews should remain reconstructable months after the scan.",
  },
  {
    domain: "Procurement audit",
    problem: "Check purchasing activity against approval and procurement policies.",
    detail:
      "A purchase order, a vendor approval, and a three-way match belong in the same inspectable record.",
  },
] as const;

const TRACE = [
  "Question",
  "Evidence",
  "Analysis",
  "Finding",
  "Human decision",
  "Trace",
  "Verification",
] as const;

export function ProductLanding() {
  const [step, setStep] = useState<(typeof PIPELINE)[number]["id"]>("analysis");
  const [coolOpen, setCoolOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = PIPELINE.find((item) => item.id === step) ?? PIPELINE[0];

  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-nav-inner">
          <BrandMark href="#top" variant="nav" />
          <nav className="site-links" aria-label="Page">
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="site-nav-end">
            <Link href="/demo" className="site-cta">
              Start the Demo
            </Link>
            <button
              type="button"
              className="site-menu"
              aria-expanded={menuOpen}
              aria-controls="site-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="site-mobile-nav" className="site-mobile" aria-label="Mobile">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link href="/demo" className="site-cta" onClick={() => setMenuOpen(false)}>
              Start the Demo
            </Link>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="site-hero" aria-labelledby="hero-title">
          <div className="site-hero-copy">
            <p className="site-kicker">Trust every audit.</p>
            <h1 id="hero-title" className="site-display">
              AI-powered audits with an execution trail you can verify.
            </h1>
            <p className="site-lead">
              VeriAudit helps audit teams work with AI while preserving the
              evidence, decisions, and execution history behind every result.
            </p>
            <p className="site-sublead">
              AI can produce an answer. Audit work still needs attached evidence,
              a reconstructable trail, and a way to check that the recorded
              history was not silently changed.
            </p>
            <div className="site-actions">
              <Link href="/demo" className="site-cta site-cta-lg">
                Start the Demo
              </Link>
              <a href="#how" className="site-text">
                Explore how it works
              </a>
            </div>
          </div>
          <aside className="site-hero-viz" aria-label="How an execution is held">
            <p className="site-kicker">The record</p>
            <ol className="site-pipe">
              {PIPELINE.map((item, index) => (
                <li key={item.id}>
                  {index > 0 && <span className="site-pipe-line" aria-hidden="true" />}
                  <button
                    type="button"
                    className={item.id === step ? "is-active" : undefined}
                    onClick={() => setStep(item.id)}
                    aria-pressed={item.id === step}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>
            <p className="site-pipe-copy">{active.line}</p>
          </aside>
        </section>

        <section id="why" className="site-band">
          <div className="site-wrap site-split">
            <div>
              <p className="site-kicker">Why VeriAudit</p>
              <h2 className="site-h2">AI can produce an answer. Audit work asks what happened.</h2>
            </div>
            <div className="site-prose">
              <p>
                Anyone can get a fluent reply from a model. Months later, a
                different person may need to know how that reply was produced.
              </p>
              <ul className="site-questions">
                <li>What evidence did it use?</li>
                <li>Why did it make this decision?</li>
                <li>What happened before the conclusion?</li>
                <li>Can we reconstruct the execution later?</li>
                <li>Can we prove the recorded execution was not silently changed?</li>
              </ul>
              <p>
                That is where VeriAudit belongs: connecting AI-assisted work to
                an inspectable execution history. It does not claim the AI was
                right. It holds the record of what the system and the reviewer
                actually did.
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="site-section">
          <div className="site-wrap">
            <p className="site-kicker">How it works</p>
            <h2 className="site-h2">From evidence to a verified execution.</h2>
            <p className="site-intro">
              Four steps. The demo walks this path. The product workspace uses
              the same record of work — not a scoreboard.
            </p>
            <ol className="site-steps">
              {HOW.map((item, index) => (
                <li key={item.title}>
                  <span className="site-step-n">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="use-cases" className="site-band">
          <div className="site-wrap">
            <p className="site-kicker">Use cases</p>
            <h2 className="site-h2">The same question, in four kinds of work.</h2>
            <p className="site-intro">
              These are the domains already established in the demonstration.
              They are product use cases, not claims that a finished enterprise
              suite exists today.
            </p>
            <div className="site-cases">
              {CASES.map((item) => (
                <article key={item.domain}>
                  <h3>{item.domain}</h3>
                  <p className="site-case-lead">{item.problem}</p>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="site-section">
          <div className="site-wrap">
            <p className="site-kicker">Product capabilities</p>
            <h2 className="site-h2">What the workspace is built to hold.</h2>
            <p className="site-intro">
              These are the working parts of the product preview. They are not a
              claim that a finished enterprise suite exists today.
            </p>
            <div className="site-cases">
              {CAPABILITIES.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-band">
          <div className="site-wrap site-split">
            <div>
              <p className="site-kicker">The differentiator</p>
              <h2 className="site-h2">AI answers are not enough.</h2>
              <p className="site-intro">
                VeriAudit focuses on the execution behind the answer. A TRACE is
                the path a later question should be able to follow.
              </p>
            </div>
            <ol className="site-trace">
              {TRACE.map((item, index) => (
                <li key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item}</strong>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="cool" className="site-band">
          <div className="site-wrap site-split">
            <div>
              <p className="site-kicker">CooL</p>
              <h2 className="site-h2">Seal the execution. Check it later.</h2>
            </div>
            <div className="site-prose">
              <p>
                CooL helps VeriAudit seal important audit executions with
                cryptographic evidence so their integrity can be checked later.
              </p>
              <p>
                Verification in VeriAudit means the recorded history still
                matches what was sealed. It does not mean the model&apos;s
                judgement was objectively correct.
              </p>
              <button
                type="button"
                className="site-text"
                aria-expanded={coolOpen}
                onClick={() => setCoolOpen((open) => !open)}
              >
                {coolOpen ? "Hide technical details" : "Technical details"}
              </button>
              {coolOpen && (
                <ul className="site-tech">
                  <li>
                    <strong>Cryptographic signatures.</strong> Receipts carry
                    evidence that they were produced by the expected signing
                    identity.
                  </li>
                  <li>
                    <strong>Inclusion proofs.</strong> A sealed event can be
                    shown to belong to the recorded execution.
                  </li>
                  <li>
                    <strong>Measurement pinning.</strong> The execution can be
                    checked against the expected workload identity.
                  </li>
                  <li>
                    <strong>Integrity verification.</strong> If the historical
                    representation is later changed, verification can fail. The
                    demo shows this distinction: rework creates a new execution;
                    rewriting history is detectable.
                  </li>
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-wrap">
            <p className="site-kicker">Product preview</p>
            <h2 className="site-h2">From guided demo to real audit workspace.</h2>
            <p className="site-intro">
              The demo teaches the idea. The product preview is the workspace
              being built around it: create audits, inspect evidence, work with
              AI, review findings, and check a sealed execution.
            </p>
            <div className="site-preview">
              <p className="site-wip">Work in progress</p>
              <p>
                This preview demonstrates the product direction. Sample audit
                data is included so you can explore the workflow.
              </p>
              <ul>
                <li>Create and reopen audits</li>
                <li>Documents, evidence, findings, executions</li>
                <li>AI workspace attached to a recorded execution</li>
                <li>TRACE from a finding back to source material</li>
                <li>CooL sealing for real, non-sample work</li>
              </ul>
              <p>
                The intended path is the interactive demo. This preview
                describes the workspace being built around it. It is an early
                build — not a finished enterprise suite.
              </p>
            </div>
          </div>
        </section>

        <section className="site-band">
          <div className="site-wrap site-close">
            <p className="site-kicker">Use the product</p>
            <h2 className="site-h2">You&apos;ve seen the story. The next step is the demo.</h2>
            <p className="site-intro">
              The intended path is the interactive demo. That is the narrative.
              The workspace remains a work-in-progress preview, not a public
              entry point from this page.
            </p>
            <div className="site-actions">
              <Link href="/demo" className="site-cta site-cta-lg">
                Start the Demo
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="site-section">
          <div className="site-wrap">
            <p className="site-kicker">FAQ</p>
            <h2 className="site-h2">Direct answers.</h2>
            <div className="site-faq">
              {FAQS.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="site-final">
          <div className="site-wrap">
            <h2 className="site-display site-display-final">
              AI can make audit work faster.
              <br />
              VeriAudit is being built to make that work inspectable.
            </h2>
            <div className="site-actions">
              <Link href="/demo" className="site-cta site-cta-lg">
                Start the Demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-foot">
        <div className="site-wrap site-foot-inner">
          <BrandMark variant="compact" href="#top" />
          <p>Work in progress. The demo is the proof. The workspace shows the product direction.</p>
        </div>
      </footer>
    </div>
  );
}
