#!/usr/bin/env node

import 'dotenv/config';
import { AgentRunner } from './runtime';
import { Event, StateSummary, FinOpsConfig } from './runtime/types';

// Example usage
async function main() {
  const runner = new AgentRunner();

  // Example event
  const event: Event = {
    type: 'inbound_sms',
    channel: 'sms',
    payload: {
      from: '+1555123456',
      message: 'Hi, I need my lawn mowed this week. What\'s your availability?'
    },
    timestamp: new Date().toISOString()
  };

  const stateSummary: StateSummary = {
    last_actions: []
  };

  const finops: FinOpsConfig = {
    token_budget: 2000,
    allowed_tools: ['state.get', 'state.search', 'comms.send_sms'],
    max_tool_calls: 1
  };

  try {
    const result = await runner.runAgent('orchestrator', event, stateSummary, finops);
    console.log('Agent Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export * from './runtime';