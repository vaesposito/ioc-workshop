#!/usr/bin/env node
/**
 * verify-graph.mjs
 *
 * Checks the component-graph contract against the REAL code and data of a
 * repository that has frontend/ and preload_artifacts/ (the static demo, or the
 * V1 platform on branch chore/demo-v1). Nothing is mocked: the app's own
 * TypeScript is bundled with the esbuild that ships in frontend/node_modules,
 * every canned trace is replayed the way the UI does it, and the invariants
 * described in CONTEXT.md are asserted.
 *
 * Usage (run it from the repository root; the pack can live anywhere):
 *   node <pack>/verify-graph.mjs                  human readable report
 *   node <pack>/verify-graph.mjs --json           machine readable report
 *   node <pack>/verify-graph.mjs --tool-report    also list the tools the manifest does not declare, with evidence
 *   node <pack>/verify-graph.mjs --root <repo>    when the current directory is not inside the repository
 *
 * The repository root is, in order: --root, $GRAPH_REPO_ROOT, <pack>/../.. (pack inside .vscode/),
 * then the nearest parent of the current directory that contains frontend/src/utils/componentGraph.ts.
 *
 * Exit code: 0 = no FAIL (WARN is allowed), 1 = at least one FAIL, 2 = setup problem.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AS_JSON = process.argv.includes("--json");
const TOOL_REPORT = process.argv.includes("--tool-report");

function die(message) {
  console.error(`SETUP ERROR: ${message}`);
  process.exit(2);
}

function findRoot() {
  const isRoot = (dir) => fs.existsSync(path.join(dir, "frontend", "src", "utils", "componentGraph.ts"));
  const flag = process.argv.indexOf("--root");
  const candidates = [];
  if (flag > -1 && process.argv[flag + 1]) {
    candidates.push(path.resolve(process.argv[flag + 1]));
  }
  if (process.env.GRAPH_REPO_ROOT) {
    candidates.push(path.resolve(process.env.GRAPH_REPO_ROOT));
  }
  candidates.push(path.resolve(HERE, "..", ".."));
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    candidates.push(dir);
    if (dir === path.dirname(dir)) {
      break;
    }
  }
  return candidates.find(isRoot);
}

const ROOT =
  findRoot() ??
  die("repository root not found (it must contain frontend/src/utils/componentGraph.ts). Run from inside the repository or pass --root <repo>.");
const FRONTEND = path.join(ROOT, "frontend");
const SRC = path.join(FRONTEND, "src");
const PRELOAD = path.join(ROOT, "preload_artifacts");

const posix = (p) => p.split(path.sep).join("/");
const rel = (p) => posix(path.relative(ROOT, p));
const readText = (p) => fs.readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(readText(p));

// ---------------------------------------------------------------- setup ----

const REQUIRED = [
  "utils/traceVisualizer.ts",
  "utils/componentGraph.ts",
  "utils/toolManifest.ts",
  "utils/cannedTraceIds.ts",
  "content/agents.json",
  "content/applications.json",
  "cms/repository.ts",
  "components/ComponentBubbleGraph.tsx",
  "styles/index.css",
].map((file) => path.join(SRC, file));
REQUIRED.push(path.join(PRELOAD, "investigations_export.json"));
for (const file of REQUIRED) {
  if (!fs.existsSync(file)) {
    die(`missing ${rel(file)} (is this the repository root? expected ${ROOT})`);
  }
}

let esbuild;
try {
  esbuild = createRequire(path.join(FRONTEND, "package.json"))("esbuild");
} catch {
  die("esbuild not found. Run `npm install` inside frontend/ first.");
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "graph-verify-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

const entry = ["traceVisualizer", "componentGraph", "toolManifest", "cannedTraceIds"]
  .map((name) => {
    const alias = { traceVisualizer: "tv", componentGraph: "cg", toolManifest: "tm", cannedTraceIds: "ct" }[name];
    return `export * as ${alias} from "${posix(path.join(SRC, "utils", name))}";`;
  })
  .join("\n");
const outfile = path.join(tmp, "bundle.mjs");
try {
  await esbuild.build({
    stdin: { contents: entry, resolveDir: SRC, sourcefile: "verify-entry.ts", loader: "ts" },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
} catch (error) {
  die(`could not bundle the graph code with esbuild (does \`npm run build\` pass?):\n${error.message}`);
}
const { tv, cg, tm, ct } = await import(pathToFileURL(outfile).href);

// ----------------------------------------------------------------- data ----

const manifest = readJson(path.join(SRC, "content", "agents.json"));
const applications = readJson(path.join(SRC, "content", "applications.json"));
const exportRecords = readJson(path.join(PRELOAD, "investigations_export.json"));
const repositorySource = readText(path.join(SRC, "cms", "repository.ts"));
const bubbleSource = readText(path.join(SRC, "components", "ComponentBubbleGraph.tsx"));
const graphSource = readText(path.join(SRC, "utils", "componentGraph.ts"));
const cssSource = readText(path.join(SRC, "styles", "index.css"));

// The loader's own glob, so the script follows the app if the layout changes.
const globMatch = repositorySource.match(/["'][^"']*\/preload_artifacts\/([^"']*\/traces\/[^"']*\.json)["']/);
const tracePattern = globMatch ? globMatch[1] : "*/evoguard/traces/*.json";

// Same name -> app id map the loader uses.
const mapBlock = repositorySource.match(/APP_NAME_TO_FRONTEND_APP[^=]*=\s*\{([\s\S]*?)\};/);
if (!mapBlock) {
  die("APP_NAME_TO_FRONTEND_APP not found in src/cms/repository.ts (the loader changed; update this script).");
}
const nameToApp = new Map(
  [...mapBlock[1].matchAll(/^\s*"?([^":\n]+?)"?\s*:\s*"([^"]+)"/gm)].map((m) => [m[1].trim(), m[2]]),
);
const backendMapBlock = repositorySource.match(/BACKEND_TO_FRONTEND_APP[^=]*=\s*\{([\s\S]*?)\};/);
if (!backendMapBlock) {
  die("BACKEND_TO_FRONTEND_APP not found in src/cms/repository.ts (the loader changed; update this script).");
}
const backendToApp = new Map(
  [...backendMapBlock[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)]
    .map((match) => [match[1], match[2]]),
);

function expandGlob(base, segments) {
  if (segments.length === 0) {
    return [base];
  }
  const [head, ...rest] = segments;
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    return [];
  }
  if (!head.includes("*")) {
    return expandGlob(path.join(base, head), rest);
  }
  const matcher = new RegExp(`^${head.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
  return fs
    .readdirSync(base)
    .filter((name) => matcher.test(name))
    .sort()
    .flatMap((name) => expandGlob(path.join(base, name), rest));
}

const filesByName = new Map();
const duplicateNames = [];
for (const file of expandGlob(PRELOAD, tracePattern.split("/"))) {
  const name = path.basename(file);
  if (filesByName.has(name)) {
    duplicateNames.push(`${name} (${rel(filesByName.get(name))} and ${rel(file)})`);
  }
  filesByName.set(name, file); // last one wins, like the loader
}

// Replay every investigation record the way cms/repository.ts surfaces it.
const rows = [];
const unresolved = [];
const notShown = { unparsable: [], unmappedApp: [], notAllowlisted: [] };
const seenTraceIds = new Set();
for (const record of exportRecords) {
  const segments = String(record.name ?? "").split("·").map((part) => part.trim());
  const parsedName = segments.length >= 2 && segments.at(-1) && segments.at(-2);
  if (!parsedName && !record.trace_original_filename) {
    notShown.unparsable.push(String(record.name));
    continue;
  }
  const backendAppId = backendToApp.get(record.app_id);
  const namedAppId = parsedName ? nameToApp.get(segments.at(-2)) : undefined;
  const appId = backendAppId ?? namedAppId;
  const appName = applications.find((application) => application.id === appId)?.name;
  const traceName = record.trace_original_filename ?? `${segments.at(-1)}.json`;
  if (!appName || (backendAppId && namedAppId && backendAppId !== namedAppId)) {
    notShown.unmappedApp.push(`${appName} / ${traceName}`);
    continue;
  }
  if (!ct.isCannedTrace(traceName)) {
    notShown.notAllowlisted.push(`${appName} / ${traceName}`);
    continue;
  }
  if (seenTraceIds.has(record.trace_file_id)) {
    continue;
  }
  seenTraceIds.add(record.trace_file_id);
  const file = filesByName.get(traceName);
  if (!file) {
    unresolved.push(`${appName} / ${traceName}`);
    continue;
  }
  const conversation = readJson(file).conversation ?? [];
  const events = tv.conversationToEvents(conversation, []);
  const graph = cg.buildTraceComponentGraph(events, [], "vertical", {
    app: { id: appId, name: appName },
  });
  rows.push({
    stem: traceName.replace(/\.json$/, ""),
    appId,
    appName,
    folderAppId: `app-${posix(path.relative(PRELOAD, file)).split("/")[0].replace(/_/g, "-")}`,
    conversation,
    graph,
  });
}

const groupsOf = (entry) => (Array.isArray(entry?.groups) ? entry.groups : []);
const toolsOf = (group) => (Array.isArray(group?.tools) ? group.tools : []);

// What the graph SHOULD contain, derived straight from the raw conversation and
// the manifest JSON (not from the builder under test).
function expectedFor(row) {
  const index = new Map();
  for (const group of groupsOf(manifest[row.appId])) {
    for (const tool of toolsOf(group)) {
      index.set(tool, group.id);
    }
  }
  const groups = new Map(); // group id -> { calls, tools }
  for (const turn of row.conversation) {
    if (String(turn.role ?? "").toLowerCase() !== "assistant") {
      continue;
    }
    for (const name of tv.parseToolNames(turn.tool_calls)) {
      if (!name || tm.isIgnoredTool(name)) {
        continue;
      }
      const id = index.get(name) ?? tm.UNDECLARED_GROUP_ID;
      const entry = groups.get(id) ?? { calls: 0, tools: new Set() };
      entry.calls += 1;
      entry.tools.add(name);
      groups.set(id, entry);
    }
  }
  return groups;
}
for (const row of rows) {
  row.expected = expectedFor(row);
}

const groupIdsInManifest = new Set(
  Object.values(manifest).flatMap((app) => groupsOf(app).map((group) => group.id)),
);

// --------------------------------------------------------------- checks ----

const checks = [];
function check(id, title, body) {
  const out = { failures: [], warnings: [], info: "" };
  try {
    body(out);
  } catch (error) {
    out.failures.push(`check crashed: ${error.stack ?? error}`);
  }
  checks.push({
    id,
    title,
    status: out.failures.length ? "FAIL" : out.warnings.length ? "WARN" : "PASS",
    info: out.info,
    failures: out.failures,
    warnings: out.warnings,
  });
}

check("G0", "toolchain shims in frontend/node_modules/.bin are links, not copied files (otherwise `npm run build` and `npm start` crash)", (out) => {
  if (process.platform === "win32") {
    out.info = "skipped on Windows";
    return;
  }
  const binDir = path.join(FRONTEND, "node_modules", ".bin");
  const copied = ["tsc", "vite"].filter((name) => {
    const file = path.join(binDir, name);
    return fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink();
  });
  if (copied.length > 0) {
    out.warnings.push(
      `node_modules/.bin/${copied.join(" and ")} are plain files: node_modules was copied with its links followed, so \`npm run build\` fails with "Cannot find module '../lib/tsc.js'". Fix (offline, only recreates the links): cd frontend && npm rebuild`,
    );
  }
});

check("G1", "trace graphs only contain user>agent and agent>tool edges (no tool>tool, no user>tool)", (out) => {
  let userAgent = 0;
  let agentTool = 0;
  for (const row of rows) {
    for (const edge of row.graph.edges) {
      const target = row.graph.nodes.find((node) => node.id === edge.to);
      if (edge.from === "user" && edge.to === "agent") {
        userAgent += 1;
      } else if (edge.from === "agent" && target?.kind === "tool") {
        agentTool += 1;
      } else {
        out.failures.push(`${row.appId} ${row.stem}: unexpected edge ${edge.from}>${edge.to}`);
      }
    }
  }
  out.info = `${userAgent + agentTool} edges over ${rows.length} traces (user>agent ${userAgent}, agent>tool ${agentTool})`;
});

check("G2", "every tool used by the canned traces is declared in the app manifest (no undeclared bubble)", (out) => {
  const byApp = new Map();
  for (const row of rows) {
    for (const node of row.graph.nodes) {
      if (node.undeclared) {
        const set = byApp.get(row.appId) ?? new Set();
        node.tools.forEach((tool) => set.add(tool));
        byApp.set(row.appId, set);
      }
    }
  }
  for (const [appId, tools] of byApp) {
    out.failures.push(`${appId}: not in the manifest -> ${[...tools].sort().join(", ")}`);
  }
  out.info = `${rows.length} traces, ${byApp.size} apps with undeclared tools${byApp.size > 0 ? " (run with --tool-report for evidence)" : ""}`;
});

check("G3", "tool nodes come from the manifest (ids, labels and tools match an independent grouping)", (out) => {
  for (const row of rows) {
    const manifestGroups = new Map((manifest[row.appId]?.groups ?? []).map((group) => [group.id, group]));
    const toolNodes = row.graph.nodes.filter((node) => node.kind === "tool");
    const gotIds = toolNodes.map((node) => node.id).sort();
    const wantIds = [...row.expected.keys()].sort();
    if (gotIds.join("|") !== wantIds.join("|")) {
      out.failures.push(`${row.appId} ${row.stem}: tool nodes [${gotIds}] but the manifest implies [${wantIds}]`);
      continue;
    }
    for (const node of toolNodes) {
      const want = row.expected.get(node.id);
      if ([...node.tools].sort().join("|") !== [...want.tools].sort().join("|")) {
        out.failures.push(`${row.appId} ${row.stem}: node ${node.id} lists [${node.tools}] but the trace calls [${[...want.tools]}]`);
      }
      const group = manifestGroups.get(node.id);
      if (group && node.label !== group.name) {
        out.failures.push(`${row.appId} ${row.stem}: node ${node.id} labelled "${node.label}", manifest says "${group.name}"`);
      }
    }
  }
  out.info = `${rows.length} traces compared`;
});

check("G4", "edge and node call counts equal the tool calls found in the conversation", (out) => {
  for (const row of rows) {
    for (const [id, want] of row.expected) {
      const edge = row.graph.edges.find((item) => item.from === "agent" && item.to === id);
      const node = row.graph.nodes.find((item) => item.id === id);
      if (edge?.count !== want.calls) {
        out.failures.push(`${row.appId} ${row.stem}: agent>${id} count ${edge?.count} but the trace makes ${want.calls} calls`);
      }
      if (node?.calls !== want.calls) {
        out.failures.push(`${row.appId} ${row.stem}: node ${id} calls ${node?.calls} but the trace makes ${want.calls}`);
      }
    }
  }
  out.info = `${rows.length} traces compared`;
});

check("G5", "control tools (end_task) are ignored and never become a node", (out) => {
  if (!tm.isIgnoredTool("end_task")) {
    out.failures.push("isIgnoredTool('end_task') is false");
  }
  for (const row of rows) {
    for (const node of row.graph.nodes) {
      if (node.tools.some((tool) => tm.isIgnoredTool(tool))) {
        out.failures.push(`${row.appId} ${row.stem}: node ${node.id} lists an ignored tool`);
      }
    }
  }
  const declared = Object.entries(manifest).filter(([, app]) =>
    groupsOf(app).some((group) => toolsOf(group).some((tool) => tm.isIgnoredTool(tool))),
  );
  for (const [appId] of declared) {
    out.warnings.push(`${appId}: the manifest lists an ignored tool (it can never be drawn)`);
  }
});

check("G6", "each trace graph has exactly one 'user' and one 'Agentic App' node, unique ids, unique edges", (out) => {
  for (const row of rows) {
    const ids = row.graph.nodes.map((node) => node.id);
    if (new Set(ids).size !== ids.length) {
      out.failures.push(`${row.appId} ${row.stem}: duplicate node ids [${ids}]`);
    }
    const agents = row.graph.nodes.filter((node) => node.kind === "agent");
    const users = row.graph.nodes.filter((node) => node.kind === "user");
    if (agents.length !== 1 || agents[0].id !== "agent" || agents[0].label !== "Agentic App") {
      out.failures.push(`${row.appId} ${row.stem}: expected one agent node "Agentic App", got [${agents.map((n) => `${n.id}:${n.label}`)}]`);
    }
    if (users.length !== 1 || users[0].id !== "user") {
      out.failures.push(`${row.appId} ${row.stem}: expected one user node, got ${users.length}`);
    }
    const keys = row.graph.edges.map((edge) => `${edge.from}>${edge.to}`);
    if (new Set(keys).size !== keys.length) {
      out.failures.push(`${row.appId} ${row.stem}: duplicate edges [${keys}]`);
    }
  }
});

check("G7", "application graph = user + Agentic App + every manifest group, edges user>agent and agent>group", (out) => {
  for (const app of applications) {
    const graph = cg.buildAppComponentGraph({ id: app.id, name: app.name });
    const groups = manifest[app.id]?.groups ?? [];
    const wantNodes = ["user", "agent", ...groups.map((group) => group.id)].sort();
    const gotNodes = graph.nodes.map((node) => node.id).sort();
    if (gotNodes.join("|") !== wantNodes.join("|")) {
      out.failures.push(`${app.id}: nodes [${gotNodes}] but expected [${wantNodes}]`);
    }
    const wantEdges = ["user>agent", ...groups.map((group) => `agent>${group.id}`)].sort();
    const gotEdges = graph.edges.map((edge) => `${edge.from}>${edge.to}`).sort();
    if (gotEdges.join("|") !== wantEdges.join("|")) {
      out.failures.push(`${app.id}: edges [${gotEdges}] but expected [${wantEdges}]`);
    }
    for (const group of groups) {
      const node = graph.nodes.find((item) => item.id === group.id);
      if (node && (node.label !== group.name || node.tools.join("|") !== group.tools.join("|"))) {
        out.failures.push(`${app.id}: node ${group.id} does not carry the manifest name/tools`);
      }
    }
    const agent = graph.nodes.find((node) => node.id === "agent");
    if (agent && agent.label !== "Agentic App") {
      out.failures.push(`${app.id}: agent node labelled "${agent.label}"`);
    }
  }
  out.info = `${applications.length} applications`;
});

check("G8", "every application has a manifest entry (key = application id); manifest shape is valid (unique groups, a tool belongs to one group, reserved ids unused)", (out) => {
  const appIds = new Set(applications.map((app) => app.id));
  for (const app of applications) {
    const entry = manifest[app.id];
    if (!entry || !Array.isArray(entry.groups) || entry.groups.length === 0) {
      out.failures.push(`${app.id} (${app.name}): no manifest entry or no groups in src/content/agents.json`);
    }
  }
  const reserved = new Set(["user", "agent", tm.UNDECLARED_GROUP_ID]);
  for (const [key, entry] of Object.entries(manifest)) {
    if (!appIds.has(key)) {
      out.warnings.push(`manifest entry "${key}" has no application in applications.json (dead entry)`);
    }
    const groupIds = new Set();
    const owner = new Map();
    for (const group of groupsOf(entry)) {
      if (!group.id || !group.name || toolsOf(group).length === 0) {
        out.failures.push(`${key}: group ${JSON.stringify(group.id)} needs an id, a name and a non-empty tools list`);
      }
      if (reserved.has(group.id)) {
        out.failures.push(`${key}: group id "${group.id}" is reserved`);
      }
      if (groupIds.has(group.id)) {
        out.failures.push(`${key}: duplicate group id "${group.id}"`);
      }
      groupIds.add(group.id);
      for (const tool of toolsOf(group)) {
        if (owner.has(tool)) {
          out.failures.push(`${key}: tool "${tool}" is listed in both ${owner.get(tool)} and ${group.id} (the last one would win)`);
        }
        owner.set(tool, group.id);
      }
    }
  }
  const ids = Object.values(manifest).flatMap((app) => groupsOf(app).map((group) => group.id));
  out.info = `${applications.length} applications, ${Object.keys(manifest).length} manifest entries, ${groupIdsInManifest.size} distinct group ids (${ids.length} group slots)`;
});

check("G9", "every manifest group id has its own icon in iconForNode (otherwise it renders a wrench)", (out) => {
  const iconFn = bubbleSource.match(/function iconForNode[\s\S]*?\n\}/);
  if (!iconFn) {
    out.failures.push("iconForNode() not found in ComponentBubbleGraph.tsx");
    return;
  }
  const cases = new Set([...iconFn[0].matchAll(/case\s+"([^"]+)":/g)].map((m) => m[1]));
  for (const id of [...groupIdsInManifest].sort()) {
    if (!cases.has(id)) {
      out.failures.push(`group "${id}" has no icon case in iconForNode()`);
    }
  }
  if (!cases.has(tm.UNDECLARED_GROUP_ID)) {
    out.failures.push(`no icon case for "${tm.UNDECLARED_GROUP_ID}" in iconForNode()`);
  }
  out.info = `${groupIdsInManifest.size} group ids, ${cases.size} icon cases`;
});

check("G10", "undeclared tools are visibly flagged (red node, red edge, explanation text)", (out) => {
  const rules = [
    [/node\.malicious\s*\|\|\s*node\.undeclared\s*\?\s*"is-danger"/.test(bubbleSource), "ComponentBubbleGraph.tsx no longer adds is-danger to undeclared nodes"],
    [/edge\.malicious\s*\?\s*" is-danger"/.test(bubbleSource), "ComponentBubbleGraph.tsx no longer adds is-danger to flagged edges"],
    [/Tool called not present in app manifest/.test(bubbleSource), "the 'Tool called not present in app manifest.' explanation is gone"],
    [/\.ioc-bubble-edge\.is-danger/.test(cssSource), "CSS rule .ioc-bubble-edge.is-danger missing"],
    [/\.ioc-bubble-arrow\.is-danger/.test(cssSource), "CSS rule .ioc-bubble-arrow.is-danger missing"],
    [/\.ioc-bubble-orb\.is-danger/.test(cssSource), "CSS rule .ioc-bubble-orb.is-danger missing"],
    [/addEdge\([\s\S]{0,80}?"agent",[\s\S]{0,120}?UNDECLARED_GROUP_ID/.test(graphSource), "buildTraceComponentGraph no longer flags the agent>undeclared edge as malicious"],
  ];
  for (const [ok, message] of rules) {
    if (!ok) {
      out.failures.push(message);
    }
  }
});

check("G11", "export records resolve to trace files in the right app folder (what the UI would show)", (out) => {
  for (const item of unresolved) {
    out.warnings.push(`no trace file for export record: ${item}`);
  }
  for (const item of duplicateNames) {
    out.warnings.push(`trace file name is not unique (the loader keys by file name, last one wins): ${item}`);
  }
  for (const row of rows) {
    if (row.folderAppId !== row.appId) {
      out.warnings.push(`${row.stem}: record says ${row.appId} but the file lives under the ${row.folderAppId} folder`);
    }
  }
  for (const [label, list] of Object.entries(notShown)) {
    if (list.length > 0) {
      out.warnings.push(`${list.length} export record(s) are not surfaced by the UI (${label}): ${list.slice(0, 4).join("; ")}${list.length > 4 ? "; ..." : ""}`);
    }
  }
  out.info = `${exportRecords.length} export records, ${rows.length} verified, glob ${tracePattern}, ${filesByName.size} trace files on disk`;
});

check("G12", "every manifest group id has a description in COMPONENT_DETAIL (side panel text)", (out) => {
  const block = graphSource.match(/const COMPONENT_DETAIL[\s\S]*?\n\};/);
  if (!block) {
    out.warnings.push("COMPONENT_DETAIL not found in componentGraph.ts");
    return;
  }
  const keys = new Set([...block[0].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]));
  for (const id of [...groupIdsInManifest].sort()) {
    if (!keys.has(id)) {
      out.warnings.push(`group "${id}" has no COMPONENT_DETAIL entry (the panel falls back to "Tools used in this view.")`);
    }
  }
});

check("G13", "drift against the known-good copies in the pack (informational: a deliberate improvement or a new app is allowed)", (out) => {
  const pairs = [
    ["reference/componentGraph.ts", "frontend/src/utils/componentGraph.ts"],
    ["reference/toolManifest.ts", "frontend/src/utils/toolManifest.ts"],
    ["reference/ComponentBubbleGraph.tsx", "frontend/src/components/ComponentBubbleGraph.tsx"],
    ["manifests/agents.json", "frontend/src/content/agents.json"],
  ]
    .map(([from, target]) => [path.join(HERE, from), target])
    .filter(([from]) => fs.existsSync(from));
  if (pairs.length === 0) {
    out.info = "no known-good copies in the pack, skipped";
    return;
  }
  const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
  let same = 0;
  for (const [reference, target] of pairs) {
    if (sha(reference) === sha(path.join(ROOT, target))) {
      same += 1;
    } else {
      const shown = reference.startsWith(ROOT) ? rel(reference) : reference;
      out.warnings.push(`${target} differs from ${shown} (diff -u ${shown} ${target})`);
    }
  }
  out.info = `${same} of ${pairs.length} files identical to the pack copies`;
});

check("G14", "every buildTraceComponentGraph call site passes the application (app option); without it every tool is drawn as undeclared", (out) => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
      const full = path.join(dir, item.name);
      return item.isDirectory() ? walk(full) : [full];
    });
  const own = path.join(SRC, "utils", "componentGraph.ts");
  let calls = 0;
  for (const file of walk(SRC).filter((item) => /\.tsx?$/.test(item) && item !== own)) {
    const text = readText(file);
    for (const match of text.matchAll(/buildTraceComponentGraph\(/g)) {
      calls += 1;
      if (!/\bapp\s*:/.test(text.slice(match.index, match.index + 260))) {
        out.failures.push(`${rel(file)}: buildTraceComponentGraph(...) is called without the app option`);
      }
    }
  }
  if (calls === 0) {
    out.warnings.push("no call site of buildTraceComponentGraph found (is the trace graph still rendered?)");
  }
  out.info = `${calls} call sites`;
});

check("G15", "no tool call is silently dropped: parseToolNames understands every item of every tool_calls field", (out) => {
  let items = 0;
  for (const row of rows) {
    row.conversation.forEach((turn, index) => {
      const raw = turn.tool_calls;
      if (!raw) {
        return;
      }
      const parsed = tv.parseToolNames(raw);
      if (Array.isArray(raw)) {
        items += raw.length;
        if (parsed.length !== raw.length) {
          out.failures.push(`${row.appId} ${row.stem} turn ${index}: ${raw.length - parsed.length} of ${raw.length} tool_calls entries have no usable name`);
        }
        return;
      }
      if (typeof raw !== "string") {
        out.failures.push(`${row.appId} ${row.stem} turn ${index}: tool_calls has an unsupported type (${typeof raw})`);
        return;
      }
      const known = new Set(parsed);
      for (const line of raw.split("\n")) {
        const item = line.replace(/^\s*[-*]\s*/, "").replace(/^\s*Tool calls:\s*/i, "").trim();
        if (!item) {
          continue;
        }
        items += 1;
        if (!known.has(item)) {
          out.failures.push(`${row.appId} ${row.stem} turn ${index}: tool call "${item}" is dropped by parseToolNames (only plain identifiers [A-Za-z][A-Za-z0-9_]* are read), so it appears nowhere in the graph or the trace view`);
        }
      }
    });
  }
  out.info = `${items} tool_calls items checked`;
});

// Evidence to decide the group of tools the manifest does not declare. It reads every trace file on disk
// (not only the ones the UI lists), so it also works for an application that is not registered yet.
function buildToolReport() {
  const found = new Map();
  for (const file of new Set(filesByName.values())) {
    let conversation;
    try {
      conversation = readJson(file).conversation;
    } catch {
      continue;
    }
    if (!Array.isArray(conversation)) {
      continue;
    }
    const app = `app-${posix(path.relative(PRELOAD, file)).split("/")[0].replace(/_/g, "-")}`;
    const stem = path.basename(file, ".json");
    const index = new Map();
    for (const group of groupsOf(manifest[app])) {
      for (const tool of toolsOf(group)) {
        index.set(tool, group.id);
      }
    }
    const callTurns = [];
    conversation.forEach((turn, position) => {
      if (String(turn.role ?? "").toLowerCase() === "assistant") {
        const names = tv.parseToolNames(turn.tool_calls);
        if (names.length > 0) {
          callTurns.push({ position, names });
        }
      }
    });
    callTurns.forEach(({ position, names }, turnIndex) => {
      names.forEach((name, offset) => {
        if (!name || tm.isIgnoredTool(name) || index.has(name)) {
          return;
        }
        const key = `${app}|${name}`;
        const entry = found.get(key) ?? { app, tool: name, calls: 0, traces: new Set(), results: [], neighbours: new Map() };
        entry.calls += 1;
        entry.traces.add(stem);
        const next = conversation[position + 1 + offset];
        if (entry.results.length < 2 && ["tool", "function"].includes(String(next?.role ?? "").toLowerCase())) {
          const text = String(next.content ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
          if (text) {
            entry.results.push(`${stem}: ${text}`);
          }
        }
        for (const around of [callTurns[turnIndex - 1], callTurns[turnIndex], callTurns[turnIndex + 1]]) {
          for (const other of around?.names ?? []) {
            if (other !== name && index.has(other)) {
              entry.neighbours.set(other, index.get(other));
            }
          }
        }
        found.set(key, entry);
      });
    });
  }
  return [...found.values()]
    .map((item) => ({
      app: item.app,
      tool: item.tool,
      calls: item.calls,
      traces: [...item.traces].sort(),
      results: item.results,
      neighbours: [...item.neighbours].slice(0, 6).map(([name, group]) => `${name} (${group})`),
    }))
    .sort((a, b) => a.app.localeCompare(b.app) || b.calls - a.calls || a.tool.localeCompare(b.tool));
}

function formatToolReport(report) {
  if (report.length === 0) {
    return ["Tool report: every tool used by the trace files is declared in the manifest of its application."];
  }
  const lines = [
    "Tool report: tools used by trace files that the manifest of their application does not declare.",
    "Application id = `app-` + trace folder name. Nearby declared tools are a hint for the group, not a verdict.",
  ];
  const apps = [...new Set(report.map((item) => item.app))];
  for (const app of apps) {
    const items = report.filter((item) => item.app === app);
    lines.push(`  ${app}: ${items.length} undeclared tool(s)${manifest[app] ? "" : " (no manifest entry at all)"}`);
    for (const item of items) {
      const shown = item.traces.slice(0, 3).join(", ") + (item.traces.length > 3 ? ", ..." : "");
      lines.push(`    ${item.tool}: ${item.calls} call(s) in ${item.traces.length} trace(s) [${shown}]`);
      for (const result of item.results) {
        lines.push(`        result  ${result}`);
      }
      if (item.neighbours.length > 0) {
        lines.push(`        near    ${item.neighbours.join(", ")}`);
      }
    }
  }
  return lines;
}

// ---------------------------------------------------------------- report ----

const perApp = {};
for (const row of rows) {
  const entry = (perApp[row.appId] ??= { traces: 0, edges: 0, tools: new Set(), groups: new Set() });
  entry.traces += 1;
  entry.edges += row.graph.edges.length;
  row.expected.forEach((value, id) => {
    entry.groups.add(id);
    value.tools.forEach((tool) => entry.tools.add(tool));
  });
}
const metrics = {
  exportRecords: exportRecords.length,
  tracesVerified: rows.length,
  edges: rows.reduce((sum, row) => sum + row.graph.edges.length, 0),
  perApp: Object.fromEntries(
    Object.entries(perApp).map(([appId, entry]) => [
      appId,
      {
        traces: entry.traces,
        edges: entry.edges,
        distinctTools: entry.tools.size,
        groupsUsed: entry.groups.size,
        manifestTools: groupsOf(manifest[appId]).reduce((sum, group) => sum + toolsOf(group).length, 0),
        manifestGroups: groupsOf(manifest[appId]).length,
      },
    ]),
  ),
};
const failed = checks.filter((item) => item.status === "FAIL").length;
const warned = checks.filter((item) => item.status === "WARN").length;
const toolReport = TOOL_REPORT ? buildToolReport() : null;

if (AS_JSON) {
  console.log(JSON.stringify({ ok: failed === 0, failed, warned, checks, metrics, ...(toolReport ? { toolReport } : {}) }, null, 2));
} else {
  const lines = [];
  for (const item of checks) {
    lines.push(`${item.status.padEnd(4)}  ${item.id.padEnd(3)}  ${item.title}`);
    if (item.info) {
      lines.push(`            ${item.info}`);
    }
    for (const message of item.failures.slice(0, 12)) {
      lines.push(`          - ${message}`);
    }
    if (item.failures.length > 12) {
      lines.push(`          - ... and ${item.failures.length - 12} more`);
    }
    for (const message of item.warnings.slice(0, 8)) {
      lines.push(`          ~ ${message}`);
    }
    if (item.warnings.length > 8) {
      lines.push(`          ~ ... and ${item.warnings.length - 8} more`);
    }
  }
  lines.push("");
  lines.push(
    `Measured: ${metrics.tracesVerified} of ${metrics.exportRecords} export records verified, ${metrics.edges} edges in total.`,
  );
  for (const [appId, entry] of Object.entries(metrics.perApp)) {
    lines.push(
      `  ${appId.padEnd(22)} ${String(entry.traces).padStart(2)} traces, ${String(entry.edges).padStart(3)} edges, ` +
        `${entry.distinctTools} of ${entry.manifestTools} manifest tools used, ${entry.groupsUsed} of ${entry.manifestGroups} groups used`,
    );
  }
  lines.push("");
  if (toolReport) {
    lines.push(...formatToolReport(toolReport), "");
  }
  lines.push(
    failed === 0
      ? `RESULT: PASS (${checks.length} checks, ${warned} with warnings)`
      : `RESULT: FAIL (${failed} of ${checks.length} checks failed, ${warned} with warnings)`,
  );
  console.log(lines.join("\n"));
}
process.exit(failed === 0 ? 0 : 1);
