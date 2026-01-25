import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, CustomerServiceResult } from '../types';
import OpenAI from 'openai';

export class CustomerServiceAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('customer_service', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const customerId = context.event.payload?.customer_id;
      const issue = context.event.payload?.issue;
      const priority = context.event.payload?.priority || 'medium';

      if (!customerId) {
        return this.createEnvelope(
          'needs_input',
          'Missing customer ID for service request',
          null,
          [this.createUserAsk('Please provide customer information')]
        );
      }

      // Assess the customer service request
      const assessment = await this.assessServiceRequest(customerId, issue, context);

      // Generate service response
      const response = await this.generateServiceResponse(assessment, context);

      // Determine resolution path
      const resolution = this.determineResolutionPath(assessment, priority, context);

      const result: CustomerServiceResult = {
        customer_id: customerId,
        service_request: issue,
        priority_level: priority,
        assessment: assessment,
        response_plan: response,
        resolution_path: resolution,
        estimated_resolution_time: resolution.estimated_time,
        escalation_required: resolution.escalation_needed
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (resolution.escalation_needed) {
        nextActions.push(this.createHandoff('manager_escalation', {
          customer_id: customerId,
          issue: issue,
          priority: priority,
          assessment: assessment
        }));
      } else {
        nextActions.push(this.createHandoff('customer_notification', {
          customer_id: customerId,
          message: response.message,
          type: 'service_response'
        }));
      }

      return this.createEnvelope(
        'ok',
        `Customer service request processed for ${customerId}`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 250,
          estimated_tokens_out: 350,
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
        'Customer service processing failed',
        null,
        [],
        [{ code: 'SERVICE_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async assessServiceRequest(customerId: string, issue: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are assessing customer service requests for a lawn care business.

Evaluate the request considering:
- Issue type and severity
- Customer history and value
- Impact on business operations
- Resolution complexity
- Time sensitivity
- Required resources

Provide a comprehensive assessment with priority recommendations.`;

    const userPrompt = `Assess service request:
Customer ID: ${customerId}
Issue: ${JSON.stringify(issue)}
Customer Profile: ${JSON.stringify(await this.getCustomerProfile(customerId, context))}
Business Policies: ${JSON.stringify(context.business_config.service_policies)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600,
      temperature: 0.1
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async getCustomerProfile(customerId: string, context: AgentContext): Promise<any> {
    // Mock customer profile
    return {
      lifetime_value: 3200,
      total_jobs: 12,
      average_rating: 4.9,
      preferred_contact: 'phone',
      vip_status: true,
      last_service: '2024-01-08'
    };
  }

  private async generateServiceResponse(assessment: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are generating customer service responses for a lawn care business.

Create responses that are:
- Empathetic and professional
- Clear about next steps
- Realistic about timelines
- Consistent with business policies
- Focused on resolution

Tailor the response to the assessment findings and customer profile.`;

    const userPrompt = `Generate service response:
Assessment: ${JSON.stringify(assessment)}
Business Info: ${JSON.stringify(context.business_config.business_info)}
Response Templates: ${JSON.stringify(context.business_config.response_templates)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private determineResolutionPath(assessment: any, priority: string, context: AgentContext): any {
    const escalationThresholds = context.business_config.escalation_thresholds || {
      high: { vip_only: false, complex_issues: true },
      medium: { vip_only: true, complex_issues: false }
    };

    const needsEscalation = (
      priority === 'high' ||
      (priority === 'medium' && assessment.complexity === 'high') ||
      assessment.customer_value === 'vip'
    );

    return {
      escalation_needed: needsEscalation,
      estimated_time: needsEscalation ? '2-4 hours' : '24-48 hours',
      resolution_type: needsEscalation ? 'manager_review' : 'standard_resolution',
      required_resources: assessment.required_resources || []
    };
  }
}