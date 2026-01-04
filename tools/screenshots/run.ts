#!/usr/bin/env npx tsx

/**
 * LawnFlow Screenshot Capture Tool
 * 
 * Captures screenshots of the application at key journey points,
 * generates manifest documentation, and creates a Figma-ready ZIP package.
 * 
 * Usage:
 *   npm run screenshots              # Capture with default settings
 *   npm run screenshots -- --no-redact   # Without PII redaction
 *   npm run screenshots -- --headed      # With visible browser
 */

import * as path from 'path';
import { loadPlan } from './plan-loader';
import { ScreenshotCapture } from './capture';
import { generateManifest, writeManifestJson, writeManifestMarkdown } from './manifest';
import { createFigmaPack } from './pack';

async function main() {
  console.log('='.repeat(60));
  console.log('LawnFlow.ai Screenshot Capture Tool');
  console.log('='.repeat(60));
  console.log('');

  const args = process.argv.slice(2);
  const noRedact = args.includes('--no-redact');
  const headed = args.includes('--headed');

  // Load screenshot plan
  console.log('[1/5] Loading screenshot plan...');
  const plan = loadPlan();
  console.log(`     Found ${plan.screenshots.length} screenshots to capture`);
  console.log(`     Personas: ${Object.keys(plan.personas).join(', ')}`);
  console.log('');

  // Initialize capture engine
  console.log('[2/5] Initializing browser...');
  const capture = new ScreenshotCapture(plan, {
    redact: !noRedact,
    headless: !headed,
  });
  await capture.initialize();
  console.log('');

  // Capture all screenshots
  console.log('[3/5] Capturing screenshots...');
  console.log('');
  const entries = await capture.captureAll();
  await capture.cleanup();
  
  const captured = entries.filter(e => e.status === 'captured').length;
  const placeholders = entries.filter(e => e.status === 'placeholder').length;
  const notImpl = entries.filter(e => e.status === 'not_implemented').length;
  
  console.log('');
  console.log(`     Captured: ${captured}`);
  console.log(`     Placeholders: ${placeholders}`);
  console.log(`     Not Implemented: ${notImpl}`);
  console.log('');

  // Generate manifests
  console.log('[4/5] Generating manifests...');
  const manifest = generateManifest(entries);
  
  const outputDir = path.join(process.cwd(), plan.settings.outputDir);
  const jsonPath = path.join(outputDir, 'manifest.json');
  const mdPath = path.join(outputDir, 'manifest.md');
  
  writeManifestJson(manifest, jsonPath);
  writeManifestMarkdown(manifest, mdPath);
  console.log('');

  // Create Figma pack
  console.log('[5/5] Creating Figma pack...');
  const zipPath = await createFigmaPack({
    outputDir,
    screenshotDir: plan.settings.screenshotDir,
    manifestJsonPath: jsonPath,
    manifestMdPath: mdPath,
  });
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Output: ${zipPath}`);
  console.log('');
  console.log('Contents:');
  console.log('  - screenshots/*.png');
  console.log('  - manifest.json');
  console.log('  - manifest.md');
  console.log('  - README.txt');
  console.log('');
  console.log('Next Steps:');
  console.log('  1. Download the ZIP from the exports/ directory');
  console.log('  2. Extract and drag images into Figma/FigJam');
  console.log('  3. Reference manifest.md for context and descriptions');
  console.log('');
}

main().catch((error) => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});
