const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const classificationPath = path.join(ROOT, "artifacts/agent-audit/classification.json");

if (!fs.existsSync(classificationPath)) {
  console.error("❌ Error: classification.json not found. Run classifyAgents first.");
  process.exit(1);
}

const classified = JSON.parse(fs.readFileSync(classificationPath, "utf8")).classified;

console.log("🔍 Detecting duplicate agents...");

// Group by agent name (extracted from filename)
const groups = {};
for (const c of classified) {
  const filename = path.basename(c.file, path.extname(c.file));
  // Normalize names (remove -agent, Agent suffix, kebab-case to camelCase)
  const normalized = filename
    .replace(/-agent$/i, "")
    .replace(/Agent$/i, "")
    .toLowerCase()
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  
  if (!groups[normalized]) groups[normalized] = [];
  groups[normalized].push(c);
}

// Find duplicates (files with same normalized name)
const duplicates = Object.entries(groups)
  .filter(([_, files]) => files.length > 1)
  .map(([name, files]) => ({
    agentName: name,
    count: files.length,
    locations: files.map((f) => ({
      file: f.file,
      type: f.classification.type,
      score: f.score,
    })),
  }))
  .sort((a, b) => b.count - a.count);

// Analyze patterns
const patterns = {
  agentServiceDupes: [],
  serverAgentsDupes: [],
  crossPackageDupes: [],
};

for (const dup of duplicates) {
  const hasAgentService = dup.locations.some((l) => l.file.includes("agent-service"));
  const hasServerAgents = dup.locations.some((l) => l.file.includes("server/agents") || l.file.includes("server\\agents"));
  const hasLawnflowAgents = dup.locations.some((l) => l.file.includes("lawnflow-agents"));
  
  if (hasAgentService) {
    patterns.agentServiceDupes.push(dup);
  }
  if (hasServerAgents) {
    patterns.serverAgentsDupes.push(dup);
  }
  if ((hasAgentService || hasServerAgents) && hasLawnflowAgents) {
    patterns.crossPackageDupes.push(dup);
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalDuplicateGroups: duplicates.length,
    agentServiceDuplicates: patterns.agentServiceDupes.length,
    serverAgentsDuplicates: patterns.serverAgentsDupes.length,
    crossPackageDuplicates: patterns.crossPackageDupes.length,
  },
  duplicates,
  patterns,
};

fs.writeFileSync(
  path.join(ROOT, "artifacts/agent-audit/duplicates.json"),
  JSON.stringify(output, null, 2)
);

console.log(`✅ Found ${duplicates.length} duplicate agent groups.`);
console.log(`📄 Results written to: artifacts/agent-audit/duplicates.json`);

console.log("\n📊 Duplicate patterns:");
console.log(`  agent-service duplicates: ${patterns.agentServiceDupes.length}`);
console.log(`  server/agents duplicates: ${patterns.serverAgentsDupes.length}`);
console.log(`  cross-package duplicates: ${patterns.crossPackageDupes.length}`);

if (duplicates.length > 0) {
  console.log("\n🔝 Top duplicate groups:");
  duplicates.slice(0, 10).forEach((dup) => {
    console.log(`  ${dup.agentName} (${dup.count} copies):`);
    dup.locations.forEach((loc) => {
      console.log(`    - ${loc.file} [${loc.type}]`);
    });
  });
}
