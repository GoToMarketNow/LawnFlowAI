import { randomBytes } from "crypto";

function generateUUID(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface HandoffTicketData {
  ticketId: string;
  sessionId: string;
  accountId: string;
  businessId: number;
  status: "open" | "assigned" | "resolved" | "closed";
  priority: "low" | "normal" | "high";
  reasonCodes: string[];
  summary: string;
  assignedTo?: string;
}

export interface ClickToCallTokenData {
  tokenId: string;
  sessionId: string;
  token: string;
  expiresAt: Date;
}

export function createHandoffTicket(
  sessionId: string,
  accountId: string,
  businessId: number,
  reasons: string[],
  summary: string,
  priority: "low" | "normal" | "high" = "normal"
): HandoffTicketData {
  return {
    ticketId: generateUUID(),
    sessionId,
    accountId,
    businessId,
    status: "open",
    priority,
    reasonCodes: reasons,
    summary,
  };
}

export function generateClickToCallToken(
  sessionId: string,
  ttlMinutes: number = 10
): ClickToCallTokenData {
  const token = randomBytes(16).toString("base64url").slice(0, 12);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  
  return {
    tokenId: generateUUID(),
    sessionId,
    token,
    expiresAt,
  };
}

export function isTokenExpired(token: ClickToCallTokenData): boolean {
  return new Date() > token.expiresAt;
}

export function buildClickToCallUrl(token: string, baseUrl: string = ""): string {
  const base = baseUrl || process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : "http://localhost:5000";
  return `${base}/sms/click-to-call/${token}`;
}

export function generateHandoffSummary(
  session: {
    fromPhone: string;
    collected: Record<string, any>;
    derived: Record<string, any>;
    state: string;
  },
  reasons: string[]
): string {
  const parts: string[] = [];
  
  parts.push(`Customer Phone: ${session.fromPhone}`);
  parts.push(`Current State: ${session.state}`);
  parts.push(`Reason(s): ${reasons.join(", ")}`);
  
  if (session.derived.address_one_line) {
    parts.push(`Address: ${session.derived.address_one_line}`);
  }
  
  if (session.collected.services_requested?.length > 0) {
    parts.push(`Services: ${session.collected.services_requested.join(", ")}`);
  }
  
  if (session.collected.frequency) {
    parts.push(`Frequency: ${session.collected.frequency}`);
  }
  
  return parts.join("\n");
}

export function determineHandoffReasons(
  session: {
    derived: Record<string, any>;
    state: string;
    attemptCounters: Record<string, number>;
  }
): string[] {
  const reasons: string[] = [];
  
  if (session.derived.human_requested) {
    reasons.push("customer_requested_human");
  }
  
  if (session.derived.negative_sentiment_detected) {
    reasons.push("negative_sentiment");
  }
  
  if (session.derived.max_attempts_exceeded) {
    reasons.push(`max_attempts_exceeded_${session.derived.exceeded_state}`);
  }
  
  if (session.derived.escalate_to_handoff) {
    reasons.push("objection_escalation");
  }
  
  if (reasons.length === 0) {
    reasons.push("unknown");
  }
  
  return reasons;
}

export function determinePriority(
  reasons: string[],
  session: { derived: Record<string, any> }
): "low" | "normal" | "high" {
  if (reasons.includes("negative_sentiment")) {
    return "high";
  }
  
  if (session.derived.urgency === "high" || session.derived.timeline === "asap") {
    return "high";
  }
  
  if (reasons.includes("customer_requested_human")) {
    return "normal";
  }
  
  return "normal";
}
