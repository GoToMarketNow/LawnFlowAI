import type { MemoryType } from "@shared/schema";
import crypto from "crypto";

export interface InteractionMemoryInput {
  customerName: string;
  messageThread?: string[];
  serviceType?: string;
  channel?: string;
  sentiment?: "positive" | "neutral" | "negative";
  keyPoints?: string[];
}

export interface PreferenceMemoryInput {
  customerName: string;
  communicationStyle?: string;
  preferredDays?: string[];
  preferredTimeWindow?: string;
  gateCode?: string;
  petInfo?: string;
  constraints?: string[];
  notes?: string;
}

export interface OutcomeMemoryInput {
  customerName: string;
  serviceType?: string;
  outcome: "accepted" | "declined" | "question" | "modify" | "completed" | "cancelled" | "rescheduled";
  quoteLow?: number;
  quoteHigh?: number;
  npsScore?: number;
  feedback?: string;
}

export interface SummaryMemoryInput {
  customerName: string;
  serviceTypes: string[];
  address?: string;
  stage?: string;
  interactionCount?: number;
  keyFacts?: string[];
}

function sanitize(text: string | undefined): string {
  if (!text) return "";
  return text.trim().replace(/\n/g, " ").replace(/\s+/g, " ");
}

export function formatInteractionMemory(input: InteractionMemoryInput): string {
  const parts: string[] = [];
  
  parts.push(`Customer: ${sanitize(input.customerName)}.`);
  
  if (input.serviceType) {
    parts.push(`Service: ${sanitize(input.serviceType)}.`);
  }
  
  if (input.channel) {
    parts.push(`Channel: ${sanitize(input.channel)}.`);
  }
  
  if (input.sentiment) {
    parts.push(`Sentiment: ${input.sentiment}.`);
  }
  
  if (input.keyPoints && input.keyPoints.length > 0) {
    const keyPointsText = input.keyPoints.slice(0, 3).map(p => `- ${sanitize(p)}`).join(" ");
    parts.push(`Key points: ${keyPointsText}`);
  }
  
  if (input.messageThread && input.messageThread.length > 0) {
    const summary = input.messageThread.slice(-3).map(m => sanitize(m).slice(0, 100)).join("; ");
    parts.push(`Recent: ${summary}`);
  }
  
  return parts.join(" ");
}

export function formatPreferenceMemory(input: PreferenceMemoryInput): string {
  const parts: string[] = [];
  
  parts.push(`Customer: ${sanitize(input.customerName)}.`);
  
  if (input.communicationStyle) {
    parts.push(`Preference: ${sanitize(input.communicationStyle)}.`);
  }
  
  if (input.preferredDays && input.preferredDays.length > 0) {
    parts.push(`Days: ${input.preferredDays.join(", ")}.`);
  }
  
  if (input.preferredTimeWindow) {
    parts.push(`Time: ${sanitize(input.preferredTimeWindow)}.`);
  }
  
  if (input.gateCode) {
    parts.push(`Gate: ${sanitize(input.gateCode)}.`);
  }
  
  if (input.petInfo) {
    parts.push(`Pets: ${sanitize(input.petInfo)}.`);
  }
  
  if (input.constraints && input.constraints.length > 0) {
    parts.push(`Constraints: ${input.constraints.map(c => sanitize(c)).join("; ")}.`);
  }
  
  if (input.notes) {
    parts.push(`Note: ${sanitize(input.notes)}.`);
  }
  
  return parts.join(" ");
}

export function formatOutcomeMemory(input: OutcomeMemoryInput): string {
  const parts: string[] = [];
  
  parts.push(`Customer: ${sanitize(input.customerName)}.`);
  
  if (input.serviceType) {
    parts.push(`Service: ${sanitize(input.serviceType)}.`);
  }
  
  parts.push(`Outcome: ${input.outcome}.`);
  
  if (input.quoteLow !== undefined && input.quoteHigh !== undefined) {
    parts.push(`Quote: $${input.quoteLow}-$${input.quoteHigh}.`);
  }
  
  if (input.npsScore !== undefined) {
    parts.push(`NPS: ${input.npsScore}/10.`);
  }
  
  if (input.feedback) {
    parts.push(`Feedback: ${sanitize(input.feedback).slice(0, 200)}.`);
  }
  
  return parts.join(" ");
}

export function formatSummaryMemory(input: SummaryMemoryInput): string {
  const parts: string[] = [];
  
  parts.push(`Customer: ${sanitize(input.customerName)}.`);
  
  if (input.address) {
    parts.push(`Address: ${sanitize(input.address)}.`);
  }
  
  if (input.serviceTypes && input.serviceTypes.length > 0) {
    parts.push(`Services: ${input.serviceTypes.join(", ")}.`);
  }
  
  if (input.stage) {
    parts.push(`Stage: ${sanitize(input.stage)}.`);
  }
  
  if (input.interactionCount !== undefined) {
    parts.push(`Interactions: ${input.interactionCount}.`);
  }
  
  if (input.keyFacts && input.keyFacts.length > 0) {
    const facts = input.keyFacts.slice(0, 5).map(f => sanitize(f)).join("; ");
    parts.push(`Facts: ${facts}.`);
  }
  
  return parts.join(" ");
}

export function formatMemoryByType(
  memoryType: MemoryType,
  input: InteractionMemoryInput | PreferenceMemoryInput | OutcomeMemoryInput | SummaryMemoryInput
): string {
  switch (memoryType) {
    case "interaction":
      return formatInteractionMemory(input as InteractionMemoryInput);
    case "preference":
      return formatPreferenceMemory(input as PreferenceMemoryInput);
    case "outcome":
      return formatOutcomeMemory(input as OutcomeMemoryInput);
    case "summary":
      return formatSummaryMemory(input as SummaryMemoryInput);
    default:
      return JSON.stringify(input);
  }
}

export function computeContentHash(
  text: string, 
  customerId: number, 
  memoryType: string,
  businessId?: number
): string {
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, " ");
  const content = `${businessId || 0}:${customerId}:${memoryType}:${normalizedText}`;
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}
