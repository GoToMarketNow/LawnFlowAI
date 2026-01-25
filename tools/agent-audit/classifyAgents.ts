import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const candidatesPath = path.join(ROOT, "artifacts/agent-audit/raw-candidates.json");

if (!fs.existsSync(candidatesPath)) {
  console.error("❌ Error: raw-candidates.json not found. Run scanAgents.ts first.");
  process.exit(1);
}

const candidates = JSON.parse(fs.readFileSync(candidatesPath, "utf8")).candidates;

type AgentType = "orchestrator_agent" | "general_agent" | "capability" | "workflow" | "deprecated";

function classify(candidate: any): { type: AgentType; reason: string } {
  const filepath = candidate.file;
  
  // Read file content for deeper analysis
  let content = "";
  try {
    content = fs.readFileSync(path.join(ROOT, candidate.file), "utf8");
  } catch (error) {
    return { type: "deprecated", reason: "File not readable" };
  }
  
  // Orchestrator agents - in orchestrator/*/agents/ folders
  if (/orchestrator[/\\][^/\\]+[/\\]agents[/\\]/.test(filepath)) {
    return { type: "orchestrator_agent", reason: "Located in orchestrator workflow agents directory" };
  }
  
  // General agents - extend BaseAgent or in lawnflow-agents/src/agents
  if (content.includes("extends BaseAgent") || /lawnflow-agents[/\\]src[/\\]agents/.test(filepath)) {
    return { type: "general_agent", reason: "Extends BaseAgent or in lawnflow-agents package" };
  }
  
  // Temporal workflows
  if (content.includes("proxyActivities") && content.includes("workflow")) {
    return { type: "workflow", reason: "Contains Temporal workflow definitions" };
  }
  
  // Capability modules - tools, utilities, shared logic
  if (filepath.includes("/lib/") || filepath.includes("\\lib\\") || 
      filepath.includes("/utils/") || filepath.includes("\\utils\\") || 
      filepath.includes("/tools/") || filepath.includes("\\tools\\")) {
    return { type: "capability", reason: "Located in shared utilities directory" };
  }
  
  // Knowledge/assistant agents in server/lib
  if (/server[/\\]lib[/\\](assistant|knowledge)/.test(filepath)) {
    return { type: "general_agent", reason: "Knowledge/assistant agent in server/lib" };
  }
  
  // Agent service directory (to be deprecated)
  if (/agent-service/.test(filepath)) {
    return { type: "deprecated", reason: "Located in deprecated agent-service directory" };
  }
  
  // Server agents directory (to be migrated)
  if (/server[/\\]agents[/\\]/.test(filepath) && !filepath.includes("_adapters")) {
    return { type: "orchestrator_agent", reason: "Server agent to be migrated to orchestrator" };
  }
  
  // Default classification based on content
  if (content.includes("Agent") && content.includes("execute")) {
    return { type: "general_agent", reason: "Contains Agent class with execute method" };
  }
  
  return { type: "capability", reason: "Default classification - likely utility" };
}

console.log("🏷️  Classifying agent candidates...");

const classified = candidates.map((c: any) => ({
  ...c,
  classification: classify(c),
}));

fs.writeFileSync(
  path.join(ROOT, "artifacts/agent-audit/classification.json"),
  JSON.stringify({ 
    generatedAt: new Date().toISOString(),
    count: classified.length,
    classified 
  }, null, 2)
);

console.log(`✅ Classification complete.`);
console.log(`📄 Results written to: artifacts/agent-audit/classification.json`);

// Print summary by type
const byType = classified.reduce((acc: Record<string, number>, c: any) => {
  const type = c.classification.type;
  acc[type] = (acc[type] || 0) + 1;
  return acc;
}, {});

console.log("\n📊 Classification summary:");
Object.entries(byType)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count} candidates`);
  });
