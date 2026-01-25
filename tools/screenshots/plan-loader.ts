import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { ScreenshotPlan } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadPlan(planPath?: string): ScreenshotPlan {
  const defaultPath = path.join(__dirname, 'screenshot-plan.yaml');
  const filePath = planPath || defaultPath;
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Screenshot plan not found at: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const plan = yaml.load(content) as ScreenshotPlan;
  
  // Validate required fields
  if (!plan.settings?.baseUrl) {
    throw new Error('Plan must include settings.baseUrl');
  }
  
  if (!plan.screenshots || plan.screenshots.length === 0) {
    throw new Error('Plan must include at least one screenshot');
  }
  
  // Fill in defaults
  plan.settings.viewport = plan.settings.viewport || { width: 1440, height: 900 };
  plan.settings.outputDir = plan.settings.outputDir || 'exports';
  plan.settings.screenshotDir = plan.settings.screenshotDir || 'screenshots';
  
  return plan;
}

export function getScreenshotsByPersona(plan: ScreenshotPlan) {
  const grouped: Record<string, typeof plan.screenshots> = {};
  
  for (const screenshot of plan.screenshots) {
    const persona = screenshot.persona;
    if (!grouped[persona]) {
      grouped[persona] = [];
    }
    grouped[persona].push(screenshot);
  }
  
  return grouped;
}

export function getScreenshotsByStage(plan: ScreenshotPlan) {
  const grouped: Record<string, typeof plan.screenshots> = {};
  
  for (const screenshot of plan.screenshots) {
    const stage = screenshot.journeyStage;
    if (!grouped[stage]) {
      grouped[stage] = [];
    }
    grouped[stage].push(screenshot);
  }
  
  return grouped;
}
