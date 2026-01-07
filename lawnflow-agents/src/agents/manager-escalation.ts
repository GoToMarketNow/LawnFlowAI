import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, ManagerEscalationResult } from '../types';
import OpenAI from 'openai';

export class ManagerEscalationAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('manager_escalation', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const customerId = context.event.payload?.customer_id;
      const issue = context.event.payload?.issue;
      const priority = context.event.payload?.priority;
      const assessment = context.event.payload?.assessment;

      if (!customerId || !issue) {
        return this.createEnvelope(
          'needs_input',
          'Missing customer ID or issue for escalation',
          null,
          [this.createUserAsk('Please provide customer and issue details')]
        );
      }

      // Prepare escalation package
      const escalationPackage = await this.prepareEscalationPackage(customerId, issue, assessment, context);

      // Determine appropriate manager
      const manager = this.determineEscalationManager(escalationPackage, context);

      // Create escalation notification
      const notification = await this.createEscalationNotification(escalationPackage, manager, context);

      // Set up escalation tracking
      const tracking = this.setupEscalationTracking(escalationPackage, manager, context);

      const result: ManagerEscalationResult = {
        customer_id: customerId,
        escalation_id: tracking.escalation_id,
        issue_summary: escalationPackage.summary,
        assigned_manager: manager,
        priority_level: priority,
        escalation_package: escalationPackage,
        notification_sent: notification.sent,
        expected_response_time: tracking.expected_response,
        resolution_deadline: tracking.deadline
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [
        this.createHandoff('escalation_monitor', {
          escalation_id: tracking.escalation_id,
          manager_id: manager.id,
          deadline: tracking.deadline
        })
      ];

      return this.createEnvelope(
        'ok',
        `Issue escalated to ${manager.name} for customer ${customerId}`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 300,
          estimated_tokens_out: 400,
          tool_calls: 1,
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
        'Manager escalation failed',
        null,
        [],
        [{ code: 'ESCALATION_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async prepareEscalationPackage(customerId: string, issue: any, assessment: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are preparing escalation packages for management review in a lawn care business.

Create comprehensive packages that include:
- Issue summary and timeline
- Customer impact assessment
- Business impact analysis
- Previous resolution attempts
- Recommended actions
- Required resources and authority
- Risk assessment

Ensure the package enables quick, informed decision-making by management.`;

    const userPrompt = `Prepare escalation package:
Customer ID: ${customerId}
Issue: ${JSON.stringify(issue)}
Assessment: ${JSON.stringify(assessment)}
Customer History: ${JSON.stringify(await this.getCustomerHistory(customerId, context))}
Business Context: ${JSON.stringify(context.business_config.escalation_policies)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.1
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async getCustomerHistory(customerId: string, context: AgentContext): Promise<any> {
    // Mock customer history for escalation
    return {
      total_value: 4500,
      issue_history: [
        { date: '2023-12-01', type: 'service_quality', resolution: 'satisfied' },
        { date: '2024-01-15', type: 'scheduling', resolution: 'resolved' }
      ],
      vip_status: true,
      communication_preference: 'direct_contact'
    };
  }

  private determineEscalationManager(escalationPackage: any, context: AgentContext): any {
    const managers = context.business_config.managers || [
      { id: 'mgr-001', name: 'Sarah Johnson', role: 'Operations Manager', specialties: ['customer_service', 'quality'] },
      { id: 'mgr-002', name: 'Mike Chen', role: 'Service Manager', specialties: ['scheduling', 'crew_management'] },
      { id: 'mgr-003', name: 'Lisa Rodriguez', role: 'Customer Relations Manager', specialties: ['escalations', 'vip_clients'] }
    ];

    // Match manager based on issue type and customer value
    const bestMatch = managers.find(manager =>
      manager.specialties.some((specialty: string) => escalationPackage.issue_category === specialty)
    ) || managers[0];

    return bestMatch;
  }

  private async createEscalationNotification(escalationPackage: any, manager: any, context: AgentContext): Promise<any> {
    // In a real implementation, this would send actual notifications
    return {
      sent: true,
      channels: ['email', 'dashboard'],
      sent_at: new Date().toISOString(),
      priority: escalationPackage.priority
    };
  }

  private setupEscalationTracking(escalationPackage: any, manager: any, context: AgentContext): any {
    const escalationId = `ESC-${Date.now()}`;
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + escalationPackage.response_time_hours);

    return {
      escalation_id: escalationId,
      expected_response: `${escalationPackage.response_time_hours} hours`,
      deadline: deadline.toISOString(),
      tracking_active: true
    };
  }
}