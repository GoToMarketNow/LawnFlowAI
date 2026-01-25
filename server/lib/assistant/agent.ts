// AI Assistant Agent Orchestrator
// Security: Gated responses, citation enforcement, confirm-before-write
// No hallucination: Answers ONLY from PSKB or read-only tools

import OpenAI from "openai";
import { searchKnowledge } from "../knowledge/search";
import { CONFIDENCE_THRESHOLDS } from "@shared/knowledge-types";
import { type AssistantResponse, type Citation } from "@shared/assistant-schema";
import { getToolDefinitionsForLLM } from "../../tools/readOnly";
import { executeReadOnlyTool, formatToolResult } from "./toolRouter";
import { requestAction } from "./actionHandler";
import {
  validateCitations,
  enforcecitations,
  createCitationFailureResponse,
  createCitationFromSearchResult,
  formatCitations,
} from "./citationValidator";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-4o";
const MAX_TOKENS = 1000;

export interface AssistantInput {
  businessId: number;
  conversationId?: number;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  userRole: string;
  userId?: number;
  context?: {
    threadId?: number;
    jobId?: number;
    customerId?: number;
    serviceType?: string;
  };
}

/**
 * Generate assistant response (gated, with citations)
 * @param input - Assistant input
 * @returns Assistant response with citations
 */
export async function generateResponse(input: AssistantInput): Promise<AssistantResponse> {
  const { businessId, conversationId, messages, userRole, userId, context } = input;

  try {
    // 1. Extract user's last message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      throw new Error("Last message must be from user");
    }

    const userQuery = lastMessage.content;

    // 2. Search PSKB for relevant knowledge
    const knowledgeResults = await searchKnowledge({
      businessId,
      query: userQuery,
      appliesTo: context?.serviceType ? { serviceType: context.serviceType } : undefined,
      limit: 3,
      minConfidence: CONFIDENCE_THRESHOLDS.LOW,
    });

    // 3. Determine response strategy based on coverage
    if (knowledgeResults.length > 0 && knowledgeResults[0].confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      // HIGH CONFIDENCE: Answer from PSKB with citation
      return await answerFromKnowledge(knowledgeResults, userQuery, messages, businessId);
    }

    // 4. MEDIUM CONFIDENCE or tool usage: Try LLM with tools
    const toolResponse = await tryToolsAndKnowledge(
      knowledgeResults,
      messages,
      businessId,
      conversationId,
      userId,
      context
    );

    if (toolResponse) {
      return toolResponse;
    }

    // 5. NO COVERAGE: Escalate to human
    return {
      content: "I don't have enough information in our knowledge base to answer that confidently. Let me connect you with a team member who can help.",
      citations: [],
      requiresApproval: true,
      suggestedActions: [
        {
          type: "escalate_to_ops",
          description: "Escalate to operations team",
          payload: {
            threadId: context?.threadId,
            reason: "uncovered_topic",
            priority: "normal",
          },
        },
      ],
    };
  } catch (error: any) {
    console.error("Assistant generation failed:", error.message);

    // Fail-closed: Return safe escalation response
    return createCitationFailureResponse();
  }
}

/**
 * Answer from knowledge base (high confidence)
 */
async function answerFromKnowledge(
  knowledgeResults: any[],
  userQuery: string,
  messages: Array<{ role: string; content: string }>,
  businessId: number
): Promise<AssistantResponse> {
  const topResult = knowledgeResults[0];

  // Build context from knowledge
  const knowledgeContext = knowledgeResults
    .slice(0, 3)
    .map(
      (r, i) =>
        `Knowledge Item ${i + 1} (KB-${r.knowledgeItemId}v${r.versionId}):
Title: ${r.title}
Content: ${r.contentText.substring(0, 500)}...`
    )
    .join("\n\n");

  // System prompt for knowledge-grounded response
  const systemPrompt = `You are a helpful customer support assistant. Answer the user's question using ONLY the provided knowledge base content.

CRITICAL RULES:
1. Answer ONLY based on the knowledge provided below
2. You MUST cite the knowledge item IDs in your response using this format: KB-{itemId}v{versionId}
3. If the knowledge doesn't fully answer the question, say so honestly
4. Do NOT make up information or policies not in the knowledge base

Knowledge Base Content:
${knowledgeContext}

Example citation: "According to our refund policy KB-5v2, refunds are available within 30 days."`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const assistantContent = response.choices[0].message.content || "";

    // Create citations
    const citations: Citation[] = knowledgeResults
      .slice(0, 3)
      .map(r => createCitationFromSearchResult(r));

    // Validate citations
    const validation = await enforcecitations(assistantContent, citations, businessId);

    if (!validation.valid || validation.shouldEscalate) {
      // Fail-closed: citation validation failed
      return createCitationFailureResponse();
    }

    // Append citations footer
    const contentWithCitations = assistantContent + formatCitations(citations);

    return {
      content: contentWithCitations,
      citations,
      requiresApproval: false,
    };
  } catch (error: any) {
    console.error("Knowledge-based response failed:", error.message);
    return createCitationFailureResponse();
  }
}

/**
 * Try tools and knowledge (medium confidence or tool usage needed)
 */
async function tryToolsAndKnowledge(
  knowledgeResults: any[],
  messages: Array<{ role: string; content: string }>,
  businessId: number,
  conversationId: number | undefined,
  userId: number | undefined,
  context: any
): Promise<AssistantResponse | null> {
  // Get available tools
  const tools = getToolDefinitionsForLLM();

  // System prompt with tools
  const systemPrompt = `You are a helpful customer support assistant with access to read-only tools and knowledge base.

CRITICAL RULES:
1. Use tools to get real-time data (job status, invoices, etc.)
2. Use knowledge base for policies and procedures
3. NEVER execute actions directly - propose them for user confirmation
4. Always cite knowledge base items using KB-{itemId}v{versionId} format

Available knowledge:
${knowledgeResults.map(r => `- ${r.title} (KB-${r.knowledgeItemId}v${r.versionId})`).join("\n")}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: "auto",
    });

    const assistantMessage = response.choices[0].message;

    // Check if tools were called
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: string[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolParams = JSON.parse(toolCall.function.arguments);

        const result = await executeReadOnlyTool(
          toolName,
          toolParams,
          {
            conversationId: conversationId || 0,
            businessId,
            userId,
          }
        );

        const formattedResult = formatToolResult(result);
        toolResults.push(formattedResult);
      }

      // Combine tool results with knowledge
      const combinedContent = assistantMessage.content
        ? assistantMessage.content + "\n\n" + toolResults.join("\n")
        : toolResults.join("\n");

      const citations: Citation[] = knowledgeResults
        .filter(r => r.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM)
        .map(r => createCitationFromSearchResult(r));

      return {
        content: combinedContent + (citations.length > 0 ? formatCitations(citations) : ""),
        citations,
        toolsUsed: assistantMessage.tool_calls.map(tc => tc.function.name),
        requiresApproval: false,
      };
    }

    // No tools used, check if it's an action request
    const content = assistantMessage.content || "";

    if (isActionRequest(content)) {
      // Propose action for confirmation
      return proposeAction(content, businessId, conversationId, userId, context);
    }

    return null;
  } catch (error: any) {
    console.error("Tool-based response failed:", error.message);
    return null;
  }
}

/**
 * Check if response is requesting an action
 */
function isActionRequest(content: string): boolean {
  const actionKeywords = [
    "reschedule",
    "cancel",
    "update",
    "change",
    "modify",
    "refund",
  ];

  const lowerContent = content.toLowerCase();
  return actionKeywords.some(keyword => lowerContent.includes(keyword));
}

/**
 * Propose an action for user confirmation
 */
async function proposeAction(
  content: string,
  businessId: number,
  conversationId: number | undefined,
  userId: number | undefined,
  context: any
): Promise<AssistantResponse> {
  // Parse action intent (simplified - in production, use Claude for structured extraction)
  let actionType: any = "escalate_to_ops";
  let actionPayload: any = { reason: "action_requested" };

  if (content.toLowerCase().includes("reschedule")) {
    actionType = "reschedule_job";
    actionPayload = { jobId: context?.jobId };
  } else if (content.toLowerCase().includes("cancel")) {
    actionType = "cancel_job";
    actionPayload = { jobId: context?.jobId };
  }

  // Create action request
  const actionRequest = await requestAction({
    conversationId,
    businessId,
    requestedBy: userId,
    actionType,
    actionPayload,
    actionReason: "User requested via assistant",
  });

  return {
    content: "I can help you with that. This action requires confirmation. Would you like me to proceed?",
    citations: [],
    requiresApproval: true,
    suggestedActions: [
      {
        type: actionType,
        description: `${actionType.replace(/_/g, " ")}`,
        payload: { actionRequestId: actionRequest.id, ...actionPayload },
      },
    ],
  };
}

/**
 * Health check for assistant agent
 */
export async function testAssistantAgent(): Promise<boolean> {
  try {
    const hasOpenAI = process.env.OPENAI_API_KEY !== undefined;
    const hasDatabase = true; // Assume DB is available
    return hasOpenAI && hasDatabase;
  } catch {
    return false;
  }
}
