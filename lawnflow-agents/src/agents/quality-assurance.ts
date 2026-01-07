import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, QualityAssuranceResult } from '../types';
import OpenAI from 'openai';

export class QualityAssuranceAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('quality_assurance', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const jobId = context.event.payload?.job_id;
      const finalCheck = context.event.payload?.final_check || false;

      if (!jobId) {
        return this.createEnvelope(
          'needs_input',
          'Missing job ID for quality assurance',
          null,
          [this.createUserAsk('Please provide job ID for quality check')]
        );
      }

      // Get job completion data
      const jobData = await this.getJobCompletionData(jobId, context);

      // Perform quality assessment
      const assessment = await this.performQualityAssessment(jobData, context);

      // Generate quality report
      const report = this.generateQualityReport(assessment, context);

      // Determine if rework is needed
      const reworkRequired = this.checkReworkRequired(assessment, context.business_config.quality_standards);

      const result: QualityAssuranceResult = {
        job_id: jobId,
        quality_score: assessment.overall_score,
        assessment_details: assessment.details,
        quality_report: report,
        rework_required: reworkRequired,
        rework_items: reworkRequired ? assessment.failing_items : [],
        approved: !reworkRequired
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (reworkRequired) {
        nextActions.push(this.createHandoff('crew_support', {
          job_id: jobId,
          rework_items: result.rework_items,
          priority: 'high'
        }));
      } else {
        nextActions.push(this.createHandoff('completion_finalization', {
          job_id: jobId,
          quality_report: report
        }));
      }

      return this.createEnvelope(
        'ok',
        `Quality assessment complete - Score: ${assessment.overall_score}/100`,
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
        'Quality assurance failed',
        null,
        [],
        [{ code: 'QA_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async getJobCompletionData(jobId: string, context: AgentContext): Promise<any> {
    // In a real implementation, this would query job completion records
    // For now, return mock completion data
    return {
      job_id: jobId,
      completed_at: new Date().toISOString(),
      crew_notes: 'Service completed as requested. Lawn mowed, edges trimmed.',
      photos_taken: true,
      customer_present: false,
      weather_conditions: 'Sunny, 72°F',
      equipment_used: ['riding_mower', 'string_trimmer', 'blower']
    };
  }

  private async performQualityAssessment(jobData: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are performing quality assurance for lawn care services.

Evaluate the job based on:
- Service completion standards
- Work quality criteria
- Safety compliance
- Customer satisfaction indicators
- Equipment usage
- Documentation completeness

Provide detailed assessment with scores and specific feedback.`;

    const userPrompt = `Assess job quality:
Job Data: ${JSON.stringify(jobData)}
Quality Standards: ${JSON.stringify(context.business_config.quality_standards)}
Service Requirements: ${JSON.stringify(context.business_config.service_requirements)}`;

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

  private generateQualityReport(assessment: any, context: AgentContext): any {
    return {
      job_id: assessment.job_id,
      assessment_date: new Date().toISOString(),
      overall_score: assessment.overall_score,
      categories: assessment.details,
      inspector: 'Quality Assurance Agent',
      standards_version: context.business_config.quality_standards.version,
      recommendations: assessment.recommendations || []
    };
  }

  private checkReworkRequired(assessment: any, standards: any): boolean {
    const minimumScore = standards.minimum_passing_score || 85;
    return assessment.overall_score < minimumScore || assessment.failing_items?.length > 0;
  }
}