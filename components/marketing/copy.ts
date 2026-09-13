export const FAQS = [
  {
    q: "What is VeriAudit?",
    a: "VeriAudit is software for AI-assisted audit work that keeps a record you can inspect later. It is not a chatbot that only stores a conversation. It is being built so evidence, findings, human review, and sealed executions stay attached to one another.",
  },
  {
    q: "Who is VeriAudit for?",
    a: "Internal audit, compliance, finance, legal, risk, and security teams that already use — or will use — AI on work they may have to explain. You do not need to be a cryptographer to follow the product. The demo is written in plain language.",
  },
  {
    q: "Why isn't a normal AI chat history enough?",
    a: "A chat log is a transcript of messages. It does not reliably tell you which document was retrieved, which control was tested, what a reviewer changed, or whether that history was later rewritten. Audit work needs a reconstructable execution, not only a conversation.",
  },
  {
    q: "What is an execution trace?",
    a: "A TRACE is the path from a later question back through the finding, the analysis, the evidence, and the source documents. It is the recorded causal path of one execution — not a new explanation generated when someone asks “why?”",
  },
  {
    q: "What does CooL do?",
    a: "CooL helps VeriAudit seal important audit executions with cryptographic evidence so their integrity can be checked later. It does not prove the AI was correct. It helps prove that the recorded execution still matches what was originally sealed.",
  },
  {
    q: "Does VeriAudit replace auditors?",
    a: "No. The product is built around human review. AI can surface exceptions. A person still accepts, modifies, or rejects them. The record is there so that review can be reconstructed.",
  },
  {
    q: "Can an audit be reopened?",
    a: "Yes. Real work is not always one-and-done. A team may ask another question or look at new evidence.",
  },
  {
    q: "What happens when an audit is reopened?",
    a: "The original execution is not rewritten. A new execution is created and linked to the earlier one. Rework is allowed. Changing historical records is a different act, and sealed history is meant to make that detectable.",
  },
  {
    q: "Is the product production-ready?",
    a: "No. VeriAudit is currently an early product build. The interactive demo represents the core concept. The broader workspace is actively being developed and is labelled work in progress.",
  },
] as const;
