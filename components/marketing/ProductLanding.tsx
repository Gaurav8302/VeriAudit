"use client";

import Link from "next/link";
import { useState } from "react";
import { FAQS } from "./copy";
import { PRODUCT_SHORTCUT } from "./product-shortcut";
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
    title: "Data",
    copy: "Documents and structured records enter the audit workspace.",
  },
  {
    title: "AI analysis",
    copy: "AI analyzes the available evidence — not a story invented after the fact.",
  },
  {
    title: "Evidence",
    copy: "Relevant source material is attached to the reasoning.",
  },
  {
    title: "Finding",
    copy: "Potential exceptions are surfaced with a control and a reason.",
  },
  {
    title: "Human review",
    copy: "A person reviews and accepts, modifies, or rejects the result.",
  },
  {
    title: "Execution trail",
    copy: "The important actions and decisions are preserved as one execution.",
  },
  {
    title: "Verification",
    copy: "CooL provides cryptographic evidence for sealed executions.",
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
          <a href="#top" className="site-mark">
            VeriAudit
          </a>
          <nav className="site-links" aria-label="Page">
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="site-nav-end">
            <Link href="/demo" className="site-cta">
              Start demo
            </Link>
            {/* TEMPORARY DEVELOPMENT SHORTCUT — REMOVE BEFORE FINAL HACKATHON SUBMISSION */}
            <Link href={PRODUCT_SHORTCUT.href} className="site-text">
              {PRODUCT_SHORTCUT.label}
              <span className="site-wip-inline">{PRODUCT_SHORTCUT.note}</span>
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
              Start demo
            </Link>
            {/* TEMPORARY DEVELOPMENT SHORTCUT — REMOVE BEFORE FINAL HACKATHON SUBMISSION */}
            <Link href={PRODUCT_SHORTCUT.href} className="site-text" onClick={() => setMenuOpen(false)}>
              {PRODUCT_SHORTCUT.label}
              <span className="site-wip-inline">{PRODUCT_SHORTCUT.note}</span>
            </Link>
          </nav>
        )}
      </header>

      <main id="top">
        <section className="site-hero" aria-labelledby="hero-title">
          <div className="site-hero-copy">
            <p className="site-kicker">VeriAudit</p>
            <h1 id="hero-title" className="site-display">
              AI-assisted audit work,
              <br />
              with a record you can verify.
            </h1>
            <p className="site-lead">
              VeriAudit helps teams use AI for audit analysis while preserving the
              evidence, decisions, and execution history behind every important
              result.
            </p>
            <p className="site-sublead">
              AI can analyse. Audit work still needs context, attached evidence,
              a reconstructable trail, and a way to check that the recorded
              history was not silently changed.
            </p>
            <div className="site-actions">
              <Link href="/demo" className="site-cta site-cta-lg">
                Start interactive demo
              </Link>
              {/* TEMPORARY DEVELOPMENT SHORTCUT — REMOVE BEFORE FINAL HACKATHON SUBMISSION */}
              <Link href={PRODUCT_SHORTCUT.href} className="site-text">
                {PRODUCT_SHORTCUT.label}
                <span className="site-wip-inline">{PRODUCT_SHORTCUT.note}</span>
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
            <h2 className="site-h2">From data to a sealed execution.</h2>
            <p className="site-intro">
              This is the pipeline the demo walks through, and the product is
              being built around. It is a record of work — not a scoreboard.
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
          <div className="site-wrap site-split">
            <div>
              <p className="site-kicker">The differentiator</p>
              <h2 className="site-h2">AI answers are not enough.</h2>
              <p className="site-intro">
                VeriAudit focuses on the execution behind the answer. TRACE is
                not a marketing label. It is the path a later question should be
                able to follow.
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
              The demo shows the idea. The product we are building turns that
              idea into a workspace where teams can create audits, inspect
              evidence, work with AI, review findings, and TRACE how important
              decisions were produced.
            </p>
            <div className="site-preview">
              <p className="site-wip">Work in progress</p>
              <ul>
                <li>Create and reopen audits</li>
                <li>Documents, evidence, findings, executions</li>
                <li>AI workspace attached to a recorded execution</li>
                <li>TRACE from a finding back to source material</li>
                <li>CooL sealing for real, non-sample work</li>
              </ul>
              <p>
                These capabilities are not finished. The public product route is
                a shell so the judging path stays honest: demo first, then the
                workspace we are actually building.
              </p>
            </div>
          </div>
        </section>

        <section className="site-band">
          <div className="site-wrap site-close">
            <p className="site-kicker">Use the product</p>
            <h2 className="site-h2">You&apos;ve seen the story. Now explore the product we&apos;re building.</h2>
            <p className="site-intro">
              The intended path is the interactive demo. That is the narrative.
              The product route is labelled work in progress and is not a
              shortcut past the proof.
            </p>
            <div className="site-actions">
              <Link href="/demo" className="site-cta site-cta-lg">
                Start interactive demo
              </Link>
              {/* TEMPORARY DEVELOPMENT SHORTCUT — REMOVE BEFORE FINAL HACKATHON SUBMISSION */}
              <Link href={PRODUCT_SHORTCUT.href} className="site-text">
                {PRODUCT_SHORTCUT.label}
                <span className="site-wip-inline">{PRODUCT_SHORTCUT.note}</span>
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
                Start the demo
              </Link>
              {/* TEMPORARY DEVELOPMENT SHORTCUT — REMOVE BEFORE FINAL HACKATHON SUBMISSION */}
              <Link href={PRODUCT_SHORTCUT.href} className="site-text">
                {PRODUCT_SHORTCUT.label}
                <span className="site-wip-inline">{PRODUCT_SHORTCUT.note}</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-foot">
        <div className="site-wrap site-foot-inner">
          <p className="site-mark">VeriAudit</p>
          <p>Early product. The demo is the proof. The workspace is under construction.</p>
        </div>
      </footer>
    </div>
  );
}
