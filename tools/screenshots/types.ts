export type JourneyStage = 
  | 'LEAD' 
  | 'QUALIFY' 
  | 'QUOTE' 
  | 'SCHEDULE' 
  | 'SERVICE_DELIVERY' 
  | 'INVOICE_COLLECT' 
  | 'ONGOING_COMMS' 
  | 'AGENT_DIRECTORY' 
  | 'SETTINGS';

export type Persona = 'owner_admin' | 'crew_lead' | 'crew_member';

export type ValueDriver = 
  | 'happier_customers' 
  | 'productive_crews' 
  | 'higher_profit' 
  | 'less_admin' 
  | 'more_lawns';

export interface ScreenshotConfig {
  id: string;
  journeyStage: JourneyStage;
  persona: Persona;
  route: string;
  screenTitle: string;
  waitFor: string | null;
  agentsInvolved: string[];
  valueDrivers: ValueDriver[];
  descriptionShort: string;
  descriptionLong: string;
  inputs: string[];
  outputs: string[];
  escalationOrApproval: string;
  notImplemented?: boolean;
}

export interface PersonaConfig {
  email: string;
  password: string;
  role: string;
  displayName: string;
}

export interface ScreenshotPlan {
  settings: {
    baseUrl: string;
    viewport: { width: number; height: number };
    outputDir: string;
    screenshotDir: string;
  };
  personas: Record<Persona, PersonaConfig>;
  screenshots: ScreenshotConfig[];
}

export interface ManifestEntry {
  id: string;
  journeyStage: JourneyStage;
  persona: Persona;
  route: string;
  screenTitle: string;
  descriptionShort: string;
  descriptionLong: string;
  agentsInvolved: string[];
  valueDrivers: ValueDriver[];
  inputs: string[];
  outputs: string[];
  escalationOrApproval: string;
  imagePath: string;
  capturedAt: string;
  status: 'captured' | 'placeholder' | 'not_implemented';
}

export interface Manifest {
  generatedAt: string;
  appVersion: string;
  totalScreenshots: number;
  byStage: Record<JourneyStage, number>;
  byPersona: Record<Persona, number>;
  entries: ManifestEntry[];
}
