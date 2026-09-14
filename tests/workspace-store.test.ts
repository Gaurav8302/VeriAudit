import { describe, expect, it } from "vitest";
import {
  beginEvidenceUpload,
  completeEvidenceUpload,
  createSampleWorkspace,
  failEvidenceUpload,
  discardEvidence,
  evidenceFor,
  readyEvidenceFor,
  activitiesFor,
  beginAiTurn,
  completeAiTurn,
  failAiTurn,
  messagesFor,
  actionsFor,
  SAMPLE_AUDIT_ID,
  SAMPLE_EXECUTION_ID,
  type WorkspaceState,
} from "@/lib/product/localWorkspace";
import { createWorkspaceStore, type WorkspaceStorage } from "@/lib/product/workspaceStore";

function memoryStorage(): WorkspaceStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function ingested(filename: string, text: string) {
  return {
    filename,
    fingerprint: `fp-${filename}`,
    extraction: "text" as const,
    textExcerpt: text,
    byteSize: text.length,
    processingStatus: "ready" as const,
    chunks: [
      {
        chunkId: "DOC-001",
        text,
        locator: "Page 1",
        section: null,
        page: 1,
        row: null,
      },
    ],
  };
}

function sampleStore() {
  const store = createWorkspaceStore(memoryStorage());
  store.write(createSampleWorkspace(store.read()).state);
  return store;
}

const target = { auditId: SAMPLE_AUDIT_ID, executionId: SAMPLE_EXECUTION_ID };

describe("workspace store", () => {
  it("keeps every artifact when uploads are dispatched in the same tick", () => {
    // The regression: two mutations that both read one captured snapshot. The
    // store must apply each reducer to the newest committed state instead.
    const store = sampleStore();
    const files = ["policy.txt", "ledger.csv", "contract-c-1001.txt", "contract-c-1002.txt"];
    const drafts = files.map((filename) =>
      store.update((state) => beginEvidenceUpload(state, { ...target, filename, sample: true })),
    );

    expect(drafts.map((item) => item.evidence.artifactId)).toEqual([
      "ART-LOCAL-001",
      "ART-LOCAL-002",
      "ART-LOCAL-003",
      "ART-LOCAL-004",
    ]);
    expect(evidenceFor(store.read(), SAMPLE_AUDIT_ID)).toHaveLength(4);

    for (const [index, draft] of drafts.entries()) {
      store.update((state) =>
        completeEvidenceUpload(state, draft.evidence.artifactId, ingested(files[index]!, "delivery required")),
      );
    }
    expect(readyEvidenceFor(store.read(), SAMPLE_AUDIT_ID)).toHaveLength(4);
  });

  it("reproduces the lost update when a reducer is applied to a stale snapshot", () => {
    // Guards the reason the store exists. Applying both reducers to the same
    // snapshot keeps one artifact and reuses one id.
    const store = sampleStore();
    const stale: WorkspaceState = store.read();
    const first = beginEvidenceUpload(stale, { ...target, filename: "policy.txt" });
    const second = beginEvidenceUpload(stale, { ...target, filename: "ledger.csv" });

    expect(first.evidence.artifactId).toBe(second.evidence.artifactId);
    expect(evidenceFor(second.state, SAMPLE_AUDIT_ID)).toHaveLength(1);
  });

  it("subscribers are notified once per commit", () => {
    const store = createWorkspaceStore(memoryStorage());
    let calls = 0;
    const stop = store.subscribe(() => {
      calls += 1;
    });
    store.write(createSampleWorkspace(store.read()).state);
    store.update((state) => beginEvidenceUpload(state, { ...target, filename: "policy.txt" }));
    stop();
    store.update((state) => beginEvidenceUpload(state, { ...target, filename: "ledger.csv" }));
    expect(calls).toBe(2);
  });
});

describe("failed persistence", () => {
  it("leaves state untouched and throws when the write cannot be persisted", () => {
    const storage = memoryStorage();
    const store = createWorkspaceStore(storage);
    store.write(createSampleWorkspace(store.read()).state);
    const before = store.snapshot();

    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() =>
      store.update((state) => beginEvidenceUpload(state, { ...target, filename: "policy.txt" })),
    ).toThrow(/Quota/);
    // Nothing was committed, so no caller can render a state that was never saved.
    expect(store.snapshot()).toBe(before);
    expect(evidenceFor(store.snapshot(), SAMPLE_AUDIT_ID)).toHaveLength(0);
  });
});

describe("evidence lifecycle", () => {
  it("does not record an execution event until the server confirms ingestion", () => {
    const store = sampleStore();
    const draft = store.update((state) =>
      beginEvidenceUpload(state, { ...target, filename: "policy.txt", byteSize: 42 }),
    );

    expect(draft.evidence.processingStatus).toBe("uploading");
    expect(draft.evidence.recorded).toBe(false);
    expect(draft.evidence.fingerprint).toBeNull();
    expect(readyEvidenceFor(store.read(), SAMPLE_AUDIT_ID)).toHaveLength(0);
    expect(
      activitiesFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID).filter((item) =>
        item.type.startsWith("evidence."),
      ),
    ).toHaveLength(0);

    const done = store.update((state) =>
      completeEvidenceUpload(state, draft.evidence.artifactId, ingested("policy.txt", "delivery required")),
    );
    expect(done.evidence.processingStatus).toBe("ready");
    expect(done.evidence.recorded).toBe(true);
    expect(done.evidence.fingerprint).toBe("fp-policy.txt");
    const events = activitiesFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID).filter((item) =>
      item.type.startsWith("evidence."),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.subjectId).toBe(draft.evidence.artifactId);
  });

  it("marks failure without recording an event and allows the artifact to be discarded", () => {
    const store = sampleStore();
    const draft = store.update((state) =>
      beginEvidenceUpload(state, { ...target, filename: "broken.pdf" }),
    );
    const failed = store.update((state) =>
      failEvidenceUpload(state, draft.evidence.artifactId, "The file could not be read."),
    );

    expect(failed.evidence.processingStatus).toBe("failed");
    expect(failed.evidence.processingError).toBe("The file could not be read.");
    expect(failed.evidence.recorded).toBe(false);
    expect(readyEvidenceFor(store.read(), SAMPLE_AUDIT_ID)).toHaveLength(0);
    expect(
      activitiesFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID).filter((item) =>
        item.type.startsWith("evidence."),
      ),
    ).toHaveLength(0);

    store.mutate((state) => discardEvidence(state, draft.evidence.artifactId));
    expect(evidenceFor(store.read(), SAMPLE_AUDIT_ID)).toHaveLength(0);
  });

  it("a server response of failed never becomes ready", () => {
    const store = sampleStore();
    const draft = store.update((state) => beginEvidenceUpload(state, { ...target, filename: "sheet.xlsx" }));
    const result = store.update((state) =>
      completeEvidenceUpload(state, draft.evidence.artifactId, {
        ...ingested("sheet.xlsx", ""),
        processingStatus: "failed",
        note: "No readable text.",
      }),
    );
    expect(result.evidence.processingStatus).toBe("failed");
    expect(result.evidence.recorded).toBe(false);
  });
});

describe("ai turn", () => {
  it("records the question before the reply exists", () => {
    const store = sampleStore();
    store.update((state) => beginAiTurn(state, { ...target, prompt: "Which contracts are present?" }));

    const afterQuestion = messagesFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID);
    expect(afterQuestion).toHaveLength(1);
    expect(afterQuestion[0]?.role).toBe("user");
    expect(afterQuestion[0]?.content).toBe("Which contracts are present?");

    store.update((state) =>
      completeAiTurn(state, {
        ...target,
        reply: "Contracts C-1001 and C-1002 are attached.",
        actions: [],
        provider: "groq",
        model: "test",
        requestId: "r1",
        mode: "live",
        status: "ok",
        grounding: "evidence-backed",
      }),
    );
    const full = messagesFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID);
    expect(full.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(full[1]?.content).toMatch(/C-1001/);
  });

  it("a provider failure becomes a visible turn and a failed action", () => {
    const store = sampleStore();
    store.update((state) => beginAiTurn(state, { ...target, prompt: "Find exceptions." }));
    store.mutate((state) => failAiTurn(state, { ...target, message: "AI analysis is unavailable." }).state);

    const messages = messagesFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID);
    expect(messages.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(messages[1]?.content).toMatch(/unavailable/i);
    const actions = actionsFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.status).toBe("failed");
    expect(
      activitiesFor(store.read(), SAMPLE_AUDIT_ID, SAMPLE_EXECUTION_ID).some(
        (item) => item.type === "ai.action.failed",
      ),
    ).toBe(true);
  });
});
