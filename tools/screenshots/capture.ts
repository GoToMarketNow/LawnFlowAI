import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ScreenshotPlan, ScreenshotConfig, Persona, ManifestEntry } from './types';
import { injectRedactionStyles, buildRedactedUrl } from './redact';

interface CaptureOptions {
  redact?: boolean;
  timeout?: number;
  headless?: boolean;
}

interface CaptureResult {
  success: boolean;
  screenshotPath?: string;
  error?: string;
}

export class ScreenshotCapture {
  private browser: Browser | null = null;
  private contexts: Map<Persona, BrowserContext> = new Map();
  private plan: ScreenshotPlan;
  private outputDir: string;
  private options: CaptureOptions;
  private captureCount: number = 0;
  private readonly MAX_CAPTURES_BEFORE_RESTART = 5; // Restart browser every N captures for stability

  constructor(plan: ScreenshotPlan, options: CaptureOptions = {}) {
    this.plan = plan;
    this.options = {
      redact: true,
      timeout: 30000,
      headless: true,
      ...options,
    };
    this.outputDir = path.join(process.cwd(), plan.settings.outputDir, plan.settings.screenshotDir);
  }

  private getLaunchOptions() {
    return {
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
      ],
    };
  }

  async initialize(): Promise<void> {
    // Ensure output directory exists
    fs.mkdirSync(this.outputDir, { recursive: true });
    await this.launchBrowser();
  }

  private async launchBrowser(): Promise<void> {
    // Close existing browser if any
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore errors during close
      }
      this.browser = null;
      this.contexts.clear();
    }

    const launchOptions = this.getLaunchOptions();
    
    try {
      // First try using system chromium via channel
      this.browser = await chromium.launch({
        ...launchOptions,
        channel: 'chromium',
      });
    } catch (e) {
      console.log('[Capture] Chromium channel failed, trying bundled...');
      // Fall back to bundled Playwright chromium
      this.browser = await chromium.launch(launchOptions);
    }

    console.log('[Capture] Browser launched');
    this.captureCount = 0;
  }

  private async ensureBrowserHealth(): Promise<void> {
    // Restart browser periodically for stability in container environments
    if (this.captureCount >= this.MAX_CAPTURES_BEFORE_RESTART) {
      console.log('[Capture] Restarting browser for stability...');
      await this.launchBrowser();
    }
  }

  async getContext(persona: Persona): Promise<BrowserContext> {
    if (this.contexts.has(persona)) {
      return this.contexts.get(persona)!;
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      viewport: this.plan.settings.viewport,
    });

    // Login for this persona
    const personaConfig = this.plan.personas[persona];
    if (personaConfig) {
      await this.loginAsPersona(context, personaConfig);
    }

    this.contexts.set(persona, context);
    return context;
  }

  private async loginAsPersona(
    context: BrowserContext,
    config: { email: string; password: string }
  ): Promise<void> {
    const page = await context.newPage();
    const baseUrl = this.plan.settings.baseUrl;

    try {
      // Try dev login bypass first
      const devLoginUrl = `${baseUrl}/dev/login?email=${encodeURIComponent(config.email)}`;
      console.log(`[Capture] Attempting dev login for ${config.email}`);
      
      await page.goto(devLoginUrl, { waitUntil: 'networkidle', timeout: 10000 });
      
      // Check if we're logged in by looking for dashboard or authenticated state
      const url = page.url();
      if (url.includes('/dashboard') || url.includes('/inbox') || !url.includes('/login')) {
        console.log(`[Capture] Dev login successful for ${config.email}`);
        await page.close();
        return;
      }
    } catch (e) {
      console.log(`[Capture] Dev login not available, trying regular auth`);
    }

    // Fall back to regular login flow
    try {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 15000 });
      
      // Fill login form
      await page.fill('[data-testid="input-phone"], input[name="phone"], input[type="tel"]', config.email);
      await page.click('[data-testid="button-submit"], button[type="submit"]');
      
      // Wait for navigation or OTP step
      await page.waitForTimeout(2000);
      
      console.log(`[Capture] Login flow initiated for ${config.email}`);
    } catch (e) {
      console.log(`[Capture] Login may have failed for ${config.email}: ${e}`);
    }

    await page.close();
  }

  async captureScreenshot(config: ScreenshotConfig): Promise<CaptureResult> {
    const { id, persona, route, waitFor, notImplemented } = config;

    // Handle not-implemented screens
    if (notImplemented) {
      return this.createPlaceholder(config);
    }

    try {
      // Ensure browser is healthy before capture
      await this.ensureBrowserHealth();
      
      const context = await this.getContext(persona);
      const page = await context.newPage();

      const url = buildRedactedUrl(
        this.plan.settings.baseUrl,
        route,
        this.options.redact || false
      );

      console.log(`[Capture] Navigating to ${url} for ${id}`);
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: this.options.timeout 
      });

      // Apply redaction styles if enabled
      if (this.options.redact) {
        await injectRedactionStyles(page);
      }

      // Wait for specific selector if defined
      if (waitFor) {
        try {
          await page.waitForSelector(waitFor, { timeout: 10000 });
          console.log(`[Capture] Found selector: ${waitFor}`);
        } catch (e) {
          console.log(`[Capture] Warning: selector not found: ${waitFor}`);
        }
      }

      // Wait for fonts and animations to settle
      await page.waitForTimeout(1000);

      // Capture screenshot
      const filename = `${id}.png`;
      const screenshotPath = path.join(this.outputDir, filename);

      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        type: 'png',
      });

      console.log(`[Capture] Saved: ${filename}`);
      await page.close();
      this.captureCount++;

      return {
        success: true,
        screenshotPath: path.join(this.plan.settings.screenshotDir, filename),
      };
    } catch (error: any) {
      console.error(`[Capture] Failed to capture ${id}: ${error.message}`);
      // If browser crashed, try to restart it
      if (error.message.includes('closed') || error.message.includes('Protocol error')) {
        console.log('[Capture] Browser crashed, will restart on next capture');
        this.captureCount = this.MAX_CAPTURES_BEFORE_RESTART; // Force restart
      }
      return this.createPlaceholder(config, error.message);
    }
  }

  private createPlaceholder(config: ScreenshotConfig, error?: string): CaptureResult {
    const filename = `${config.id}_placeholder.png`;
    const screenshotPath = path.join(this.outputDir, filename);

    // Create a simple placeholder image using Canvas (if available) or just return status
    console.log(`[Capture] Created placeholder for ${config.id}`);

    return {
      success: false,
      screenshotPath: path.join(this.plan.settings.screenshotDir, filename),
      error: error || 'Not implemented',
    };
  }

  async captureAll(): Promise<ManifestEntry[]> {
    const entries: ManifestEntry[] = [];

    for (const config of this.plan.screenshots) {
      const result = await this.captureScreenshot(config);

      entries.push({
        id: config.id,
        journeyStage: config.journeyStage,
        persona: config.persona,
        route: config.route,
        screenTitle: config.screenTitle,
        descriptionShort: config.descriptionShort || 'TODO: Add description',
        descriptionLong: config.descriptionLong || 'TODO: Add detailed description',
        agentsInvolved: config.agentsInvolved,
        valueDrivers: config.valueDrivers,
        inputs: config.inputs,
        outputs: config.outputs,
        escalationOrApproval: config.escalationOrApproval,
        imagePath: result.screenshotPath || '',
        capturedAt: new Date().toISOString(),
        status: result.success ? 'captured' : config.notImplemented ? 'not_implemented' : 'placeholder',
      });
    }

    return entries;
  }

  async cleanup(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    console.log('[Capture] Browser closed');
  }
}
