type LogLevel = "info" | "warn" | "error" | "debug";

const LOG_PREFIX = "[L2C-Orchestrator]";

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX}`;

  switch (level) {
    case "info":
      console.log(`${prefix} INFO: ${message}`, data || "");
      break;
    case "warn":
      console.warn(`${prefix} WARN: ${message}`, data || "");
      break;
    case "error":
      console.error(`${prefix} ERROR: ${message}`, data || "");
      break;
    case "debug":
      if (process.env.DEBUG) {
        console.debug(`${prefix} DEBUG: ${message}`, data || "");
      }
      break;
  }
}

export function logStepStart(runId: string, stage: string, stepIndex: number): void {
  log("info", `Step ${stepIndex} starting`, { runId, stage });
}

export function logStepComplete(
  runId: string, 
  stage: string, 
  stepIndex: number, 
  decision: { advance: boolean; confidence: string }
): void {
  log("info", `Step ${stepIndex} completed`, { 
    runId, 
    stage, 
    advance: decision.advance,
    confidence: decision.confidence,
  });
}

export function logAgentCall(agentName: string, input: Record<string, unknown>): void {
  log("debug", `Calling agent: ${agentName}`, input);
}

export function logAgentResult(agentName: string, result: Record<string, unknown>): void {
  log("debug", `Agent result: ${agentName}`, result);
}

export function logHitlPause(runId: string, reason: string): void {
  log("info", `HITL pause`, { runId, reason });
}

export function logHitlResume(runId: string, approvedBy?: number): void {
  log("info", `HITL resume`, { runId, approvedBy });
}
