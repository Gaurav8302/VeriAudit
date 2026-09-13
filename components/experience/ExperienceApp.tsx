"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCatalogue,
  reconstruct,
  resetSimulation,
  runAudit,
  searchHistory,
  startSimulation,
} from "@/lib/demo/client";
import { evidenceFromRun, loadEvidence, persistEvidence } from "@/lib/demo/evidence-store";
import type {
  CatalogueResponse,
  ReconstructionPayload,
  RunPayload,
  SearchResponse,
  SessionEvidence,
  SimulationFeed,
} from "@/lib/demo/payloads";
import { isDemoCompleted, markDemoCompleted } from "@/lib/demo/completion";
import { createSession, transition } from "@/lib/demo/state-machine";
import type { DemoEvent, DemoSession } from "@/lib/demo/types";
import { topicFromTrailType, type ExplainerTopic } from "@/lib/demo/explainer";
import { scenarioInquiry } from "@/lib/demo/scenario-copy";
import { BrandMark } from "@/components/brand/BrandMark";
import { Explainer } from "./Explainer";
import { MemoryRail } from "./MemoryRail";
import { History } from "./screens/History";
import { Investigation } from "./screens/Investigation";
import { Reconstruction } from "./screens/Reconstruction";
import { Result } from "./screens/Result";
import { Running } from "./screens/Running";
import { ScenarioSelect } from "./screens/ScenarioSelect";
import { SearchResults } from "./screens/SearchResults";
import { SimulateReady } from "./screens/SimulateReady";
import { Simulating } from "./screens/Simulating";
import { Trail } from "./screens/Trail";
import { integrityStatus, Verification } from "./screens/Verification";
import { Welcome } from "./screens/Welcome";

export function ExperienceApp() {
  const router = useRouter();
  const [session, setSession] = useState<DemoSession>(createSession);
  const [opNonce, setOpNonce] = useState(0);
  const sessionRef = useRef(session);
  const fired = useRef<number | null>(null);
  sessionRef.current = session;

  const [catalogue, setCatalogue] = useState<CatalogueResponse | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [run, setRun] = useState<RunPayload | null>(null);
  const [simulation, setSimulation] = useState<SimulationFeed | null>(null);
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [reconstruction, setReconstruction] = useState<ReconstructionPayload | null>(null);
  const [evidence, setEvidence] = useState<SessionEvidence | null>(null);
  const [explainerTopic, setExplainerTopic] = useState<ExplainerTopic>("welcome");
  const [verifyPlace, setVerifyPlace] = useState("Verification");
  const [demoCompleted, setDemoCompleted] = useState(false);

  const apply = useCallback((event: DemoEvent) => {
    const next = transition(sessionRef.current, event);
    sessionRef.current = next;
    setSession(next);
    if (next.phase === "loading") setOpNonce((value) => value + 1);
  }, []);

  const clearPayloads = useCallback(() => {
    setCatalogue(null);
    setCatalogueError(null);
    setRun(null);
    setSimulation(null);
    setSearch(null);
    setReconstruction(null);
    setEvidence(null);
    persistEvidence(null);
  }, []);

  useEffect(() => {
    setEvidence(loadEvidence());
    setDemoCompleted(isDemoCompleted());
  }, []);

  const openProduct = useCallback(() => {
    markDemoCompleted();
    setDemoCompleted(true);
    router.push("/product");
  }, [router]);

  useEffect(() => {
    if (session.state !== "scenario_select" || catalogue) return;
    let cancelled = false;
    getCatalogue()
      .then((data) => {
        if (cancelled) return;
        setCatalogue(data);
        setCatalogueError(null);
      })
      .catch((error: Error) => {
        if (!cancelled) setCatalogueError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [session.state, catalogue]);

  useEffect(() => {
    if (session.phase !== "loading") return;
    if (fired.current === opNonce) return;
    fired.current = opNonce;

    const current = sessionRef.current;
    const pending = current.pending;

    void (async () => {
      try {
        if (pending === "run") {
          if (!current.selectedScenario) throw new Error("No scenario selected");
          const payload = await runAudit(current.selectedScenario);
          setRun(payload);
          const stored = evidenceFromRun(payload);
          setEvidence(stored);
          persistEvidence(stored);
          return;
        }
        if (pending === "simulate") {
          const feed = await startSimulation();
          setSimulation(feed);
          return;
        }
        if (pending === "search") {
          const found = await searchHistory(current.searchQuery);
          setSearch(found);
          apply({ type: "search_succeeded" });
          return;
        }
        if (pending === "reconstruct") {
          if (!current.selectedResultAuditId) throw new Error("No audit selected");
          const record = await reconstruct(current.selectedResultAuditId);
          setReconstruction(record);
          apply({ type: "reconstruction_succeeded" });
          return;
        }
        if (pending === "verify") {
          const auditId = current.selectedResultAuditId ?? current.auditId;
          if (!auditId) throw new Error("No audit to verify");
          const held = evidence;
          const record =
            held && Object.keys(held.receipts).length > 0
              ? await reconstruct(auditId, {
                  receipts: held.receipts,
                  logState: held.logState,
                  treeHead: held.treeHead ?? undefined,
                })
              : await reconstruct(auditId);
          setReconstruction(record);
          const status = integrityStatus(record.integrity);
          apply({ type: "verification_completed", status });
          if (status === "verified") {
            markDemoCompleted();
            setDemoCompleted(true);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        if (pending === "run") apply({ type: "audit_failed", error: message });
        if (pending === "simulate") apply({ type: "simulation_failed", error: message });
        if (pending === "search") apply({ type: "search_failed", error: message });
        if (pending === "reconstruct") apply({ type: "reconstruction_failed", error: message });
        if (pending === "verify") apply({ type: "verification_failed", error: message });
      }
    })();
  }, [apply, evidence, opNonce, session.phase]);

  const resetDemo = useCallback(async () => {
    apply({ type: "reset" });
    clearPayloads();
    try {
      await resetSimulation();
    } catch {
      // UI is already reset; corpus reset is best-effort.
    }
  }, [apply, clearPayloads]);

  const returnHome = useCallback(() => {
    void resetDemo();
    router.push("/");
  }, [resetDemo, router]);

  const onRunRevealed = useCallback(() => {
    const payload = run;
    if (!payload) return;
    if (sessionRef.current.state !== "running") return;
    apply({
      type: "audit_succeeded",
      auditId: payload.audit.auditId,
      executionId: payload.audit.executionId,
    });
  }, [apply, run]);

  useEffect(() => {
    if (session.state === "trail" || session.state === "verification") return;
    setExplainerTopic(session.state);
    setVerifyPlace("Verification");
  }, [session.state]);

  const onTrailType = useCallback((type: string | null) => {
    setExplainerTopic(topicFromTrailType(type));
  }, []);

  const onSimRevealed = useCallback(() => {
    const feed = simulation;
    if (!feed) return;
    if (sessionRef.current.state !== "simulating") return;
    apply({ type: "simulation_succeeded", simulationId: feed.simulationId });
  }, [apply, simulation]);

  const selectedTitle =
    catalogue?.scenarios.find((item) => item.scenarioId === session.selectedScenario)?.title ??
    "Audit execution";
  const selectedPeriod =
    catalogue?.scenarios.find((item) => item.scenarioId === session.selectedScenario)?.period ?? "";

  const memoryTitles = simulation?.activities.map((activity) => activity.title) ?? [];
  const showMemory = session.state === "history" && memoryTitles.length > 8;

  return (
    <div className="app">
      <header className="chrome">
        <div>
          <BrandMark variant="compact" />
          <p className="chrome-place">{placeName(session, run, reconstruction, verifyPlace)}</p>
        </div>
        <button type="button" className="text-btn quiet" onClick={() => void resetDemo()}>
          Restart
        </button>
      </header>

      <div className={showMemory ? "workspace has-memory" : "workspace"}>
        <main className="stage">{renderStage()}</main>
        {showMemory && <MemoryRail titles={memoryTitles} crowded />}
      </div>
      <Explainer
        topic={explainerTopic}
        scenarioId={session.selectedScenario}
        raised={session.state === "history"}
      />
    </div>
  );

  function renderStage() {
    switch (session.state) {
      case "welcome":
        return (
          <Welcome
            onBegin={() => apply({ type: "begin" })}
            onExplore={openProduct}
            completed={demoCompleted}
          />
        );
      case "scenario_select":
        return (
          <ScenarioSelect
            catalogue={catalogue}
            selected={session.selectedScenario}
            error={catalogueError}
            onSelect={(scenarioId) => apply({ type: "select_scenario", scenarioId })}
            onRun={() => apply({ type: "run_audit" })}
            onRetry={() => {
              setCatalogue(null);
              setCatalogueError(null);
            }}
          />
        );
      case "running":
        return (
          <Running
            title={run?.audit.title ?? selectedTitle}
            period={run?.audit.period ?? selectedPeriod}
            payload={run}
            error={session.lastError}
            onRetry={() => apply({ type: "retry" })}
            onRevealed={onRunRevealed}
          />
        );
      case "result":
        return run ? (
          <Result run={run} onContinue={() => apply({ type: "continue_to_simulate" })} />
        ) : (
          <p className="note">The run payload is missing. Restart the demonstration.</p>
        );
      case "simulate_ready":
        return (
          <SimulateReady
            auditTitle={run?.audit.title ?? selectedTitle}
            onStart={() => apply({ type: "start_simulation" })}
          />
        );
      case "simulating":
        return (
          <Simulating
            simulation={simulation}
            error={session.lastError}
            onRetry={() => apply({ type: "retry" })}
            onRevealed={onSimRevealed}
          />
        );
      case "history":
        return (
          <History
            activities={simulation?.activities ?? []}
            originAuditId={session.auditId}
            scenarioId={session.selectedScenario}
            onAsk={() => apply({ type: "ask_why" })}
          />
        );
      case "investigation":
        return (
          <Investigation
            scenarioId={session.selectedScenario}
            onSearch={(query) => apply({ type: "submit_search", query })}
          />
        );
      case "search_results":
        return (
          <SearchResults
            query={session.searchQuery}
            results={search}
            loading={session.phase === "loading"}
            error={session.lastError}
            chips={scenarioInquiry(session.selectedScenario).chips}
            onSearch={(query) => apply({ type: "submit_search", query })}
            onOpen={(auditId, executionId) => apply({ type: "open_result", auditId, executionId })}
            onRetry={() => apply({ type: "retry" })}
          />
        );
      case "reconstruction":
        return (
          <Reconstruction
            reconstruction={reconstruction}
            loading={session.phase === "loading"}
            error={session.lastError}
            onRetry={() => apply({ type: "retry" })}
            onOpenTrail={() => apply({ type: "open_trail" })}
          />
        );
      case "trail":
        return reconstruction ? (
          <Trail
            reconstruction={reconstruction}
            onVerify={() => apply({ type: "open_verification" })}
            onSelectType={onTrailType}
          />
        ) : (
          <p className="note">No reconstructed execution is loaded.</p>
        );
      case "verification":
        return (
          <Verification
            reconstruction={reconstruction}
            evidence={evidence}
            loading={session.phase === "loading"}
            error={session.lastError}
            onRetry={() => apply({ type: "retry" })}
            onHome={returnHome}
            onRestart={() => void resetDemo()}
            onExplore={openProduct}
            onTopic={setExplainerTopic}
            onPlace={setVerifyPlace}
          />
        );
      default:
        return null;
    }
  }
}

function placeName(
  session: DemoSession,
  run: RunPayload | null,
  reconstruction: ReconstructionPayload | null,
  verifyPlace: string,
): string {
  switch (session.state) {
    case "welcome":
      return "Demonstration";
    case "scenario_select":
      return "Engagements";
    case "running":
      return "Execution";
    case "result":
      return run?.audit.title ?? "Result";
    case "simulate_ready":
    case "simulating":
      return "Three months later";
    case "history":
      return "15 December 2026";
    case "investigation":
    case "search_results":
      return "Inquiry";
    case "reconstruction":
      return reconstruction?.auditId ?? "Original execution";
    case "trail":
      return "Execution trail";
    case "verification":
      return verifyPlace;
    default:
      return "VeriAudit";
  }
}
