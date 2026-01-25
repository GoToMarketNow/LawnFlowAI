import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

export interface PackOptions {
  outputDir: string;
  screenshotDir: string;
  manifestJsonPath: string;
  manifestMdPath: string;
}

export async function createFigmaPack(options: PackOptions): Promise<string> {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const zipFilename = `lawnflow-figma-pack-${timestamp}.zip`;
  const zipPath = path.join(options.outputDir, zipFilename);

  // Create output directory if it doesn't exist
  fs.mkdirSync(options.outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver.default('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      const sizeKb = Math.round(archive.pointer() / 1024);
      console.log(`[Pack] Created ${zipFilename} (${sizeKb} KB)`);
      resolve(zipPath);
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    // Add screenshots directory
    const screenshotsPath = path.join(options.outputDir, options.screenshotDir);
    if (fs.existsSync(screenshotsPath)) {
      archive.directory(screenshotsPath, 'screenshots');
    }

    // Add manifest files
    if (fs.existsSync(options.manifestJsonPath)) {
      archive.file(options.manifestJsonPath, { name: 'manifest.json' });
    }

    if (fs.existsSync(options.manifestMdPath)) {
      archive.file(options.manifestMdPath, { name: 'manifest.md' });
    }

    // Add a README for Figma import
    const figmaReadme = `# LawnFlow.ai Figma Pack

## Contents
- /screenshots/ - All captured screen images
- manifest.json - Machine-readable manifest with full metadata
- manifest.md - Human-readable documentation

## How to Use in Figma/FigJam

### Option 1: Drag and Drop
1. Open your Figma/FigJam file
2. Extract this ZIP
3. Drag all images from /screenshots/ into your canvas
4. Reference manifest.md for descriptions and context

### Option 2: Frame Import Plugin
1. Install the "Insert Big Image" or similar plugin
2. Import images maintaining their original dimensions
3. Arrange by journey stage using manifest.md as guide

## Journey Stages (Recommended Layout)
1. LEAD - Top left
2. QUALIFY - Below Lead
3. QUOTE - Center top
4. SCHEDULE - Center
5. SERVICE_DELIVERY - Center bottom
6. INVOICE_COLLECT - Right top
7. ONGOING_COMMS - Right center
8. AGENT_DIRECTORY - Bottom right
9. SETTINGS - Bottom

## Personas (Color Coding Suggestion)
- owner_admin: Green border
- crew_lead: Blue border  
- crew_member: Orange border

## Value Drivers (Tag Colors)
- happier_customers: Pink
- productive_crews: Blue
- higher_profit: Green
- less_admin: Yellow
- more_lawns: Purple

Generated: ${new Date().toISOString()}
`;

    archive.append(figmaReadme, { name: 'README.txt' });

    archive.finalize();
  });
}
