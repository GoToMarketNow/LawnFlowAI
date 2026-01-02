import { v4 as uuid } from "crypto";
import { loadTemplate, getState, type SmsTemplate, type StateConfig } from "./templateLoader";
import { 
  parseChoice, 
  parseMultiChoice, 
  parseYesNo, 
  classifyObjection, 
  detectHumanRequest,
  detectNegativeSentiment,
  detectConfusion,
  validateAddress,
  renderPrompt 
} from "./validators";
import { computeQuoteRange, computeLotBucket, shouldRequireSiteVisit, type QuoteInput } from "./quoteEngine";
import { getAvailableSlots, selectSlotByIndex, formatSlotsForDisplay } from "./scheduling";
import type { SmsSession, InsertSmsSession, InsertSmsEvent } from "@shared/schema";

function generateUUID(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface InboundSmsInput {
  accountId: string;
  businessId: number;
  fromPhone: string;
  toPhone: string;
  text: string;
  providerMessageId?: string;
  providerPayload?: Record<string, any>;
}

export interface OutboundMessage {
  to: string;
  text: string;
}

export interface Action {
  type: string;
  payload?: Record<string, any>;
}

export interface HandleSmsResult {
  session: Partial<SmsSession>;
  outboundMessages: OutboundMessage[];
  actions: Action[];
  isDuplicate: boolean;
  stateTransition?: {
    from: string;
    to: string;
  };
}

export interface SessionData {
  sessionId: string;
  accountId: string;
  businessId: number;
  fromPhone: string;
  toPhone: string;
  status: string;
  serviceTemplateId: string;
  state: string;
  attemptCounters: Record<string, number>;
  confidence: Record<string, number>;
  collected: Record<string, any>;
  derived: Record<string, any>;
  quote: Record<string, any>;
  scheduling: Record<string, any>;
  handoff: Record<string, any>;
  audit: Record<string, any>;
}

export function createNewSession(input: InboundSmsInput, templateId: string = "lawncare_v1"): SessionData {
  const template = loadTemplate(templateId);
  
  return {
    sessionId: generateUUID(),
    accountId: input.accountId,
    businessId: input.businessId,
    fromPhone: input.fromPhone,
    toPhone: input.toPhone,
    status: "active",
    serviceTemplateId: templateId,
    state: template.entry.state,
    attemptCounters: {},
    confidence: {},
    collected: {},
    derived: {},
    quote: {},
    scheduling: {},
    handoff: {},
    audit: {},
  };
}

export async function handleInboundSms(
  input: InboundSmsInput,
  existingSession: SessionData | null,
  businessName: string = "LawnFlow"
): Promise<HandleSmsResult> {
  const session = existingSession || createNewSession(input);
  const template = loadTemplate(session.serviceTemplateId);
  
  const outboundMessages: OutboundMessage[] = [];
  const actions: Action[] = [];
  
  if (session.status === "paused_for_human") {
    actions.push({ type: "forward_to_human", payload: { text: input.text } });
    return {
      session,
      outboundMessages: [],
      actions,
      isDuplicate: false,
    };
  }
  
  const currentState = getState(template, session.state);
  if (!currentState) {
    console.error(`[StateMachine] Invalid state: ${session.state}`);
    return {
      session,
      outboundMessages: [],
      actions: [{ type: "error", payload: { message: "Invalid session state" } }],
      isDuplicate: false,
    };
  }
  
  const stateBefore = session.state;
  
  if (detectHumanRequest(input.text, template)) {
    session.state = "HUMAN_HANDOFF";
    session.derived.human_requested = true;
  } else if (template.handoff_policy.auto_handoff_on_negative_keyword && 
             detectNegativeSentiment(input.text, template)) {
    session.state = "HUMAN_HANDOFF";
    session.derived.negative_sentiment_detected = true;
  } else {
    const parseResult = processInput(input.text, currentState, template, session);
    
    if (parseResult.success) {
      if (parseResult.field && parseResult.value !== undefined) {
        session.collected[parseResult.field] = parseResult.value;
      }
      
      await executeActions(currentState.actions || [], session, template, input);
      
      const nextState = evaluateTransition(currentState, session, template);
      session.state = nextState;
      
      session.attemptCounters[stateBefore] = 0;
    } else {
      const attempts = (session.attemptCounters[stateBefore] || 0) + 1;
      session.attemptCounters[stateBefore] = attempts;
      
      const maxAttempts = template.handoff_policy.max_attempts_by_state[stateBefore] || 3;
      if (attempts >= maxAttempts) {
        session.state = "HUMAN_HANDOFF";
        session.derived.max_attempts_exceeded = true;
        session.derived.exceeded_state = stateBefore;
      }
    }
  }
  
  const stateAfter = session.state;
  
  if (session.state === "PRICE_RANGE") {
    computeAndStoreQuote(session, template);
  }
  
  if (session.state === "SCHEDULING") {
    populateSchedulingSlots(session);
  }
  
  const newState = getState(template, session.state);
  if (newState && newState.prompt.length > 0) {
    const renderedPrompt = renderPrompt(newState.prompt, {
      business_name: businessName,
      collected: session.collected,
      derived: session.derived,
      quote: session.quote,
      scheduling: session.scheduling,
      click_to_call_url: session.handoff.click_to_call_url || "https://lawnflow.ai/call",
      objection: session.derived.current_objection,
    });
    
    outboundMessages.push({
      to: input.fromPhone,
      text: renderedPrompt,
    });
  }
  
  if (session.state === "HUMAN_HANDOFF") {
    actions.push({ type: "create_handoff_ticket" });
    actions.push({ type: "pause_for_human" });
    actions.push({ type: "generate_click_to_call_token" });
    session.status = "paused_for_human";
  }
  
  if (session.state === "POST_BOOKING") {
    actions.push({ type: "create_or_update_jobber_records" });
  }
  
  if (session.state === "END") {
    session.status = "closed";
  }
  
  return {
    session,
    outboundMessages,
    actions,
    isDuplicate: false,
    stateTransition: stateBefore !== stateAfter ? { from: stateBefore, to: stateAfter } : undefined,
  };
}

function processInput(
  text: string,
  stateConfig: StateConfig,
  template: SmsTemplate,
  session: SessionData
): { success: boolean; field?: string; value?: any } {
  const parse = stateConfig.parse;
  if (!parse) {
    return { success: true };
  }
  
  switch (parse.type) {
    case "map_choice": {
      const result = parseChoice(text, parse.map || {});
      return {
        success: result.success,
        field: parse.field,
        value: result.value,
      };
    }
    
    case "numbers_to_keys": {
      const choicesPath = parse.choices_path || "service_catalog.choices";
      const choices = template.service_catalog.choices;
      const result = parseMultiChoice(text, choices);
      return {
        success: result.success,
        field: parse.field,
        value: result.value,
      };
    }
    
    case "set_field": {
      const validation = validateAddress(text);
      return {
        success: validation.success,
        field: parse.field,
        value: text.trim(),
      };
    }
    
    case "set_field_from_choice": {
      const result = parseChoice(text, parse.map || {});
      return {
        success: result.success,
        field: parse.field,
        value: result.value,
      };
    }
    
    case "yes_no": {
      const result = parseYesNo(text);
      session.derived.yes_no = result.value;
      return {
        success: result.success,
        field: parse.field,
        value: result.value,
      };
    }
    
    case "classify_objection_or_continue": {
      const objection = classifyObjection(text, template);
      if (objection) {
        session.derived.objection_type = objection.type;
        session.derived.current_objection = {
          type: objection.type,
          prompt: objection.objection.prompt_sequence[0],
        };
        return { success: true };
      }
      return { success: false };
    }
    
    case "handle_objection": {
      const result = parseChoice(text, { "1": "opt1", "2": "opt2", "3": "opt3" });
      if (result.success) {
        session.derived.objection_resolved = true;
        return { success: true };
      }
      const attempts = (session.derived.objection_attempts || 0) + 1;
      session.derived.objection_attempts = attempts;
      if (attempts >= 2) {
        session.derived.escalate_to_handoff = true;
      }
      return { success: false };
    }
    
    case "select_slot_by_choice": {
      const slots = session.scheduling.slots || [];
      const choiceNum = parseInt(text.trim(), 10);
      if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= slots.length) {
        const selectedSlot = slots[choiceNum - 1];
        session.scheduling.selected_slot = selectedSlot;
        return { success: true };
      }
      if (text.toLowerCase().includes("call")) {
        session.derived.human_requested = true;
      }
      return { success: false };
    }
    
    case "handoff_choice": {
      const lower = text.toLowerCase();
      if (lower.includes("text") || lower.includes("sms")) {
        session.derived.handoff_mode = "text";
      } else {
        session.derived.handoff_mode = "call";
      }
      return { success: true };
    }
    
    case "classify_objection_or_human_request": {
      if (detectHumanRequest(text, template)) {
        session.derived.human_requested = true;
        return { success: true };
      }
      if (text.toLowerCase().includes("start")) {
        session.state = "INTENT";
        return { success: false };
      }
      return { success: false };
    }
    
    case "map_choice_to_slot_request_or_call": {
      const choiceNum = parseInt(text.trim(), 10);
      if (choiceNum === 1 || choiceNum === 2) {
        session.derived.requested_slot = choiceNum === 1 ? "tue_pm" : "thu_am";
        return { success: true };
      }
      return { success: false };
    }
    
    default:
      return { success: true };
  }
}

async function executeActions(
  actions: Array<{ type: string; [key: string]: any }>,
  session: SessionData,
  template: SmsTemplate,
  input: InboundSmsInput
): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case "call_lead_intake_enrichment":
        const enrichmentResult = await mockEnrichLead(
          session.collected.address_raw,
          input.fromPhone,
          input.accountId
        );
        session.derived = { ...session.derived, ...enrichmentResult };
        break;
        
      case "derive_urgency_from_timeline":
        const timeline = session.collected.timeline;
        session.derived.urgency = timeline === "asap" ? "high" : 
                                   timeline === "1_2_weeks" ? "medium" : "low";
        break;
        
      case "create_handoff_ticket":
      case "pause_for_human":
      case "create_or_update_jobber_records_if_yes":
        break;
        
      default:
        console.log(`[StateMachine] Unknown action: ${action.type}`);
    }
  }
}

function evaluateTransition(
  stateConfig: StateConfig,
  session: SessionData,
  template: SmsTemplate
): string {
  const transition = stateConfig.transition;
  
  if (transition.success_condition) {
    const conditionMet = evaluateCondition(transition.success_condition, session, template);
    if (conditionMet) {
      return transition.success;
    }
  }
  
  if (transition.fail_condition_1) {
    const failConditionMet = evaluateCondition(transition.fail_condition_1, session, template);
    if (failConditionMet && transition.fail_1) {
      return transition.fail_1;
    }
  }
  
  if (!transition.success_condition) {
    return transition.success;
  }
  
  return transition.fail;
}

function evaluateCondition(
  condition: string,
  session: SessionData,
  template: SmsTemplate
): boolean {
  try {
    if (condition.includes("derived.address_confidence >= integrations.lead_intake_agent.address_confidence_threshold")) {
      const confidence = session.derived.address_confidence || 0;
      const threshold = template.integrations.lead_intake_agent.address_confidence_threshold;
      return confidence >= threshold;
    }
    
    if (condition.includes("collected.address_confirmed == true")) {
      return session.collected.address_confirmed === true;
    }
    
    if (condition.includes("collected.next_action == 'exact_quote'")) {
      return session.collected.next_action === "exact_quote";
    }
    
    if (condition.includes("collected.next_action == 'site_visit'")) {
      return session.collected.next_action === "site_visit";
    }
    
    if (condition.includes("collected.exact_quote_response == 'yes'")) {
      return session.collected.exact_quote_response === "yes";
    }
    
    if (condition.includes("collected.exact_quote_response == 'call'")) {
      return session.collected.exact_quote_response === "call";
    }
    
    if (condition.includes("derived.objection_type != null")) {
      return session.derived.objection_type != null;
    }
    
    if (condition.includes("derived.objection_resolved == true")) {
      return session.derived.objection_resolved === true;
    }
    
    if (condition.includes("derived.escalate_to_handoff == true")) {
      return session.derived.escalate_to_handoff === true;
    }
    
    if (condition.includes("derived.handoff_mode == 'call'")) {
      return session.derived.handoff_mode === "call";
    }
    
    if (condition.includes("derived.handoff_mode == 'text'")) {
      return session.derived.handoff_mode === "text";
    }
    
    if (condition.includes("derived.yes_no == 'yes'")) {
      return session.derived.yes_no === "yes";
    }
    
    if (condition.includes("scheduling.selected_slot != null")) {
      return session.scheduling.selected_slot != null;
    }
    
    if (condition.includes("derived.requested_slot != null")) {
      return session.derived.requested_slot != null;
    }
    
    if (condition.includes("derived.human_requested == true")) {
      return session.derived.human_requested === true;
    }
    
    return false;
  } catch (e) {
    console.error(`[StateMachine] Error evaluating condition: ${condition}`, e);
    return false;
  }
}

function computeAndStoreQuote(session: SessionData, template: SmsTemplate): void {
  const lotBucket = computeLotBucket(
    session.derived.arcgis?.estimated_lot_acres,
    session.collected.lot_size_bucket
  );
  
  const quoteInput: QuoteInput = {
    frequency: session.collected.frequency || "one_time",
    lot_size_bucket: lotBucket,
    services_requested: session.collected.services_requested || ["mowing"],
    fence: session.collected.fence,
    slope: session.collected.slope,
  };
  
  const quote = computeQuoteRange(template, quoteInput);
  session.quote = quote;
}

function populateSchedulingSlots(session: SessionData): void {
  if (session.scheduling.slots && session.scheduling.slots.length > 0) {
    return;
  }
  
  const slots = getAvailableSlots(session.accountId);
  session.scheduling.slots = formatSlotsForDisplay(slots);
  session.scheduling.slot_objects = slots;
}

async function mockEnrichLead(
  addressRaw: string,
  phone: string,
  accountId: string
): Promise<Record<string, any>> {
  const normalizedAddress = addressRaw
    .replace(/\s+/g, " ")
    .trim();
  
  const isComplete = /\d+.*[a-zA-Z]+.*,.*[a-zA-Z]+/.test(normalizedAddress);
  
  const confidence = isComplete ? 0.85 + Math.random() * 0.1 : 0.5 + Math.random() * 0.2;
  
  return {
    address_normalized: {
      street: normalizedAddress.split(",")[0]?.trim() || normalizedAddress,
      city: normalizedAddress.split(",")[1]?.trim() || "Unknown",
      state: "VA",
      zip: "22901",
    },
    address_one_line: `${normalizedAddress}, VA 22901`,
    address_confidence: confidence,
    arcgis: {
      geometry: { lat: 38.0293, lng: -78.4767 },
      estimated_lot_acres: 0.25 + Math.random() * 0.5,
      estimated_area_sqft: 10890 + Math.floor(Math.random() * 10000),
      confidence: 0.75 + Math.random() * 0.15,
      source: "arcgis_mock",
    },
    property_type: "residential",
    notes: ["Mock enrichment for testing"],
  };
}

export function getEntryState(templateId: string): string {
  const template = loadTemplate(templateId);
  return template.entry.state;
}
