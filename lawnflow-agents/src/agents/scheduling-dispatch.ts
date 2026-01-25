import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, SchedulingResult } from '../types';
import OpenAI from 'openai';

export class SchedulingDispatchAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('scheduling_dispatch', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const quotes = context.event.payload?.quotes || [];
      const customerId = context.event.payload?.customer_id;

      if (!quotes.length || !customerId) {
        return this.createEnvelope(
          'needs_input',
          'Missing quotes or customer ID for scheduling',
          null,
          [this.createUserAsk('Please provide quotes and customer information')]
        );
      }

      // Generate scheduling options
      const scheduling = await this.generateSchedulingOptions(quotes, context);

      // Check crew availability
      const availability = await this.checkCrewAvailability(scheduling, context);

      // Create dispatch plan
      const dispatchPlan = this.createDispatchPlan(scheduling, availability, context);

      const result: SchedulingResult = {
        proposed_slots: [], // Will be populated from dispatchPlan
        recommended_slot: dispatchPlan.recommended ? {
          date: dispatchPlan.recommended.date,
          start_time: dispatchPlan.recommended.start_time || '09:00',
          end_time: dispatchPlan.recommended.end_time || '17:00',
          crew_id: dispatchPlan.recommended.assigned_crew || ''
        } : undefined,
        schedule_options: dispatchPlan.options,
        recommended_schedule: dispatchPlan.recommended,
        crew_assignments: dispatchPlan.assignments,
        estimated_duration: dispatchPlan.totalDuration,
        weather_considerations: dispatchPlan.weatherNotes,
        notes_for_customer: 'Please confirm your preferred schedule option',
        requires_approval: false
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if ((result.schedule_options || []).length > 0) {
        nextActions.push(this.createUserAsk('Please select a preferred schedule option'));
      } else {
        nextActions.push(this.createHandoff('job_creation', {
          customer_id: customerId,
          schedule: result.recommended_schedule,
          quotes: quotes
        }));
      }

      return this.createEnvelope(
        'ok',
        `Generated ${(result.schedule_options || []).length} scheduling options`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 300,
          estimated_tokens_out: 400,
          tool_calls: 2,
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
        'Scheduling dispatch failed',
        null,
        [],
        [{ code: 'SCHEDULING_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async generateSchedulingOptions(quotes: any[], context: AgentContext): Promise<any> {
    const systemPrompt = `You are a scheduling agent for a lawn care business. Generate optimal scheduling options based on:

Business Rules:
- Operating hours: ${JSON.stringify(context.business_config.operating_hours)}
- Service durations: ${JSON.stringify(context.business_config.service_durations)}
- Crew capacities: ${JSON.stringify(context.business_config.crew_capacities)}
- Weather constraints: ${JSON.stringify(context.business_config.weather_constraints)}

Return JSON with scheduling options considering service dependencies and crew availability.`;

    const userPrompt = `Generate scheduling options for these services: ${JSON.stringify(quotes)}
Property location: ${JSON.stringify(context.event.payload?.property_details?.location || {})}
Customer preferences: ${JSON.stringify(context.event.payload?.preferences || {})}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1200,
      temperature: 0.2
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async checkCrewAvailability(scheduling: any, context: AgentContext): Promise<any> {
    // In a real implementation, this would query the crew scheduling system
    // For now, return mock availability data
    return {
      available_crews: (context.business_config.crews || []).map((crew: any) => ({
        id: crew.id,
        name: crew.name,
        skills: crew.skills,
        availability: ['2024-01-15', '2024-01-16', '2024-01-17'] // Mock dates
      })),
      constraints: []
    };
  }

  private createDispatchPlan(scheduling: any, availability: any, context: AgentContext): any {
    // Match scheduling options with available crews
    const options = scheduling.options.map((option: any) => {
      const availableCrew = availability.available_crews.find((crew: any) =>
        crew.skills.some((skill: string) => option.required_skills.includes(skill))
      );

      return {
        ...option,
        assigned_crew: availableCrew ? availableCrew.id : null,
        crew_name: availableCrew ? availableCrew.name : 'TBD'
      };
    });

    const recommended = options.find((opt: any) => opt.is_recommended) || options[0];

    return {
      options,
      recommended,
      assignments: options.filter((opt: any) => opt.assigned_crew).map((opt: any) => ({
        service: opt.service_type,
        crew_id: opt.assigned_crew,
        crew_name: opt.crew_name,
        scheduled_date: opt.date
      })),
      totalDuration: options.reduce((total: number, opt: any) => total + opt.duration_hours, 0),
      weatherNotes: ['Check weather forecast 24 hours before service']
    };
  }
}