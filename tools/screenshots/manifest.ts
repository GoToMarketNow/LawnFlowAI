import * as fs from 'fs';
import * as path from 'path';
import { Manifest, ManifestEntry, JourneyStage, Persona } from './types';

const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  LEAD: 'Lead Capture',
  QUALIFY: 'Lead Qualification',
  QUOTE: 'Quote Generation',
  SCHEDULE: 'Scheduling',
  SERVICE_DELIVERY: 'Service Delivery',
  INVOICE_COLLECT: 'Invoice & Collection',
  ONGOING_COMMS: 'Ongoing Communications',
  AGENT_DIRECTORY: 'AI Agents Directory',
  SETTINGS: 'Settings & Configuration',
};

const PERSONA_LABELS: Record<Persona, string> = {
  owner_admin: 'Business Owner/Admin',
  crew_lead: 'Crew Lead',
  crew_member: 'Crew Member',
};

export function generateManifest(entries: ManifestEntry[]): Manifest {
  const byStage: Record<JourneyStage, number> = {} as Record<JourneyStage, number>;
  const byPersona: Record<Persona, number> = {} as Record<Persona, number>;

  for (const entry of entries) {
    byStage[entry.journeyStage] = (byStage[entry.journeyStage] || 0) + 1;
    byPersona[entry.persona] = (byPersona[entry.persona] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    appVersion: '1.0.0-mvp',
    totalScreenshots: entries.length,
    byStage,
    byPersona,
    entries,
  };
}

export function writeManifestJson(manifest: Manifest, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`[Manifest] Written JSON to ${outputPath}`);
}

export function writeManifestMarkdown(manifest: Manifest, outputPath: string): void {
  const lines: string[] = [];

  lines.push('# LawnFlow.ai Screenshot Manifest');
  lines.push('');
  lines.push(`**Generated:** ${new Date(manifest.generatedAt).toLocaleString()}`);
  lines.push(`**App Version:** ${manifest.appVersion}`);
  lines.push(`**Total Screenshots:** ${manifest.totalScreenshots}`);
  lines.push('');

  lines.push('## Summary by Journey Stage');
  lines.push('');
  lines.push('| Stage | Count |');
  lines.push('|-------|-------|');
  for (const [stage, count] of Object.entries(manifest.byStage)) {
    const label = JOURNEY_STAGE_LABELS[stage as JourneyStage] || stage;
    lines.push(`| ${label} | ${count} |`);
  }
  lines.push('');

  lines.push('## Summary by Persona');
  lines.push('');
  lines.push('| Persona | Count |');
  lines.push('|---------|-------|');
  for (const [persona, count] of Object.entries(manifest.byPersona)) {
    const label = PERSONA_LABELS[persona as Persona] || persona;
    lines.push(`| ${label} | ${count} |`);
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Screenshots');
  lines.push('');

  // Group by stage
  const byStage: Record<string, ManifestEntry[]> = {};
  for (const entry of manifest.entries) {
    if (!byStage[entry.journeyStage]) {
      byStage[entry.journeyStage] = [];
    }
    byStage[entry.journeyStage].push(entry);
  }

  for (const [stage, stageEntries] of Object.entries(byStage)) {
    const stageLabel = JOURNEY_STAGE_LABELS[stage as JourneyStage] || stage;
    lines.push(`### ${stageLabel}`);
    lines.push('');

    for (const entry of stageEntries) {
      const personaLabel = PERSONA_LABELS[entry.persona] || entry.persona;
      const statusBadge = entry.status === 'captured' ? '' : 
                          entry.status === 'not_implemented' ? ' [NOT IMPLEMENTED]' : 
                          ' [PLACEHOLDER]';
      
      lines.push(`#### ${entry.screenTitle}${statusBadge}`);
      lines.push('');
      lines.push(`**ID:** \`${entry.id}\``);
      lines.push(`**Route:** \`${entry.route}\``);
      lines.push(`**Persona:** ${personaLabel}`);
      lines.push(`**Image:** \`${entry.imagePath}\``);
      lines.push('');
      
      if (entry.descriptionShort.includes('TODO')) {
        lines.push(`> TODO: ${entry.descriptionShort}`);
      } else {
        lines.push(`> ${entry.descriptionShort}`);
      }
      lines.push('');
      
      lines.push('**Description:**');
      lines.push('');
      lines.push(entry.descriptionLong);
      lines.push('');

      lines.push('**Agents Involved:** ' + entry.agentsInvolved.join(', '));
      lines.push('');

      lines.push('**Value Drivers:** ' + entry.valueDrivers.map(v => `\`${v}\``).join(', '));
      lines.push('');

      lines.push('**Inputs:**');
      for (const input of entry.inputs) {
        lines.push(`- ${input}`);
      }
      lines.push('');

      lines.push('**Outputs:**');
      for (const output of entry.outputs) {
        lines.push(`- ${output}`);
      }
      lines.push('');

      lines.push('**Escalation/Approval:**');
      lines.push(`> ${entry.escalationOrApproval}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`[Manifest] Written Markdown to ${outputPath}`);
}
