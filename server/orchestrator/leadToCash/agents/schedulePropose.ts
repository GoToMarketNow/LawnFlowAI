import type { JobRequest } from "@shared/schema";
import { 
  type ScheduleProposeResult, 
  ScheduleProposeResultSchema,
  type OrchestrationContext,
  type TimeWindow,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { log } from "../logger";

function generateTimeWindows(count: number = 3): TimeWindow[] {
  const windows: TimeWindow[] = [];
  const now = new Date();
  
  // Start from tomorrow
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(8, 0, 0, 0); // 8 AM

  let daysAdded = 0;
  let windowsCreated = 0;

  while (windowsCreated < count && daysAdded < 14) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + daysAdded);
    
    const dayOfWeek = checkDate.getDay();
    
    // Skip Sundays (day 0)
    if (dayOfWeek !== 0) {
      // Morning window (8 AM - 12 PM)
      if (windowsCreated < count) {
        const morningStart = new Date(checkDate);
        morningStart.setHours(8, 0, 0, 0);
        
        const morningEnd = new Date(checkDate);
        morningEnd.setHours(12, 0, 0, 0);
        
        windows.push({
          startISO: morningStart.toISOString(),
          endISO: morningEnd.toISOString(),
        });
        windowsCreated++;
      }
      
      // Afternoon window (1 PM - 5 PM) - only if we need more
      if (windowsCreated < count && daysAdded < 3) {
        const afternoonStart = new Date(checkDate);
        afternoonStart.setHours(13, 0, 0, 0);
        
        const afternoonEnd = new Date(checkDate);
        afternoonEnd.setHours(17, 0, 0, 0);
        
        windows.push({
          startISO: afternoonStart.toISOString(),
          endISO: afternoonEnd.toISOString(),
        });
        windowsCreated++;
      }
    }
    
    daysAdded++;
  }

  return windows.slice(0, count);
}

export async function runScheduleProposeAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<ScheduleProposeResult> {
  log("debug", "Running schedule propose agent", { jobRequestId: jobRequest.id });

  // Generate 3 time windows in the next 7 days
  const proposedWindows = generateTimeWindows(3);

  const result: ScheduleProposeResult = {
    proposedWindows,
    deliveryChannel: "sms",
    confidence: proposedWindows.length >= 2 ? "high" : "medium",
  };

  return validateAgentResult(ScheduleProposeResultSchema, result, "scheduleProposeAgent");
}

// Helper to parse customer selection
export function parseScheduleSelection(
  message: string,
  proposedWindows: TimeWindow[]
): { selected: boolean; windowIndex?: number } {
  const lowerMessage = message.toLowerCase().trim();

  // Check for option numbers
  if (lowerMessage.includes("1") || lowerMessage.includes("first") || lowerMessage.includes("option 1")) {
    return { selected: true, windowIndex: 0 };
  }
  if (lowerMessage.includes("2") || lowerMessage.includes("second") || lowerMessage.includes("option 2")) {
    return { selected: true, windowIndex: 1 };
  }
  if (lowerMessage.includes("3") || lowerMessage.includes("third") || lowerMessage.includes("option 3")) {
    return { selected: true, windowIndex: 2 };
  }

  // Check for day references
  for (let i = 0; i < proposedWindows.length; i++) {
    const windowDate = new Date(proposedWindows[i].startISO);
    const dayName = windowDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    
    if (lowerMessage.includes(dayName)) {
      return { selected: true, windowIndex: i };
    }
  }

  return { selected: false };
}
