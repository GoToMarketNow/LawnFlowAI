const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

console.log("🗺️  Building agent workflow map...");

// Extract from registry
function extractFromRegistry() {
  const registryPath = path.join(ROOT, "lawnflow-agents/src/core/registry.ts");
  const content = fs.readFileSync(registryPath, "utf8");
  
  const nodes = [];
  const registerMatches = content.matchAll(/this\.register\(new (\w+Agent)\(\)\);/g);
  
  for (const match of registerMatches) {
    const className = match[1];
    const id = className.replace("Agent", "").replace(/([A-Z])/g, "_$1").toLowerCase().slice(1);
    nodes.push({
      id,
      name: className.replace("Agent", ""),
      type: "general_agent",
      location: `lawnflow-agents/src/agents/${id}.ts`,
    });
  }
  
  return nodes;
}

// Extract from orchestrator engines
function extractOrchestrators() {
  const nodes = [];
  
  // Lead-to-Cash
  const leadToCashAgents = [
    "leadIntake", "quoteBuild", "quoteConfirm", "schedulePropose",
    "simulationRun", "feasibilityCheck", "marginValidate", "crewLock",
    "dispatchReady", "jobBook"
  ];
  
  for (const agent of leadToCashAgents) {
    nodes.push({
      id: `ltc_${agent}`,
      name: agent,
      type: "orchestrator_agent",
      location: `server/orchestrator/leadToCash/agents/${agent}.ts`,
    });
  }
  
  // Payment
  nodes.push({
    id: "payment_agent",
    name: "paymentAgent",
    type: "orchestrator_agent",
    location: "server/orchestrator/payment/paymentAgent.ts",
  });
  
  // Post-Job QA
  nodes.push({
    id: "postjob_qa",
    name: "postJobQAAgent",
    type: "orchestrator_agent",
    location: "server/orchestrator/postJobQA/postJobQAAgent.ts",
  });
  
  nodes.push({
    id: "review_management",
    name: "reviewManagementAgent",
    type: "orchestrator_agent",
    location: "server/orchestrator/postJobQA/reviewManagementAgent.ts",
  });
  
  return nodes;
}

// Extract handoffs from code
function extractHandoffs(nodes) {
  const edges = [];
  
  for (const node of nodes) {
    const filepath = path.join(ROOT, node.location);
    if (!fs.existsSync(filepath)) continue;
    
    try {
      const content = fs.readFileSync(filepath, "utf8");
      
      // Find handoffs: this.createHandoff('agent_name', ...)
      const handoffMatches = content.matchAll(/createHandoff\(['"](\w+)['"]/g);
      for (const match of handoffMatches) {
        edges.push({
          from: node.id,
          to: match[1],
          type: "handoff",
        });
      }
      
      // Find events: emit('event_name')
      const emitMatches = content.matchAll(/emit\(['"](\w+)['"]/g);
      for (const match of emitMatches) {
        edges.push({
          from: node.id,
          to: match[1],
          type: "event",
          label: match[1],
        });
      }
    } catch (error) {
      // Skip files we can't read
    }
  }
  
  return edges;
}

// Extract orchestrator workflow transitions
function extractWorkflowTransitions() {
  const edges = [];
  const STAGE_ORDER = [
    "leadIntake",
    "quoteBuild",
    "quoteConfirm",
    "schedulePropose",
    "simulationRun",
    "feasibilityCheck",
    "marginValidate",
    "crewLock",
    "dispatchReady",
    "jobBook",
  ];
  
  for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
    edges.push({
      from: `ltc_${STAGE_ORDER[i]}`,
      to: `ltc_${STAGE_ORDER[i + 1]}`,
      type: "workflow_transition",
      label: "next_stage",
    });
  }
  
  return edges;
}

const nodes = [...extractFromRegistry(), ...extractOrchestrators()];
const edges = [...extractHandoffs(nodes), ...extractWorkflowTransitions()];

const map = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalNodes: nodes.length,
    generalAgents: nodes.filter(n => n.type === "general_agent").length,
    orchestratorAgents: nodes.filter(n => n.type === "orchestrator_agent").length,
    totalEdges: edges.length,
    handoffs: edges.filter(e => e.type === "handoff").length,
    events: edges.filter(e => e.type === "event").length,
    workflowTransitions: edges.filter(e => e.type === "workflow_transition").length,
  },
  nodes,
  edges,
};

fs.writeFileSync(
  path.join(ROOT, "artifacts/agent-audit/agent-map.json"),
  JSON.stringify(map, null, 2)
);

console.log(`✅ Agent map generated.`);
console.log(`📄 Results written to: artifacts/agent-audit/agent-map.json`);
console.log(`\n📊 Map summary:`);
console.log(`  Total agents: ${map.summary.totalNodes}`);
console.log(`    - General agents: ${map.summary.generalAgents}`);
console.log(`    - Orchestrator agents: ${map.summary.orchestratorAgents}`);
console.log(`  Total connections: ${map.summary.totalEdges}`);
console.log(`    - Handoffs: ${map.summary.handoffs}`);
console.log(`    - Events: ${map.summary.events}`);
console.log(`    - Workflow transitions: ${map.summary.workflowTransitions}`);

// Generate Mermaid diagram
function generateMermaid(nodes, edges) {
  let mermaid = "graph TB\n\n";
  
  // Subgraph for Lead-to-Cash
  mermaid += "  subgraph leadToCash [Lead-to-Cash Workflow]\n";
  const ltcNodes = nodes.filter(n => n.id.startsWith("ltc_"));
  for (const node of ltcNodes) {
    mermaid += `    ${node.id}[${node.name}]\n`;
  }
  mermaid += "  end\n\n";
  
  // Subgraph for General Agents
  mermaid += "  subgraph generalAgents [General-Purpose Agents]\n";
  const genNodes = nodes.filter(n => n.type === "general_agent");
  for (const node of genNodes.slice(0, 10)) { // Limit to first 10 for readability
    mermaid += `    ${node.id}(${node.name})\n`;
  }
  mermaid += "  end\n\n";
  
  // Subgraph for Other Orchestrators
  mermaid += "  subgraph otherOrchestrators [Other Workflows]\n";
  const otherNodes = nodes.filter(n => n.type === "orchestrator_agent" && !n.id.startsWith("ltc_"));
  for (const node of otherNodes) {
    mermaid += `    ${node.id}[${node.name}]\n`;
  }
  mermaid += "  end\n\n";
  
  // Edges
  for (const edge of edges) {
    const arrow = edge.type === "handoff" ? "-->" : edge.type === "event" ? "-.->" : "==>";
    const label = edge.label ? `|${edge.label}|` : "";
    mermaid += `  ${edge.from} ${arrow}${label} ${edge.to}\n`;
  }
  
  return mermaid;
}

fs.writeFileSync(
  path.join(ROOT, "artifacts/agent-audit/agent-map.mermaid"),
  generateMermaid(nodes, edges)
);

console.log(`📄 Mermaid diagram written to: artifacts/agent-audit/agent-map.mermaid`);

// Generate HTML viewer
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Workflow Map</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      margin-top: 0;
      color: #333;
    }
    .stats {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .stat {
      background: #f0f0f0;
      padding: 15px 20px;
      border-radius: 6px;
      flex: 1;
      min-width: 200px;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .mermaid-container {
      margin: 30px 0;
      overflow-x: auto;
    }
    .legend {
      margin: 20px 0;
      padding: 15px;
      background: #f9f9f9;
      border-left: 4px solid #2563eb;
      border-radius: 4px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      margin: 8px 0;
    }
    .legend-icon {
      width: 50px;
      height: 30px;
      margin-right: 10px;
      border: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🗺️ Agent Workflow Map</h1>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${map.summary.totalNodes}</div>
        <div class="stat-label">Total Agents</div>
      </div>
      <div class="stat">
        <div class="stat-value">${map.summary.generalAgents}</div>
        <div class="stat-label">General Agents</div>
      </div>
      <div class="stat">
        <div class="stat-value">${map.summary.orchestratorAgents}</div>
        <div class="stat-label">Orchestrator Agents</div>
      </div>
      <div class="stat">
        <div class="stat-value">${map.summary.totalEdges}</div>
        <div class="stat-label">Connections</div>
      </div>
    </div>

    <div class="legend">
      <h3 style="margin-top: 0;">Legend</h3>
      <div class="legend-item">
        <div class="legend-icon" style="background: #e8f0fe;">[Box]</div>
        <span>Orchestrator Agent (deterministic)</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon" style="background: #fef3e8;">(Round)</div>
        <span>General Agent (AI-powered)</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon">→</div>
        <span>Handoff</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon">⇒</div>
        <span>Workflow Transition</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon">⋯→</div>
        <span>Event</span>
      </div>
    </div>

    <div class="mermaid-container">
      <pre class="mermaid">
${generateMermaid(nodes, edges)}
      </pre>
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f0f9ff; border-radius: 6px;">
      <h3 style="margin-top: 0;">💡 About This Map</h3>
      <p>This map visualizes the relationships between all agents in the LawnFlow platform:</p>
      <ul>
        <li><strong>Lead-to-Cash Workflow</strong>: The deterministic 10-stage pipeline from lead to booked job</li>
        <li><strong>General-Purpose Agents</strong>: AI-powered agents that handle complex, autonomous tasks</li>
        <li><strong>Other Workflows</strong>: Payment, Post-Job QA, and other orchestrated processes</li>
      </ul>
      <p>Generated: ${new Date(map.generatedAt).toLocaleString()}</p>
    </div>
  </div>
  
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</body>
</html>`;

fs.writeFileSync(
  path.join(ROOT, "artifacts/agent-audit/agent-map.html"),
  htmlTemplate
);

console.log(`📄 HTML viewer written to: artifacts/agent-audit/agent-map.html`);
console.log(`\n✨ Open agent-map.html in your browser to view the interactive map!`);
