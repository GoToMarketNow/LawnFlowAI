import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FlowNode {
  id: string;
  type: 'message' | 'question' | 'review' | 'activation';
  text?: string;
  title?: string;
  question?: string;
  inputType?: string;
  options?: { key: string; label: string }[];
  required?: boolean;
  validation?: { pattern?: string; error?: string };
  followUps?: { when: any; ask: string }[];
  transitions?: { when: any; next: string }[];
  defaultNext?: string | null;
  next?: string | null;
  flags?: { assumptionMade?: boolean; revisitLater?: boolean };
}

interface OnboardingFlow {
  flow: {
    id: string;
    name: string;
    version: string;
    maxQuestions: number;
    startNodeId: string;
    personas?: string[];
  };
  enums?: Record<string, string[]>;
  nodes: FlowNode[];
  configMappings?: Record<string, any>;
}

const FLOWS_DIR = path.join(__dirname, 'flows');
const YAML_FILE = path.join(FLOWS_DIR, 'lawnflow_v1.yaml');
const JSON_FILE = path.join(FLOWS_DIR, 'lawnflow_v1.json');
const SCHEMA_FILE = path.join(FLOWS_DIR, 'schema.json');

function validateFlow(flow: OnboardingFlow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!flow.flow) {
    errors.push('Missing "flow" object');
  } else {
    if (!flow.flow.id) errors.push('Missing flow.id');
    if (!flow.flow.name) errors.push('Missing flow.name');
    if (!flow.flow.version) errors.push('Missing flow.version');
    if (!flow.flow.startNodeId) errors.push('Missing flow.startNodeId');
    if (!flow.flow.maxQuestions || flow.flow.maxQuestions < 1) {
      errors.push('flow.maxQuestions must be at least 1');
    }
  }
  
  if (!flow.nodes || !Array.isArray(flow.nodes)) {
    errors.push('Missing or invalid "nodes" array');
  } else {
    const nodeIds = new Set<string>();
    
    for (const node of flow.nodes) {
      if (!node.id) {
        errors.push(`Node missing id: ${JSON.stringify(node)}`);
        continue;
      }
      
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node id: ${node.id}`);
      }
      nodeIds.add(node.id);
      
      if (!node.type) {
        errors.push(`Node ${node.id} missing type`);
      }
      
      if (node.type === 'question') {
        if (!node.question && !node.text) {
          errors.push(`Question node ${node.id} missing question text`);
        }
        if (!node.inputType) {
          errors.push(`Question node ${node.id} missing inputType`);
        }
        if (['single_select', 'multi_select'].includes(node.inputType || '') && 
            (!node.options || node.options.length === 0)) {
          errors.push(`Select node ${node.id} missing options`);
        }
      }
      
      if (node.type === 'message' && !node.text) {
        errors.push(`Message node ${node.id} missing text`);
      }
    }
    
    if (flow.flow && !nodeIds.has(flow.flow.startNodeId)) {
      errors.push(`startNodeId "${flow.flow.startNodeId}" not found in nodes`);
    }
    
    for (const node of flow.nodes) {
      if (node.next && node.next !== null && !nodeIds.has(node.next)) {
        errors.push(`Node ${node.id} references unknown next node: ${node.next}`);
      }
      if (node.defaultNext && !nodeIds.has(node.defaultNext)) {
        errors.push(`Node ${node.id} references unknown defaultNext: ${node.defaultNext}`);
      }
      if (node.transitions) {
        for (const t of node.transitions) {
          if (t.next && !nodeIds.has(t.next)) {
            errors.push(`Node ${node.id} transition references unknown node: ${t.next}`);
          }
        }
      }
      if (node.followUps) {
        for (const f of node.followUps) {
          if (f.ask && !nodeIds.has(f.ask)) {
            errors.push(`Node ${node.id} followUp references unknown node: ${f.ask}`);
          }
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

async function buildFlow(): Promise<void> {
  console.log('Building onboarding flow...');
  console.log(`Reading YAML from: ${YAML_FILE}`);
  
  if (!fs.existsSync(YAML_FILE)) {
    console.error(`Error: YAML file not found: ${YAML_FILE}`);
    process.exit(1);
  }
  
  const yamlContent = fs.readFileSync(YAML_FILE, 'utf-8');
  let flowData: OnboardingFlow;
  
  try {
    flowData = yaml.load(yamlContent) as OnboardingFlow;
  } catch (e: any) {
    console.error(`Error parsing YAML: ${e.message}`);
    process.exit(1);
  }
  
  console.log(`Parsed flow: ${flowData.flow.name} (${flowData.flow.version})`);
  console.log(`  Nodes: ${flowData.nodes.length}`);
  console.log(`  Start node: ${flowData.flow.startNodeId}`);
  
  const validation = validateFlow(flowData);
  if (!validation.valid) {
    console.error('Validation errors:');
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  
  console.log('Validation passed!');
  
  const questionNodes = flowData.nodes.filter(n => n.type === 'question');
  console.log(`  Question nodes: ${questionNodes.length}`);
  
  if (questionNodes.length > flowData.flow.maxQuestions) {
    console.warn(`Warning: ${questionNodes.length} questions exceeds maxQuestions (${flowData.flow.maxQuestions})`);
  }
  
  const jsonContent = JSON.stringify(flowData, null, 2);
  fs.writeFileSync(JSON_FILE, jsonContent, 'utf-8');
  console.log(`Wrote JSON to: ${JSON_FILE}`);
  
  console.log('\nBuild complete!');
}

buildFlow().catch(console.error);
