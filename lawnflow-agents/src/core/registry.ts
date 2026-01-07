import { BaseAgent, AgentRegistry, AgentFactory } from './interfaces';
import { OrchestratorAgent } from './orchestrator';
// Import agent implementations
import { InboundIntakeAgent } from '../agents/inbound-intake';
import { PricingProfitAgent } from '../agents/pricing-profit';
import { SchedulingDispatchAgent } from '../agents/scheduling-dispatch';
import { JobCreationAgent } from '../agents/job-creation';
import { CrewNotificationAgent } from '../agents/crew-notification';
import { JobMonitoringAgent } from '../agents/job-monitoring';
import { QualityAssuranceAgent } from '../agents/quality-assurance';
import { CompletionFinalizationAgent } from '../agents/completion-finalization';
import { CustomerNotificationAgent } from '../agents/customer-notification';
import { CrewSupportAgent } from '../agents/crew-support';
import { FollowUpSchedulerAgent } from '../agents/follow-up-scheduler';
import { CustomerFollowUpAgent } from '../agents/customer-follow-up';
import { CustomerServiceAgent } from '../agents/customer-service';
import { ManagerEscalationAgent } from '../agents/manager-escalation';
import { EscalationMonitorAgent } from '../agents/escalation-monitor';

export class UnifiedAgentRegistry implements AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private capabilities: Map<string, string[]> = new Map();

  constructor() {
    this.initializeCoreAgents();
  }

  register(agent: BaseAgent): void {
    this.agents.set(agent.agentName, agent);
    // Register capabilities (this would be more sophisticated in practice)
    this.capabilities.set(agent.agentName, [agent.agentName.replace('_', '-')]);
  }

  getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  getAgentByCapability(capability: string): BaseAgent[] {
    return Array.from(this.agents.values()).filter(agent => {
      const agentCapabilities = this.capabilities.get(agent.agentName) || [];
      return agentCapabilities.includes(capability);
    });
  }

  private initializeCoreAgents(): void {
    // Core agents
    this.register(new OrchestratorAgent());
    this.register(new InboundIntakeAgent());
    this.register(new PricingProfitAgent());
    this.register(new SchedulingDispatchAgent());
    this.register(new JobCreationAgent());
    this.register(new CrewNotificationAgent());
    this.register(new JobMonitoringAgent());
    this.register(new QualityAssuranceAgent());
    this.register(new CompletionFinalizationAgent());
    this.register(new CustomerNotificationAgent());
    this.register(new CrewSupportAgent());
    this.register(new FollowUpSchedulerAgent());
    this.register(new CustomerFollowUpAgent());
    this.register(new CustomerServiceAgent());
    this.register(new ManagerEscalationAgent());
    this.register(new EscalationMonitorAgent());
  }
}

export class UnifiedAgentFactory implements AgentFactory {
  createAgent(type: string, config?: any): BaseAgent {
    switch (type) {
      case 'orchestrator':
        return new OrchestratorAgent();
      case 'inbound_intake':
        return new InboundIntakeAgent();
      case 'pricing_profit':
        return new PricingProfitAgent();
      case 'scheduling_dispatch':
        return new SchedulingDispatchAgent();
      case 'job_creation':
        return new JobCreationAgent();
      case 'crew_notification':
        return new CrewNotificationAgent();
      case 'job_monitoring':
        return new JobMonitoringAgent();
      case 'quality_assurance':
        return new QualityAssuranceAgent();
      case 'completion_finalization':
        return new CompletionFinalizationAgent();
      case 'customer_notification':
        return new CustomerNotificationAgent();
      case 'crew_support':
        return new CrewSupportAgent();
      case 'follow_up_scheduler':
        return new FollowUpSchedulerAgent();
      case 'customer_follow_up':
        return new CustomerFollowUpAgent();
      case 'customer_service':
        return new CustomerServiceAgent();
      case 'manager_escalation':
        return new ManagerEscalationAgent();
      case 'escalation_monitor':
        return new EscalationMonitorAgent();
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }
}

// Singleton instances
export const agentRegistry = new UnifiedAgentRegistry();
export const agentFactory = new UnifiedAgentFactory();