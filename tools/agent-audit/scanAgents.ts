import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INCLUDE_EXT = [".ts", ".tsx"];
const EXCLUDE_DIRS = ["node_modules", ".next", "dist", "build", "coverage", ".turbo", "artifacts", "tools"];

function walk(dir: string, files: string[] = []): string[] {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.includes(entry.name)) continue;
        walk(p, files);
      } else if (entry.isFile()) {
        if (INCLUDE_EXT.includes(path.extname(entry.name))) files.push(p);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}`);
  }
  return files;
}

function score(content: string): { total: number; hits: Record<string, number> } {
  const signals = [
    ["agent", /\bagent\b/i],
    ["definition", /\bdefinition\b/],
    ["run/execute/handler", /\b(run|execute|handler)\b/],
    ["temporal", /\b(proxyActivities|executeChild|startChild|defineSignal|setHandler)\b/],
    ["events", /\b(emit|publish|subscribe|on\()\b/],
    ["hitl", /\b(HITL|approval|approve|review)\b/i],
    ["notifications", /\b(sms|twilio|email|push|notify)\b/i],
    ["openai", /\b(openai|gpt|chat\.completions)\b/i],
  ] as const;
  
  let total = 0;
  const hits: Record<string, number> = {};
  
  for (const [name, re] of signals) {
    const matches = content.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    const count = matches?.length ?? 0;
    hits[name] = count;
    if (count > 0) total += Math.min(5, count);
  }
  
  return { total, hits };
}

console.log("🔍 Scanning for agent candidates...");
console.log(`Root directory: ${ROOT}`);

const all = walk(ROOT);
const candidates = [];

console.log(`Found ${all.length} TypeScript files to analyze`);

for (const file of all) {
  try {
    const content = fs.readFileSync(file, "utf8");
    const { total, hits } = score(content);
    
    // Keep even medium-confidence so we don't miss anything
    if (total >= 3 || hits["temporal"] > 0 || hits["events"] > 0 || /agent/i.test(file)) {
      candidates.push({
        file: path.relative(ROOT, file),
        score: total,
        hits,
      });
    }
  } catch (error) {
    console.warn(`Warning: Could not read file ${file}`);
  }
}

fs.mkdirSync(path.join(ROOT, "artifacts/agent-audit"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "artifacts/agent-audit/raw-candidates.json"),
  JSON.stringify({ 
    generatedAt: new Date().toISOString(), 
    count: candidates.length, 
    candidates 
  }, null, 2)
);

console.log(`✅ Found ${candidates.length} agent candidates.`);
console.log(`📄 Results written to: artifacts/agent-audit/raw-candidates.json`);

// Print summary by score
const byScore = candidates.reduce((acc, c) => {
  const range = Math.floor(c.score / 10) * 10;
  acc[range] = (acc[range] || 0) + 1;
  return acc;
}, {} as Record<number, number>);

console.log("\n📊 Distribution by score:");
Object.entries(byScore)
  .sort(([a], [b]) => Number(b) - Number(a))
  .forEach(([range, count]) => {
    console.log(`  ${range}+: ${count} candidates`);
  });
