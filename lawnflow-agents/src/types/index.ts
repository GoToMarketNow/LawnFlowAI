// Core types for the unified LawnFlow agent system

export interface Event {
  id: string;
  type: string;
  channel: string;
  payload: Record<string, any>;
  timestamp: string;
  source?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface StateSummary {
  customer_id?: string;
  job_id?: string;
  crew_id?: string;
  lead_id?: string;
  quote_id?: string;
  last_actions: string[];
  active_jobs: string[];
  pending_quotes: string[];
  context: Record<string, any>;
}

export interface FinOpsConfig {
  token_budget: number;
  allowed_tools: string[];
  max_tool_calls: number;
  cost_tracking: boolean;
}

export interface AgentContext {
  event: Event;
  state: StateSummary;
  finops: FinOpsConfig;
  business_config: BusinessConfig;
  previous_results?: any[];
}

export interface BusinessConfig {
  account_id: string;
  business_name: string;
  services: Service[];
  service_area: string;
  pricing_rules: PricingRules;
  scheduling_rules: SchedulingRules;
  crew_config: CrewConfig[];
  // Additional properties for new agents
  operating_hours?: any;
  service_durations?: any;
  crew_capacities?: any;
  weather_constraints?: any;
  crews?: any[];
  service_standards?: any;
  equipment?: any;
  quality_standards?: any;
  service_requirements?: any;
  business_info?: any;
  notification_settings?: any;
  crew_support?: any;
  support_resources?: any;
  follow_up_goals?: any;
  response_benchmarks?: any;
  service_policies?: any;
  response_templates?: any;
  escalation_thresholds?: any;
  escalation_policies?: any;
  managers?: any[];
}

export interface Service {
  id: string;
  name: string;
  category: string;
  base_price: number;
  unit: string;
  complexity_factors: string[];
}

export interface PricingRules {
  min_margin: number;
  max_discount: number;
  frequency_multipliers: Record<string, number>;
  complexity_multipliers: Record<string, number>;
}

export interface SchedulingRules {
  business_hours: {
    start: string;
    end: string;
    days: string[];
  };
  max_jobs_per_crew: number;
  travel_buffer_minutes: number;
}

export interface CrewConfig {
  id: string;
  name: string;
  skills: string[];
  availability: Record<string, string>;
  hourly_rate: number;
  max_daily_hours: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
  result?: any;
  error?: string;
}

export interface NextAction {
  type: 'tool_call' | 'ask_user' | 'handoff' | 'complete';
  detail: string;
  priority?: 'low' | 'medium' | 'high';
  agent?: string;
}

export interface Error {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

export interface Cost {
  estimated_tokens_in: number;
  estimated_tokens_out: number;
  tool_calls: number;
  actual_cost?: number;
}

export interface Envelope {
  status: 'ok' | 'needs_input' | 'blocked' | 'error';
  agent: string;
  summary: string;
  cost: Cost;
  data: any;
  next_actions: NextAction[];
  errors: Error[];
  metadata?: {
    execution_time_ms: number;
    agent_version: string;
    prompt_hash?: string;
  };
}

// Agent-specific result types
export interface IntakeResult {
  is_qualified: boolean;
  customer_name?: string;
  service_type?: string;
  address?: string;
  urgency: 'low' | 'medium' | 'high';
  notes: string;
  suggested_response: string;
  extracted_entities: Record<string, any>;
}

export interface QualificationResult {
  overall_score: number;
  tier: 'A' | 'B' | 'C' | 'D';
  scores: {
    revenue: number;
    conversion: number;
    profitability: number;
    risk: number;
  };
  recommendation: 'accept' | 'nurture' | 'decline';
  reason: string;
  next_steps: string[];
}

export interface PricingResult {
  quotes: Array<{
    service_id: string;
    service_name: string;
    base_price: number;
    final_price: number;
    margin: number;
    confidence: 'high' | 'medium' | 'low';
    breakdown: Record<string, number>;
  }>;
  total_estimate: number;
  valid_until?: string;
  requires_approval: boolean;
  approval_reason?: string;
}

export interface SchedulingResult {
  proposed_slots: Array<{
    date: string;
    start_time: string;
    end_time: string;
    crew_id: string;
    crew_name: string;
    confidence: number;
  }>;
  recommended_slot?: {
    date: string;
    start_time: string;
    end_time: string;
    crew_id: string;
  };
  schedule_options?: any[];
  recommended_schedule?: any;
  crew_assignments?: any[];
  estimated_duration?: string;
  weather_considerations?: string[];
  notes_for_customer: string;
  requires_approval: boolean;
  approval_reason?: string;
}

export interface RouteOptimizationResult {
  optimized_route: Array<{
    job_id: string;
    sequence: number;
    estimated_arrival: string;
    service_time_minutes: number;
    travel_time_minutes: number;
  }>;
  total_distance_miles: number;
  total_time_hours: number;
  efficiency_score: number;
  fuel_savings_gallons?: number;
  time_savings_hours?: number;
}

export interface JobExecutionResult {
  job_id: string;
  status: 'scheduled' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'delayed' | 'issue';
  progress_percentage: number;
  current_phase?: string;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    resolution?: string;
  }>;
  estimated_completion?: string;
  crew_location?: {
    lat: number;
    lng: number;
    last_update: string;
  };
  photos_required: string[];
  customer_updates: string[];
}

export interface InvoicingResult {
  invoice_id: string;
  amount_due: number;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  payment_terms: string;
  due_date: string;
  payment_methods: string[];
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  reminders_sent: number;
}

export interface RetentionResult {
  customer_id: string;
  retention_risk: 'low' | 'medium' | 'high';
  opportunities: Array<{
    type: 'upsell' | 'retention';
    service: string;
    value: number;
    confidence: 'high' | 'medium' | 'low';
    timing: string;
    message: string;
  }>;
  recommended_actions: string[];
  lifetime_value_projection: number;
  churn_probability: number;
}

export interface ReviewsResult {
  review_requests: Array<{
    platform: string;
    url?: string;
    sent: boolean;
    sent_at?: string;
  }>;
  referral_program: {
    code_generated: boolean;
    code?: string;
    incentives: string[];
  };
  social_proof: Array<{
    platform: string;
    content: string;
    engagement: number;
  }>;
}

export interface ProfitAnalyticsResult {
  period: string;
  revenue: {
    total: number;
    by_service: Record<string, number>;
    by_customer_segment: Record<string, number>;
    growth_rate: number;
  };
  costs: {
    total: number;
    breakdown: Record<string, number>;
    per_job: number;
  };
  profitability: {
    gross_margin: number;
    net_profit: number;
    by_service: Record<string, number>;
    by_crew: Record<string, number>;
  };
  insights: string[];
  recommendations: Array<{
    type: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
    expected_impact: number;
  }>;
  alerts: Array<{
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }>;
}

export interface JobCreationResult {
  job_id: string;
  job_details: any;
  work_instructions: any;
  notifications_sent: any[];
  status: string;
}

export interface CrewNotificationResult {
  job_id: string;
  crew_id: string;
  notification_sent: boolean;
  notification_content: any;
  follow_up_scheduled: boolean;
  follow_up_time: string;
}

export interface JobMonitoringResult {
  job_id: string;
  current_status: string;
  progress_percentage: number;
  issues_detected: any[];
  recommended_actions: any[];
  next_check_time: string | null;
}

export interface QualityAssuranceResult {
  job_id: string;
  quality_score: number;
  assessment_details: any;
  quality_report: any;
  rework_required: boolean;
  rework_items: any[];
  approved: boolean;
}

export interface CompletionFinalizationResult {
  job_id: string;
  final_status: string;
  completion_details: any;
  customer_notification: any;
  payment_processed: boolean;
  payment_amount: number;
  follow_up_scheduled: boolean;
  next_service_suggestion: string;
}

export interface CustomerNotificationResult {
  job_id: string;
  customer_id: string;
  notification_type: string;
  message_sent: any;
  delivery_channels: string[];
  delivery_status: string;
  logged: boolean;
  follow_up_required: boolean;
}

export interface CrewSupportResult {
  job_id: string;
  support_type: string;
  issues_identified: any[];
  rework_required: any[];
  support_plan: any;
  resources_dispatched: any[];
  estimated_resolution_time: string;
  priority_level: string;
}

export interface FollowUpSchedulerResult {
  customer_id: string;
  follow_up_strategy: any;
  scheduled_activities: any[];
  reminder_sequence: any[];
  next_contact_date: string;
  expected_response_rate: number;
  business_value: number;
}

export interface CustomerFollowUpResult {
  customer_id: string;
  job_id: string;
  follow_up_reason: string;
  responses_checked: any[];
  response_analysis: any;
  recommended_actions: any[];
  urgency_level: string;
  next_steps: any[];
}

export interface CustomerServiceResult {
  customer_id: string;
  service_request: any;
  priority_level: string;
  assessment: any;
  response_plan: any;
  resolution_path: any;
  estimated_resolution_time: string;
  escalation_required: boolean;
}

export interface ManagerEscalationResult {
  customer_id: string;
  escalation_id: string;
  issue_summary: string;
  assigned_manager: any;
  priority_level: string;
  escalation_package: any;
  notification_sent: boolean;
  expected_response_time: string;
  resolution_deadline: string;
}

export interface EscalationMonitorResult {
  escalation_id: string;
  current_status: string;
  time_elapsed: string;
  time_to_deadline: string;
  progress_assessment: any;
  risk_level: string;
  recommended_actions: any[];
  next_check_time: string | null;
}