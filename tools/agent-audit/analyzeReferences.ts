import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const candidatesPath = path.join(ROOT, "artifacts/agent-audit/raw-candidates.json");

if (!fs.existsSync(candidatesPath)) {
  console.error("❌ Error: raw-candidates.json not found. Run scanAgents.ts first.");
  process.exit(1);
}

const candidates = JSON.parse(fs.readFileSync(candidatesPath, "utf8")).candidates as { file: string }[];

console.log("🔗 Analyzing agent references...");

function readAllTsFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  const EXCLUDE_DIRS = ["node_modules", ".next", "dist", "build", "coverage", ".turbo", "artifacts"];
  
  while (stack.length) {
    const d = stack.pop()!;
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (EXCLUDE_DIRS.includes(e.name)) continue;
          stack.push(p);
        } else if (e.isFile()) {
          if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) out.push(p);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  return out;
}

const allFiles = readAllTsFiles(ROOT);
const fileText: Record<string, string> = {};

console.log(`Reading ${allFiles.length} files...`);

for (const f of allFiles) {
  try {
    fileText[path.relative(ROOT, f)] = fs.readFileSync(f, "utf8");
  } catch (error) {
    // Skip files we can't read
  }
}

function findReferences(targetRelPath: string): string[] {
  const refs: string[] = [];
  const targetBase = targetRelPath.replace(/\.(ts|tsx)$/, "");
  const targetName = path.basename(targetRelPath, path.extname(targetRelPath));
  
  for (const [f, txt] of Object.entries(fileText)) {
    // Skip self-references
    if (f === targetRelPath) continue;
    
    // Check for import statements
    if (txt.includes(targetBase) || txt.includes(targetName)) {
      refs.push(f);
    }
  }
  return refs;
}

const usage = candidates.map(c => {
  const refs = findReferences(c.file);
  const txt = fileText[c.file] || "";
  const directInvokeHits: string[] = [];
  
  // Find direct invocations
  const invokeMatches = txt.match(/invokeAgent\(\s*["'`][^"'`]+["'`]/g) || [];
  const emitMatches = txt.match(/\b(emit|publish)\(\s*["'`][^"'`]+["'`]/g) || [];
  
  if (invokeMatches.length || emitMatches.length) {
    directInvokeHits.push(...invokeMatches, ...emitMatches);
  }
  
  return {
    file: c.file,
    referencedByCount: refs.length,
    referencedBy: refs.slice(0, 50),
    localCalls: directInvokeHits.slice(0, 50),
    isReferenced: refs.length > 0,
  };
});

// Find unreferenced agents
const unreferenced = usage.filter(u => !u.isReferenced && u.localCalls.length === 0);

fs.writeFileSync(
  path.join(ROOT, "artifacts/agent-audit/references.json"),
  JSON.stringify({ 
    generatedAt: new Date().toISOString(),
    totalAgents: usage.length,
    referencedCount: usage.filter(u => u.isReferenced).length,
    unreferencedCount: unreferenced.length,
    usage 
  }, null, 2)
);

console.log(`✅ Reference analysis complete.`);
console.log(`📄 Results written to: artifacts/agent-audit/references.json`);

console.log("\n📊 Reference summary:");
console.log(`  Total agents: ${usage.length}`);
console.log(`  Referenced: ${usage.filter(u => u.isReferenced).length}`);
console.log(`  Unreferenced: ${unreferenced.length}`);

if (unreferenced.length > 0) {
  console.log("\n⚠️  Unreferenced agents (possible dead code):");
  unreferenced.slice(0, 20).forEach(u => {
    console.log(`  - ${u.file}`);
  });
  if (unreferenced.length > 20) {
    console.log(`  ... and ${unreferenced.length - 20} more`);
  }
}
