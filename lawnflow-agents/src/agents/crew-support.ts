import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, CrewSupportResult } from '../types';
import OpenAI from 'openai';

export class CrewSupportAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('crew_support', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const jobId = context.event.payload?.job_id;
      const issues = context.event.payload?.issues || [];
      const reworkItems = context.event.payload?.rework_items || [];
      const supportType = context.event.payload?.support_type || 'general';

      if (!jobId) {
        return this.createEnvelope(
          'needs_input',
          'Missing job ID for crew support',
          null,
          [this.createUserAsk('Please provide job ID and support details')]
        );
      }

      // Assess support needs
      const assessment = await this.assessSupportNeeds(jobId, issues, reworkItems, context);

      // Generate support plan
      const supportPlan = await this.generateSupportPlan(assessment, supportType, context);

      // Dispatch support resources
      const dispatch = await this.dispatchSupport(supportPlan, context);

      const result: CrewSupportResult = {
        job_id: jobId,
        support_type: supportType,
        issues_identified: issues,
        rework_required: reworkItems,
        support_plan: supportPlan,
        resources_dispatched: dispatch.resources,
        estimated_resolution_time: supportPlan.estimated_time,
        priority_level: assessment.priority
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (dispatch.resources.length > 0) {
        nextActions.push(this.createHandoff('job_monitoring', {
          job_id: jobId,
          support_active: true,
          expected_resolution: supportPlan.estimated_time
        }));
      }

      return this.createEnvelope(
        'ok',
        `Crew support dispatched for job ${jobId} - ${supportType}`,
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
        'Crew support failed',
        null,
        [],
        [{ code: 'SUPPORT_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async assessSupportNeeds(jobId: string, issues: any[], reworkItems: any[], context: AgentContext): Promise<any> {
    const systemPrompt = `You are assessing crew support needs for lawn care operations.

Evaluate the situation considering:
- Issue severity and impact
- Crew experience level
- Equipment availability
- Time constraints
- Safety considerations
- Cost implications

Determine priority level and required support resources.`;

    const userPrompt = `Assess support needs:
Job ID: ${jobId}
Issues: ${JSON.stringify(issues)}
Rework Items: ${JSON.stringify(reworkItems)}
Business Context: ${JSON.stringify(context.business_config.crew_support)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async generateSupportPlan(assessment: any, supportType: string, context: AgentContext): Promise<any> {
    const systemPrompt = `You are creating support plans for lawn care crews.

Support plan should include:
- Specific assistance actions
- Required resources (personnel, equipment, materials)
- Timeline and milestones
- Communication protocols
- Quality checkpoints
- Cost considerations

Tailor the plan to the support type and assessment findings.`;

    const userPrompt = `Generate support plan:
Assessment: ${JSON.stringify(assessment)}
Support Type: ${supportType}
Available Resources: ${JSON.stringify(context.business_config.support_resources)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 700,
      temperature: 0.2
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async dispatchSupport(supportPlan: any, context: AgentContext): Promise<any> {
    // In a real implementation, this would coordinate with crew scheduling and resource management
    const resources = supportPlan.required_resources.map((resource: any) => ({
      ...resource,
      dispatched: true,
      eta: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes ETA
    }));

    return {
      resources,
      coordination_complete: true,
      dispatch_time: new Date().toISOString()
    };
  }
}