import { MessageTemplate, getTemplate, detectServiceCategory, ServiceCategory } from "./messageTemplates";

export interface RenderContext {
  customerFirstName: string;
  customerLastName?: string;
  customerPhone: string;
  propertyAddress?: string;
  
  businessName: string;
  businessPhone: string;
  
  scheduledDate?: string;
  newDate?: string;
  originalDate?: string;
  
  serviceType?: string;
  projectType?: string;
  serviceNotes?: string;
  crewName?: string;
  reason?: string;
  
  hasGpsEta?: boolean;
  etaMinutes?: number;
}

export interface ComplianceCheck {
  noExactEta: boolean;
  hasRescheduleOption: boolean;
  noPromisedTime: boolean;
}

export interface RenderResult {
  success: boolean;
  message: string;
  templateId: string;
  complianceChecks: ComplianceCheck;
  violations: string[];
  variables: Record<string, string>;
}

const EXACT_TIME_PATTERNS = [
  /at\s+\d{1,2}:\d{2}/i,
  /at\s+\d{1,2}\s*(am|pm)/i,
  /arrive\s+at\s+\d/i,
  /exactly\s+at/i,
  /precisely\s+at/i,
];

const RESCHEDULE_KEYWORDS = ["reschedule", "change", "call us", "reply", "contact"];

function checkCompliance(message: string, context: RenderContext): ComplianceCheck {
  const hasExactTime = EXACT_TIME_PATTERNS.some(p => p.test(message));
  const hasGpsEta = context.hasGpsEta === true;
  
  const noExactEta = !hasExactTime || hasGpsEta;
  
  const lowerMessage = message.toLowerCase();
  const hasRescheduleOption = RESCHEDULE_KEYWORDS.some(kw => lowerMessage.includes(kw));
  
  const noPromisedTime = !hasExactTime || hasGpsEta;
  
  return {
    noExactEta,
    hasRescheduleOption,
    noPromisedTime,
  };
}

function getViolations(checks: ComplianceCheck): string[] {
  const violations: string[] = [];
  
  if (!checks.noExactEta) {
    violations.push("Message contains exact arrival time without GPS-driven ETA");
  }
  
  if (!checks.hasRescheduleOption) {
    violations.push("Message does not include reschedule option");
  }
  
  return violations;
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  
  const conditionalPattern = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(conditionalPattern, (_, varName, content) => {
    const value = variables[varName];
    if (value && value.trim() !== "") {
      return renderTemplate(content, variables);
    }
    return "";
  });
  
  const variablePattern = /\{\{(\w+)\}\}/g;
  result = result.replace(variablePattern, (_, varName) => {
    return variables[varName] || "";
  });
  
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  
  return result;
}

export function renderMessage(
  messageType: string,
  context: RenderContext,
  serviceCategory?: ServiceCategory
): RenderResult {
  const category = serviceCategory || detectServiceCategory(context.serviceType);
  const template = getTemplate(messageType, category);
  
  if (!template) {
    return {
      success: false,
      message: "",
      templateId: "",
      complianceChecks: { noExactEta: true, hasRescheduleOption: false, noPromisedTime: true },
      violations: [`No template found for messageType=${messageType}, category=${category}`],
      variables: {},
    };
  }
  
  const variables: Record<string, string> = {
    customerFirstName: context.customerFirstName || "Valued Customer",
    customerLastName: context.customerLastName || "",
    customerPhone: context.customerPhone || "",
    propertyAddress: context.propertyAddress || "your property",
    businessName: context.businessName || "Your Landscaping Team",
    businessPhone: context.businessPhone || "",
    scheduledDate: context.scheduledDate || "",
    newDate: context.newDate || "",
    originalDate: context.originalDate || "",
    serviceType: context.serviceType || "",
    projectType: context.projectType || "",
    serviceNotes: context.serviceNotes || "",
    crewName: context.crewName || "",
    reason: context.reason || "",
  };
  
  const missingRequired = template.requiredVariables.filter(
    v => !variables[v] || variables[v].trim() === ""
  );
  
  if (missingRequired.length > 0) {
    return {
      success: false,
      message: "",
      templateId: template.id,
      complianceChecks: { noExactEta: true, hasRescheduleOption: false, noPromisedTime: true },
      violations: [`Missing required variables: ${missingRequired.join(", ")}`],
      variables,
    };
  }
  
  const message = renderTemplate(template.template, variables);
  
  const complianceChecks = checkCompliance(message, context);
  const violations = getViolations(complianceChecks);
  
  const allPassed = violations.length === 0;
  
  return {
    success: allPassed,
    message,
    templateId: template.id,
    complianceChecks,
    violations,
    variables,
  };
}

export function formatDateForMessage(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  
  return d.toLocaleDateString("en-US", options);
}

export function formatTimeWindow(startHour: number, endHour: number): string {
  const formatHour = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}${ampm}`;
  };
  
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
}
