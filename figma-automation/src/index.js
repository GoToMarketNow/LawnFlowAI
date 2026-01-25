#!/usr/bin/env node

import { MCPFigmaGenerator } from './mcp-figma-generator.js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main entry point for LawnFlow Figma generation
 */
async function main() {
  console.log('🎨 LawnFlow Figma Auto-Generator\n');
  console.log('━'.repeat(60));

  try {
    // Initialize generator
    const metadataPath = '../figma-ux-metadata.json';
    const generator = new MCPFigmaGenerator(metadataPath);

    // Generate execution plan
    console.log('\n📋 Generating execution plan...\n');
    const plan = await generator.generateExecutionPlan();

    // Output plan to console
    console.log('━'.repeat(60));
    console.log('📊 GENERATION SUMMARY');
    console.log('━'.repeat(60));
    console.log(`Project: ${plan.projectName}`);
    console.log(`Generated: ${plan.generatedAt}`);
    console.log(`\nMetadata:`);
    console.log(`  • Screens: ${plan.metadata.screens}`);
    console.log(`  • Components: ${plan.metadata.components}`);
    console.log(`  • Navigation Flows: ${plan.metadata.flows}`);
    console.log('\n━'.repeat(60));
    console.log('📝 EXECUTION STEPS');
    console.log('━'.repeat(60));

    for (const step of plan.steps) {
      console.log(`\n${step.step}. ${step.action}`);
      console.log(`   ${step.description}`);

      if (step.action === 'CREATE_COMPONENTS') {
        console.log(`   → ${step.data.length} components to create`);
      } else if (step.action === 'CREATE_SCREENS') {
        console.log(`   → Customer: ${step.data.Customer.length} screens`);
        console.log(`   → Owner: ${step.data.Owner.length} screens`);
        console.log(`   → CrewLeader: ${step.data.CrewLeader.length} screens`);
        console.log(`   → Crew: ${step.data.Crew.length} screens`);
      } else if (step.action === 'APPLY_STYLES') {
        console.log(`   → ${step.data.colorStyles.length} color styles`);
        console.log(`   → ${step.data.textStyles.length} text styles`);
        console.log(`   → ${step.data.effectStyles.length} effect styles`);
      } else if (step.action === 'CREATE_PROTOTYPES') {
        console.log(`   → ${step.data.length} navigation links`);
      }
    }

    // Save execution plan to file
    const outputPath = join(__dirname, '../output/execution-plan.json');
    writeFileSync(outputPath, JSON.stringify(plan, null, 2));
    console.log(`\n✅ Execution plan saved to: ${outputPath}`);

    // Save human-readable summary
    const summaryPath = join(__dirname, '../output/generation-summary.md');
    const summary = generateMarkdownSummary(plan);
    writeFileSync(summaryPath, summary);
    console.log(`✅ Summary saved to: ${summaryPath}`);

    console.log('\n━'.repeat(60));
    console.log('🎯 NEXT STEPS');
    console.log('━'.repeat(60));
    console.log('\nTo execute this plan in Figma:');
    console.log('\n1. Option A: Use MCP Figma Extension');
    console.log('   • Use the MCP tools to create nodes from execution-plan.json');
    console.log('   • The plan contains all Figma node structures ready to use');
    console.log('\n2. Option B: Manual Import via Figma Plugin');
    console.log('   • Use a JSON-to-Figma plugin to import the structure');
    console.log('   • Recommended: "JSON to Figma" or custom plugin');
    console.log('\n3. Option C: Generate Figma REST API calls');
    console.log('   • Convert the plan to REST API requests');
    console.log('   • Requires Figma API token');
    console.log('\n━'.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Generate markdown summary
 */
function generateMarkdownSummary(plan) {
  let md = `# LawnFlow Figma Generation Summary\n\n`;
  md += `**Generated:** ${plan.generatedAt}\n\n`;
  md += `## Project Overview\n\n`;
  md += `- **Project Name:** ${plan.projectName}\n`;
  md += `- **Total Screens:** ${plan.metadata.screens}\n`;
  md += `- **Reusable Components:** ${plan.metadata.components}\n`;
  md += `- **Navigation Flows:** ${plan.metadata.flows}\n\n`;

  md += `## Execution Steps\n\n`;

  for (const step of plan.steps) {
    md += `### Step ${step.step}: ${step.action}\n\n`;
    md += `${step.description}\n\n`;

    if (step.action === 'CREATE_FILE') {
      md += `**Pages to create:**\n`;
      for (const page of step.data.pages) {
        md += `- ${page.name}\n`;
      }
      md += `\n`;
    }

    if (step.action === 'CREATE_COMPONENTS') {
      md += `**Component Library (${step.data.length} components):**\n`;
      for (const comp of step.data) {
        md += `- **${comp.name}**\n`;
      }
      md += `\n`;
    }

    if (step.action === 'CREATE_SCREENS') {
      md += `**Screens by Role:**\n\n`;
      md += `- **Customer:** ${step.data.Customer.length} screens\n`;
      for (const screen of step.data.Customer) {
        md += `  - ${screen.name} (${screen.routeKey})\n`;
      }
      md += `\n- **Owner:** ${step.data.Owner.length} screens\n`;
      for (const screen of step.data.Owner) {
        md += `  - ${screen.name} (${screen.routeKey})\n`;
      }
      md += `\n- **Crew Leader:** ${step.data.CrewLeader.length} screens\n`;
      for (const screen of step.data.CrewLeader) {
        md += `  - ${screen.name} (${screen.routeKey})\n`;
      }
      md += `\n- **Crew:** ${step.data.Crew.length} screens\n`;
      for (const screen of step.data.Crew) {
        md += `  - ${screen.name} (${screen.routeKey})\n`;
      }
      md += `\n`;
    }

    if (step.action === 'APPLY_STYLES') {
      md += `**Design System:**\n`;
      md += `- Color Styles: ${step.data.colorStyles.length}\n`;
      md += `- Text Styles: ${step.data.textStyles.length}\n`;
      md += `- Effect Styles: ${step.data.effectStyles.length}\n\n`;
    }

    if (step.action === 'CREATE_PROTOTYPES') {
      md += `**Navigation Links:** ${step.data.length} interactions\n\n`;
      md += `Sample flows:\n`;
      for (const link of step.data.slice(0, 5)) {
        md += `- ${link.from} → ${link.to} (${link.trigger})\n`;
      }
      if (step.data.length > 5) {
        md += `- ... and ${step.data.length - 5} more\n`;
      }
      md += `\n`;
    }
  }

  md += `## Implementation Options\n\n`;
  md += `### Option 1: MCP Figma Extension ✅ Recommended\n\n`;
  md += `Use the configured MCP Figma tools to directly create nodes:\n\n`;
  md += `\`\`\`bash\n`;
  md += `# The execution plan is ready at:\n`;
  md += `# figma-automation/output/execution-plan.json\n`;
  md += `# Use MCP tools to process each step\n`;
  md += `\`\`\`\n\n`;

  md += `### Option 2: Manual Figma Plugin\n\n`;
  md += `1. Install "JSON to Figma" plugin in Figma\n`;
  md += `2. Load the execution-plan.json\n`;
  md += `3. Run the import\n\n`;

  md += `### Option 3: REST API Integration\n\n`;
  md += `Convert the execution plan to Figma REST API calls using:\n`;
  md += `- File creation endpoint\n`;
  md += `- Node creation endpoints\n`;
  md += `- Style creation endpoints\n\n`;

  md += `## Design System Reference\n\n`;
  md += `**Color Palette:**\n`;
  md += `- Primary: #3B82F6 (Blue)\n`;
  md += `- Success: #22C55E (Green)\n`;
  md += `- Warning: #F59E0B (Amber)\n`;
  md += `- Error: #EF4444 (Red)\n\n`;

  md += `**Typography:**\n`;
  md += `- Font Family: Inter\n`;
  md += `- Sizes: 10px - 32px\n`;
  md += `- Weights: Regular (400), Medium (500), SemiBold (600), Bold (700)\n\n`;

  md += `**Mobile Frame:**\n`;
  md += `- Device: iPhone 13 Pro\n`;
  md += `- Dimensions: 375 x 812 px\n`;
  md += `- Status Bar: 44px\n`;
  md += `- Bottom Safe Area: 34px\n\n`;

  return md;
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { main };
