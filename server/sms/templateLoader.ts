import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface StateConfig {
  prompt: string[];
  expected_input: "choice" | "choice_multi" | "free_text" | "yes_no" | "system" | "choice_or_free_text";
  parse?: {
    type: string;
    field?: string;
    map?: Record<string, any>;
    choices_path?: string;
  };
  actions?: Array<{ type: string; [key: string]: any }>;
  transition: {
    success: string;
    fail: string;
    success_condition?: string;
    fail_condition_1?: string;
    fail_1?: string;
  };
}

export interface ObjectionConfig {
  keywords: string[];
  escalate_after: number;
  prompt_sequence: string[];
  on_choice?: Record<string, { set_field?: Record<string, any>; next: string }>;
}

export interface SmsTemplate {
  template_id: string;
  version: string;
  vertical: string;
  locale: string;
  entry: { state: string };
  runtime: {
    timezone_default: string;
    business_hours: {
      tz: string;
      days: string[];
      start: string;
      end: string;
    };
    safe_mode: {
      never_commit_without_confirmation: boolean;
      force_run_requires_apply_confirm: boolean;
    };
  };
  field_schema: Record<string, {
    type: string;
    values?: string[];
    items?: string[];
    required: boolean;
  }>;
  integrations: {
    lead_intake_agent: {
      agent_id: string;
      call: string;
      address_confidence_threshold: number;
    };
    scheduling: {
      mode: string;
      default_job_duration_minutes: number;
      slot_window_days: number;
      max_slots_offered: number;
    };
    click_to_call: {
      token_ttl_minutes: number;
      offer_on_handoff: boolean;
    };
  };
  handoff_policy: {
    max_attempts_by_state: Record<string, number>;
    no_response_nudges_minutes: number[];
    confusion_keywords: string[];
    human_request_keywords: string[];
    negative_keywords: string[];
    auto_handoff_on_negative_keyword: boolean;
  };
  service_catalog: {
    choices: Array<{ n: number; key: string; label: string }>;
    site_visit_required_services: string[];
  };
  quote_policy: {
    mode: string;
    range_per_visit_usd: Record<string, Record<string, [number, number]>>;
    exact_pricing: {
      enabled: boolean;
      requires_validation_questions: boolean;
      adjustments: Record<string, number>;
    };
    site_visit_rules: {
      if_address_confidence_below: number;
      if_services_include_any_of: string[];
      if_property_type_is: string[];
    };
  };
  objections: Record<string, ObjectionConfig>;
  states: Record<string, StateConfig>;
}

const templateCache = new Map<string, SmsTemplate>();

export function loadTemplate(templateId: string): SmsTemplate {
  const cached = templateCache.get(templateId);
  if (cached) {
    return cached;
  }

  const templatePath = join(process.cwd(), "templates", "sms", `${templateId}.json`);
  
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const content = readFileSync(templatePath, "utf-8");
  const template: SmsTemplate = JSON.parse(content);
  
  templateCache.set(templateId, template);
  return template;
}

export function getState(template: SmsTemplate, stateName: string): StateConfig | undefined {
  return template.states[stateName];
}

export function getObjection(template: SmsTemplate, objectionType: string): ObjectionConfig | undefined {
  return template.objections[objectionType];
}

export function clearTemplateCache(): void {
  templateCache.clear();
}
