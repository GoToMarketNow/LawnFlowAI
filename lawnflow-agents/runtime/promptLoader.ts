import { readFileSync } from 'fs';
import { join } from 'path';

export class PromptLoader {
  private basePath: string;

  constructor(basePath: string = './prompts') {
    this.basePath = basePath;
  }

  loadShared(): Record<string, string> {
    const shared = ['system_core', 'finops_policy', 'brand_tone', 'tool_contracts', 'json_schemas', 'routing_rules'];
    const result: Record<string, string> = {};

    for (const file of shared) {
      try {
        result[file] = this.loadFile(join('shared', `${file}.md`));
      } catch (error) {
        console.warn(`Failed to load shared prompt: ${file}`);
        result[file] = '';
      }
    }

    return result;
  }

  loadAgent(agentName: string): string {
    try {
      return this.loadFile(join('agents', `${agentName}.md`));
    } catch (error) {
      throw new Error(`Failed to load agent prompt: ${agentName}`);
    }
  }

  loadSubagent(subagentName: string): string {
    try {
      return this.loadFile(join('subagents', `${subagentName}.md`));
    } catch (error) {
      throw new Error(`Failed to load subagent prompt: ${subagentName}`);
    }
  }

  private loadFile(filePath: string): string {
    return readFileSync(join(this.basePath, filePath), 'utf-8');
  }

  composePrompt(agentName: string, isSubagent: boolean = false): string {
    const shared = this.loadShared();
    const agent = isSubagent ? this.loadSubagent(agentName) : this.loadAgent(agentName);

    const sharedContent = Object.values(shared).filter(content => content.length > 0).join('\n\n');
    return sharedContent + '\n\n' + agent;
  }
}