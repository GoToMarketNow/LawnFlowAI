import type { SmsTemplate, ObjectionConfig } from "./templateLoader";

export interface ParseResult {
  success: boolean;
  value?: any;
  field?: string;
  error?: string;
}

export function parseChoice(input: string, map: Record<string, any>): ParseResult {
  const normalized = input.trim().toLowerCase();
  
  for (const [key, value] of Object.entries(map)) {
    if (normalized === key || normalized === key.toLowerCase()) {
      return { success: true, value };
    }
  }
  
  const numMatch = input.match(/^(\d+)$/);
  if (numMatch && map[numMatch[1]]) {
    return { success: true, value: map[numMatch[1]] };
  }
  
  return { success: false, error: "Invalid choice" };
}

export function parseMultiChoice(
  input: string, 
  choices: Array<{ n: number; key: string; label: string }>
): ParseResult {
  const normalized = input.replace(/\s/g, "").toLowerCase();
  
  const numbers = normalized.split(/[,\s]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  
  if (numbers.length === 0) {
    return { success: false, error: "No valid numbers found" };
  }
  
  const keys: string[] = [];
  for (const num of numbers) {
    const choice = choices.find(c => c.n === num);
    if (choice) {
      keys.push(choice.key);
    }
  }
  
  if (keys.length === 0) {
    return { success: false, error: "No valid service selections" };
  }
  
  return { success: true, value: keys };
}

export function parseYesNo(input: string): ParseResult {
  const normalized = input.trim().toLowerCase();
  
  const yesPatterns = ["yes", "y", "yeah", "yep", "sure", "ok", "okay", "confirm", "1"];
  const noPatterns = ["no", "n", "nah", "nope", "cancel", "stop", "2"];
  
  if (yesPatterns.includes(normalized)) {
    return { success: true, value: "yes" };
  }
  
  if (noPatterns.includes(normalized)) {
    return { success: true, value: "no" };
  }
  
  return { success: false, error: "Please reply YES or NO" };
}

export function classifyObjection(
  input: string, 
  template: SmsTemplate
): { type: string; objection: ObjectionConfig } | null {
  const normalized = input.toLowerCase();
  
  for (const [type, config] of Object.entries(template.objections)) {
    for (const keyword of config.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return { type, objection: config };
      }
    }
  }
  
  return null;
}

export function detectHumanRequest(input: string, template: SmsTemplate): boolean {
  const normalized = input.toLowerCase();
  
  for (const keyword of template.handoff_policy.human_request_keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function detectNegativeSentiment(input: string, template: SmsTemplate): boolean {
  const normalized = input.toLowerCase();
  
  for (const keyword of template.handoff_policy.negative_keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function detectConfusion(input: string, template: SmsTemplate): boolean {
  const normalized = input.toLowerCase();
  
  for (const keyword of template.handoff_policy.confusion_keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function validateAddress(input: string): ParseResult {
  const trimmed = input.trim();
  
  if (trimmed.length < 5) {
    return { success: false, error: "Address too short" };
  }
  
  const hasNumber = /\d/.test(trimmed);
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  
  if (!hasNumber || !hasLetters) {
    return { success: false, error: "Please provide a street address with number and name" };
  }
  
  return { success: true, value: trimmed };
}

export function renderPrompt(
  promptLines: string[],
  context: {
    business_name?: string;
    collected?: Record<string, any>;
    derived?: Record<string, any>;
    quote?: Record<string, any>;
    scheduling?: Record<string, any>;
    click_to_call_url?: string;
    objection?: { prompt?: string };
  }
): string {
  const text = promptLines.join("\n");
  
  return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split(".");
    let value: any = context;
    
    for (const key of keys) {
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrKey, idx] = arrayMatch;
        value = value?.[arrKey]?.[parseInt(idx, 10)];
      } else {
        value = value?.[key];
      }
      
      if (value === undefined || value === null) {
        return match;
      }
    }
    
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    
    return String(value);
  });
}
