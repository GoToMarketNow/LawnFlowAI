import { BaseAgent } from './interfaces';
import { AgentContext, Envelope, Event } from '../types';

export class OrchestratorAgent extends BaseAgent {
  private routingRules: Map<string, string>;

  constructor() {
    super('orchestrator', '2.0.0');
    this.routingRules = new Map([
      // Event type to agent mapping
      ['inbound_sms', 'inbound_intake'],
      ['web_lead', 'inbound_intake'],
      ['phone_call', 'inbound_intake'],
      ['quote_request', 'pricing_profit'],
      ['scheduling_request', 'scheduling_dispatch'],
      ['route_optimization', 'route_optimizer'],
      ['job_status_update', 'job_execution'],
      ['payment_request', 'invoicing_payment'],
      ['review_request', 'reviews_referrals'],
      ['analytics_query', 'profit_analytics'],
      ['retention_check', 'retention_upsell'],
      ['qualification_needed', 'qualification'],
      ['crew_assignment', 'crew_management'],
      ['policy_violation', 'policy_guard']
    ]);
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    // Validate context
    const validation = this.validateContext(context);
    if (!validation.valid) {
      return this.createEnvelope(
        'error',
        'Invalid context provided',
        null,
        [],
        validation.errors.map(msg => ({ code: 'VALIDATION_ERROR', message: msg, recoverable: false }))
      );
    }

    try {
      // Determine routing based on event
      const selectedAgent = this.determineAgent(context.event);

      if (!selectedAgent) {
        return this.createEnvelope(
          'blocked',
          'No suitable agent found for event type',
          { event_type: context.event.type },
          [this.createUserAsk('Please specify which agent should handle this event')],
          [{ code: 'NO_AGENT_FOUND', message: 'Event type not recognized', recoverable: true }]
        );
      }

      // Prepare agent input with minimal context
      const agentInput = this.prepareAgentInput(context, selectedAgent);

      // Check FinOps constraints
      if (!this.checkFinOpsConstraints(context, selectedAgent)) {
        return this.createEnvelope(
          'blocked',
          'FinOps constraints exceeded',
          { selected_agent: selectedAgent },
          [this.createUserAsk('Reduce token budget or allow more tools')],
          [{ code: 'FINOPS_VIOLATION', message: 'Token budget or tool limits exceeded', recoverable: true }]
        );
      }

      const executionTime = Date.now() - startTime;

      return this.createEnvelope(
        'ok',
        `Routed to ${selectedAgent} agent`,
        {
          selected_agent: selectedAgent,
          agent_input: agentInput,
          required_schema: this.getRequiredSchema(selectedAgent),
          rationale: this.generateRationale(context.event, selectedAgent)
        },
        [this.createHandoff(selectedAgent, agentInput)],
        [],
        {
          estimated_tokens_in: 200,
          estimated_tokens_out: 150,
          tool_calls: 0,
          metadata: {
            execution_time_ms: executionTime,
            agent_version: this.version
          }
        }
      );

    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.createEnvelope(
        'error',
        'Orchestrator execution failed',
        null,
        [],
        [{ code: 'EXECUTION_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: false }],
        {
          estimated_tokens_in: 0,
          estimated_tokens_out: 0,
          tool_calls: 0,
          metadata: {
            execution_time_ms: executionTime,
            agent_version: this.version
          }
        }
      );
    }
  }

  private determineAgent(event: Event): string | null {
    // Direct mapping by event type
    if (this.routingRules.has(event.type)) {
      return this.routingRules.get(event.type)!;
    }

    // Fallback logic based on event content
    if (event.payload?.intent) {
      switch (event.payload.intent) {
        case 'pricing':
          return 'pricing_profit';
        case 'scheduling':
          return 'scheduling_dispatch';
        case 'billing':
          return 'invoicing_payment';
        case 'complaint':
          return 'job_execution';
        case 'review':
          return 'reviews_referrals';
      }
    }

    // Channel-based routing
    if (event.channel === 'sms' && event.type.includes('inbound')) {
      return 'inbound_intake';
    }

    // Default fallback
    return 'qualification';
  }

  private prepareAgentInput(context: AgentContext, selectedAgent: string): any {
    const baseInput = {
      event: context.event,
      customer_id: context.state.customer_id,
      job_id: context.state.job_id,
      crew_id: context.state.crew_id
    };

    // Agent-specific input preparation
    switch (selectedAgent) {
      case 'inbound_intake':
        return {
          ...baseInput,
          message: context.event.payload?.message || context.event.payload?.content,
          channel: context.event.channel
        };

      case 'pricing_profit':
        return {
          ...baseInput,
          services: context.event.payload?.services,
          property_details: context.event.payload?.property,
          urgency: context.event.payload?.urgency || 'medium'
        };

      case 'scheduling_dispatch':
        return {
          ...baseInput,
          preferred_times: context.event.payload?.preferred_times,
          services: context.event.payload?.services
        };

      case 'route_optimizer':
        return {
          ...baseInput,
          crew_id: context.event.payload?.crew_id || context.state.crew_id,
          jobs: context.event.payload?.jobs || context.state.active_jobs
        };

      default:
        return baseInput;
    }
  }

  private getRequiredSchema(agentName: string): string {
    const schemaMap: Record<string, string> = {
      'inbound_intake': 'IntakeResult',
      'qualification': 'QualificationResult',
      'pricing_profit': 'PricingResult',
      'scheduling_dispatch': 'SchedulingResult',
      'route_optimizer': 'RouteOptimizationResult',
      'job_execution': 'JobExecutionResult',
      'invoicing_payment': 'InvoicingResult',
      'retention_upsell': 'RetentionResult',
      'reviews_referrals': 'ReviewsResult',
      'profit_analytics': 'ProfitAnalyticsResult'
    };

    return schemaMap[agentName] || 'GenericResult';
  }

  private generateRationale(event: Event, selectedAgent: string): string {
    const eventType = event.type;
    const channel = event.channel;
    const hasContext = !!(event.payload?.customer_id || event.payload?.job_id);

    let rationale = `Event type '${eventType}' from ${channel} channel`;

    if (hasContext) {
      rationale += ' with existing context';
    }

    rationale += ` routed to ${selectedAgent} for specialized handling.`;

    return rationale.substring(0, 200); // Enforce 200 char limit
  }

  private checkFinOpsConstraints(context: AgentContext, selectedAgent: string): boolean {
    // Check token budget
    if (context.finops.token_budget < 500) {
      return false;
    }

    // Check tool permissions
    const requiredTools = this.getRequiredTools(selectedAgent);
    const hasRequiredTools = requiredTools.every(tool =>
      context.finops.allowed_tools.includes(tool)
    );

    if (!hasRequiredTools) {
      return false;
    }

    return true;
  }

  private getRequiredTools(agentName: string): string[] {
    const toolMap: Record<string, string[]> = {
      'inbound_intake': ['state.get', 'comms.send_sms'],
      'pricing_profit': ['billing.create_quote', 'state.get'],
      'scheduling_dispatch': ['ops.schedule', 'state.get'],
      'route_optimizer': ['ops.route_optimize', 'state.search'],
      'job_execution': ['state.upsert', 'comms.send_sms'],
      'invoicing_payment': ['billing.create_invoice', 'state.get'],
      'profit_analytics': ['analytics.log', 'state.search']
    };

    return toolMap[agentName] || [];
  }
}