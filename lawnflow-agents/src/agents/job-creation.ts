import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, JobCreationResult } from '../types';
import OpenAI from 'openai';

export class JobCreationAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('job_creation', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const schedule = context.event.payload?.schedule;
      const quotes = context.event.payload?.quotes || [];
      const customerId = context.event.payload?.customer_id;

      if (!schedule || !customerId) {
        return this.createEnvelope(
          'needs_input',
          'Missing schedule or customer ID for job creation',
          null,
          [this.createUserAsk('Please provide schedule and customer information')]
        );
      }

      // Create job record
      const job = await this.createJobRecord(schedule, quotes, customerId, context);

      // Generate work instructions
      const instructions = await this.generateWorkInstructions(job, context);

      // Set up notifications
      const notifications = this.setupNotifications(job, context);

      const result: JobCreationResult = {
        job_id: job.id,
        job_details: job,
        work_instructions: instructions,
        notifications_sent: notifications,
        status: 'scheduled'
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [
        this.createHandoff('crew_notification', {
          job_id: job.id,
          crew_id: job.assigned_crew,
          instructions: instructions
        })
      ];

      return this.createEnvelope(
        'ok',
        `Created job ${job.id} for ${job.customer_name}`,
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
        'Job creation failed',
        null,
        [],
        [{ code: 'JOB_CREATION_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async createJobRecord(schedule: any, quotes: any[], customerId: string, context: AgentContext): Promise<any> {
    const systemPrompt = `You are a job creation agent for a lawn care business. Create a comprehensive job record based on the schedule and quotes provided.

Business Rules:
- Job numbering format: JOB-{YYYY}-{sequential}
- Status workflow: scheduled -> assigned -> in_progress -> completed
- Required fields: customer info, service details, pricing, scheduling, crew assignment

Return a complete job object with all necessary details.`;

    const userPrompt = `Create job record for:
Schedule: ${JSON.stringify(schedule)}
Quotes: ${JSON.stringify(quotes)}
Customer ID: ${customerId}
Business Config: ${JSON.stringify(context.business_config)}`;

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

    const jobData = JSON.parse(rawResponse);

    // Generate job ID
    const jobId = `JOB-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    return {
      id: jobId,
      ...jobData,
      created_at: new Date().toISOString(),
      status: 'scheduled'
    };
  }

  private async generateWorkInstructions(job: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are generating detailed work instructions for lawn care crew members.

Instructions should include:
- Service-specific procedures
- Safety requirements
- Quality standards
- Equipment needed
- Time estimates
- Customer communication guidelines

Use the business service definitions and quality standards.`;

    const userPrompt = `Generate work instructions for job: ${JSON.stringify(job)}
Service Standards: ${JSON.stringify(context.business_config.service_standards)}
Equipment: ${JSON.stringify(context.business_config.equipment)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private setupNotifications(job: any, context: AgentContext): any[] {
    // In a real implementation, this would integrate with notification services
    return [
      {
        type: 'crew_assignment',
        recipient: job.assigned_crew,
        message: `New job assigned: ${job.id} - ${job.customer_name}`,
        sent: true
      },
      {
        type: 'customer_confirmation',
        recipient: job.customer_id,
        message: `Your service is scheduled for ${job.scheduled_date}`,
        sent: true
      }
    ];
  }
}