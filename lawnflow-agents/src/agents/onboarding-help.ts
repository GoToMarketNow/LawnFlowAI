import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope } from '../types';
import { OnboardingStep } from './onboarding';
import OpenAI from 'openai';

/**
 * Help Request Result
 */
export interface HelpRequestResult {
  step: OnboardingStep;
  question: string;
  answer: string;
  suggestions: string[];
  related_docs?: string[];
  tokens_used: number;
  helpful?: boolean;
}

/**
 * OnboardingHelpAgent - AI-powered contextual assistance
 * 
 * Provides intelligent help during onboarding:
 * - Answers user questions about each step
 * - Suggests optimal configurations based on business type
 * - Explains why certain options are recommended
 * - Never blocks progress - always optional
 */
export class OnboardingHelpAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('onboarding_help', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const action = context.event.payload?.action || 'answer_question';
      const step = context.event.payload?.step as OnboardingStep;
      const question = context.event.payload?.question as string;
      const businessContext = context.event.payload?.business_context || {};

      switch (action) {
        case 'answer_question':
          return await this.answerQuestion(context, step, question, businessContext, startTime);
        
        case 'suggest_defaults':
          return await this.suggestDefaults(context, step, businessContext, startTime);
        
        case 'explain_option':
          return await this.explainOption(context, step, context.event.payload?.option, startTime);
        
        default:
          return this.createEnvelope(
            'error',
            `Unknown action: ${action}`,
            null,
            [],
            [{ code: 'UNKNOWN_ACTION', message: `Action ${action} not supported`, recoverable: false }],
            { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
          );
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.createEnvelope(
        'error',
        'Help agent failed',
        null,
        [],
        [{ 
          code: 'AGENT_ERROR', 
          message: error instanceof Error ? error.message : 'Unknown error', 
          recoverable: true 
        }],
        {
          estimated_tokens_in: 0,
          estimated_tokens_out: 0,
          tool_calls: 0,
          metadata: {
            execution_time_ms: executionTime,
            agent_version: this.version,
          }
        }
      );
    }
  }

  /**
   * Answer a user's question about an onboarding step
   */
  private async answerQuestion(
    context: AgentContext,
    step: OnboardingStep,
    question: string,
    businessContext: Record<string, any>,
    startTime: number
  ): Promise<Envelope> {
    if (!question || question.trim().length === 0) {
      return this.createEnvelope(
        'needs_input',
        'Question required',
        null,
        [this.createUserAsk('Please provide a question')],
        [],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    const systemPrompt = this.getSystemPrompt(step, businessContext);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Extract suggestions from answer
    const suggestions = this.extractSuggestions(answer);

    const result: HelpRequestResult = {
      step,
      question,
      answer,
      suggestions,
      tokens_used: tokensUsed,
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      'Provided contextual help',
      result,
      [],
      [],
      {
        estimated_tokens_in: completion.usage?.prompt_tokens || 200,
        estimated_tokens_out: completion.usage?.completion_tokens || 300,
        tool_calls: 1,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Suggest smart defaults for a step
   */
  private async suggestDefaults(
    context: AgentContext,
    step: OnboardingStep,
    businessContext: Record<string, any>,
    startTime: number
  ): Promise<Envelope> {
    const systemPrompt = `You are an expert lawn care business consultant helping new LawnFlow users set up their business profile.

Based on the business context provided, suggest optimal default values for the ${step} step.

Business Context:
- Customer Type: ${businessContext.customer_type || 'not specified'}
- Service Area: ${businessContext.service_area || 'not specified'}
- Business Size: ${businessContext.business_size || 'small'}
- Experience Level: ${businessContext.experience_level || 'beginner'}

Provide a JSON response with suggested defaults and reasoning:
{
  "suggestions": {
    "field_name": {
      "value": "suggested value",
      "reason": "why this is recommended"
    }
  },
  "confidence": "high" | "medium" | "low",
  "notes": "additional context"
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate smart defaults for the ${step} step` }
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    const suggestions = JSON.parse(rawResponse);
    const tokensUsed = completion.usage?.total_tokens || 0;

    const result = {
      step,
      business_context: businessContext,
      suggestions: suggestions.suggestions,
      confidence: suggestions.confidence,
      notes: suggestions.notes,
      tokens_used: tokensUsed,
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      'Generated smart defaults',
      result,
      [],
      [],
      {
        estimated_tokens_in: completion.usage?.prompt_tokens || 300,
        estimated_tokens_out: completion.usage?.completion_tokens || 500,
        tool_calls: 1,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Explain a specific option in detail
   */
  private async explainOption(
    context: AgentContext,
    step: OnboardingStep,
    option: string,
    startTime: number
  ): Promise<Envelope> {
    if (!option) {
      return this.createEnvelope(
        'needs_input',
        'Option required',
        null,
        [this.createUserAsk('Please specify which option to explain')],
        [],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    const systemPrompt = `You are a lawn care business consultant helping users understand their onboarding choices.

Step: ${step}
Option: ${option}

Explain this option in 2-3 sentences, covering:
1. What it means
2. When to use it
3. Pros and cons

Be concise and practical.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Explain the "${option}" option` }
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const explanation = completion.choices[0]?.message?.content || 'Explanation not available.';
    const tokensUsed = completion.usage?.total_tokens || 0;

    const result = {
      step,
      option,
      explanation,
      tokens_used: tokensUsed,
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      'Explained option',
      result,
      [],
      [],
      {
        estimated_tokens_in: completion.usage?.prompt_tokens || 150,
        estimated_tokens_out: completion.usage?.completion_tokens || 150,
        tool_calls: 1,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Get system prompt for a specific step
   */
  private getSystemPrompt(step: OnboardingStep, businessContext: Record<string, any>): string {
    const basePrompt = `You are an expert lawn care business consultant helping new LawnFlow users during onboarding.

Current Step: ${step}
Your role: Answer questions clearly and concisely, provide actionable advice, and help users make informed decisions.

Business Context:
${JSON.stringify(businessContext, null, 2)}

Guidelines:
- Be concise but thorough
- Use lawn care industry terminology appropriately
- Focus on practical, actionable advice
- Acknowledge when something is a judgment call
- Never overwhelm with too many options
`;

    const stepSpecificGuidance: Record<OnboardingStep, string> = {
      welcome: 'Help users understand what to expect and set realistic expectations for onboarding time.',
      business_basics: 'Guide users on defining their service area effectively and choosing the right customer type.',
      services: 'Help users select appropriate service categories without overwhelming them. Emphasize starting simple and expanding later.',
      pricing: 'Explain different pricing models and when each is appropriate. Help users understand their market.',
      crews: 'Guide on crew structure basics. Emphasize starting lean and scaling up.',
      get_paid: 'Explain payment methods, banking, and why test payments matter. Build confidence in the payment process.',
      approvals: 'Help users understand approval workflows and when to require human oversight.',
      power_ups: 'Explain optional features without pressuring adoption. Focus on what they might need soon vs. later.',
      complete: 'Celebrate completion and orient users to next steps.',
    };

    return basePrompt + '\n\n' + (stepSpecificGuidance[step] || 'Provide helpful guidance for this step.');
  }

  /**
   * Extract actionable suggestions from an AI response
   */
  private extractSuggestions(answer: string): string[] {
    const suggestions: string[] = [];
    
    // Look for bullet points or numbered lists
    const bulletPattern = /^[\s]*[•\-\*]\s+(.+)$/gm;
    const numberPattern = /^[\s]*\d+\.\s+(.+)$/gm;
    
    let match;
    while ((match = bulletPattern.exec(answer)) !== null) {
      suggestions.push(match[1].trim());
    }
    
    while ((match = numberPattern.exec(answer)) !== null) {
      suggestions.push(match[1].trim());
    }
    
    // If no structured suggestions found, look for sentences starting with "Consider" or "Try"
    if (suggestions.length === 0) {
      const actionPattern = /(?:Consider|Try|You could|You might|I recommend)\s+([^.!?]+)/gi;
      while ((match = actionPattern.exec(answer)) !== null) {
        suggestions.push(match[1].trim());
      }
    }
    
    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }
}
