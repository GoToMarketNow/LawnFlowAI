export interface Event {
  type: string;
  channel: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface StateSummary {
  customer_id?: string;
  job_id?: string;
  crew_id?: string;
  last_actions: string[];
}

export interface Cost {
  estimated_tokens_in: number;
  estimated_tokens_out: number;
  tool_calls: number;
}

export interface NextAction {
  type: 'tool_call' | 'ask_user' | 'handoff';
  detail: string;
}

export interface Error {
  code: string;
  message: string;
}

export interface Envelope {
  status: 'ok' | 'needs_input' | 'blocked' | 'error';
  agent: string;
  summary: string;
  cost: Cost;
  data: any;
  next_actions: NextAction[];
  errors: Error[];
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface FinOpsConfig {
  token_budget: number;
  allowed_tools: string[];
  max_tool_calls: number;
}