export interface PageMeta {
  readonly chrome: string;
  readonly title: string;
  readonly lede: string;
}

const PAGES: Record<string, PageMeta> = {
  "/product": {
    chrome: "Overview",
    title: "Overview",
    lede: "AI-powered audit work. Every meaningful action is traceable.",
  },
  "/product/audits": {
    chrome: "Audits",
    title: "Audits",
    lede: "Open an audit workspace or create a new one.",
  },
  "/product/audits/new": {
    chrome: "Create audit",
    title: "Create audit",
    lede: "Create an AI-assisted audit workspace. The AI assistant starts with the new execution.",
  },
  "/product/executions": {
    chrome: "Activity",
    title: "Activity",
    lede: "Recorded runs of audit work — not the same as an audit.",
  },
  "/product/evidence": {
    chrome: "Evidence",
    title: "Evidence",
    lede: "Source material behind audit decisions.",
  },
  "/product/findings": {
    chrome: "Findings",
    title: "Findings",
    lede: "Issues identified during recorded audit executions.",
  },
  "/product/traces": {
    chrome: "Traces",
    title: "Traces",
    lede: "Recorded causal paths behind audit work.",
  },
  "/product/settings": {
    chrome: "Settings",
    title: "Settings",
    lede: "Workspace structure. Accounts and organisations are not implemented.",
  },
  "/product/data": {
    chrome: "Sample data",
    title: "Sample data",
    lede: "Authored evidence files and a downloadable sample workspace.",
  },
};

export function isAuditWorkspace(pathname: string): boolean {
  return pathname.startsWith("/product/audits/") && pathname !== "/product/audits/new";
}

export function isStudioWorkspace(pathname: string): boolean {
  return /^\/product\/audits\/(?!new$)[^/]+(\/ai)?$/.test(pathname);
}

export function pageMeta(pathname: string): PageMeta {
  if (PAGES[pathname]) return PAGES[pathname];
  if (pathname.includes("/findings/") && pathname !== "/product/findings") {
    return { chrome: "Finding", title: "Finding", lede: "A recorded exception and its review." };
  }
  if (/\/evidence\/ART-/.test(pathname)) {
    return { chrome: "Evidence", title: "Evidence", lede: "An authored artifact used during the audit." };
  }
  if (pathname.endsWith("/trace")) {
    return { chrome: "Trace", title: "Trace", lede: "The recorded chain belonging to one execution." };
  }
  if (/\/executions\/EXEC-/.test(pathname)) {
    return { chrome: "Execution", title: "Execution", lede: "One recorded run of work inside this audit." };
  }
  if (pathname.endsWith("/executions")) {
    return { chrome: "Executions", title: "Executions", lede: "Recorded runs inside this audit." };
  }
  if (pathname.endsWith("/ai")) {
    return {
      chrome: "Workspace",
      title: "AI audit assistant",
      lede: "The assistant performs assigned audit work. The live trace is the record of that work.",
    };
  }
  if (pathname.endsWith("/findings")) {
    return { chrome: "Findings", title: "Findings", lede: "Exceptions recorded on this audit." };
  }
  if (pathname.endsWith("/evidence")) {
    return { chrome: "Evidence", title: "Evidence", lede: "Artifacts attached to this audit." };
  }
  if (isAuditWorkspace(pathname)) {
    return {
      chrome: "Workspace",
      title: "Workspace",
      lede: "AI audit work, evidence, findings, and the live execution in one place.",
    };
  }
  return { chrome: "Product", title: "Product workspace", lede: "VeriAudit application." };
}
