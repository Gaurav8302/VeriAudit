export const TERMS = {
  audit: "The long-lived workspace for a case. It can hold more than one execution.",
  execution: "A specific period of work performed on this audit.",
  assistant: "The AI that analyzes attached evidence, performs assigned audit tasks, and records those actions on the execution.",
  finding: "An issue or exception discovered during the audit.",
  evidence: "Information or documents used to support an audit decision.",
  trace: "The sequence of recorded actions that explains how work was performed.",
  sample: "Authored or local sample data. Not cryptographically verified in this view.",
  sealed: "The completed execution has been protected and its recorded history cannot be silently changed.",
  unsealed: "Local product activity that has not been cryptographically sealed.",
  action: "A structured piece of work recorded on an execution, separate from chat text.",
} as const;
