# LawnFlow Screenshot Export Tool

A CLI tool for capturing screenshots of the LawnFlow application at key journey points, generating documentation manifests, and creating Figma-ready export packages.

## Quick Start

```bash
# Full pipeline: seed demo data + capture screenshots
npx tsx tools/seed/demo.ts && npx tsx tools/screenshots/run.ts

# Just capture screenshots (assumes app is running with data)
npx tsx tools/screenshots/run.ts

# Capture without PII redaction (for internal use)
npx tsx tools/screenshots/run.ts --no-redact

# Capture with visible browser (for debugging)
npx tsx tools/screenshots/run.ts --headed
```

## Output

Running the tool creates:

```
exports/
├── screenshots/           # All captured PNG images
│   ├── dashboard_overview.png
│   ├── inbox_unified.png
│   └── ...
├── manifest.json          # Machine-readable metadata
├── manifest.md            # Human-readable documentation
└── lawnflow-figma-pack-YYYYMMDD.zip  # Complete package for Figma
```

## Configuration

Edit `tools/screenshots/screenshot-plan.yaml` to customize what gets captured.

### Screenshot Entry Structure

```yaml
- id: lead_inbox_owner              # Unique identifier
  journeyStage: LEAD                # Stage in customer journey
  persona: owner_admin              # Which user type sees this
  route: /leads                     # URL route to capture
  screenTitle: "Leads Inbox"        # Display name
  waitFor: "[data-testid='leads-inbox']"  # Selector to wait for
  agentsInvolved: ["LeadAgent"]     # AI agents shown
  valueDrivers: ["less_admin"]      # Business value flags
  descriptionShort: "Brief desc"    # 1-2 line summary
  descriptionLong: |                # Detailed description
    Multi-line description for
    Figma documentation.
  inputs: ["lead message"]          # What goes in
  outputs: ["next action"]          # What comes out
  escalationOrApproval: "..."       # Human-in-loop triggers
```

### Journey Stages

| Stage | Description |
|-------|-------------|
| LEAD | Initial customer contact |
| QUALIFY | Lead qualification |
| QUOTE | Price estimation |
| SCHEDULE | Job scheduling |
| SERVICE_DELIVERY | Field work execution |
| INVOICE_COLLECT | Billing and payment |
| ONGOING_COMMS | Retention and upsells |
| AGENT_DIRECTORY | AI agents catalog |
| SETTINGS | Configuration |

### Personas

| Persona | Description |
|---------|-------------|
| owner_admin | Business owner with full access |
| crew_lead | Field supervisor |
| crew_member | Field worker |

### Value Drivers

| Flag | Meaning |
|------|---------|
| happier_customers | Improves customer experience |
| productive_crews | Increases crew efficiency |
| higher_profit | Improves margins |
| less_admin | Reduces manual work |
| more_lawns | Grows customer base |

## PII Redaction

By default, screenshots are captured with PII redaction enabled:

- Phone numbers masked as `***-***-****`
- Email addresses masked as `***@***.com`
- Customer names blurred
- Street addresses blurred
- Message content blurred

This makes screenshots safe for external presentations.

To disable redaction (for internal use only):
```bash
npm run screenshots -- --no-redact
```

## Adding New Screenshots

1. Add entry to `screenshot-plan.yaml`
2. Ensure the route has proper `data-testid` attributes for the `waitFor` selector
3. Run `npm run screenshots`

## Placeholder Screens

If a screen isn't implemented yet, add `notImplemented: true`:

```yaml
- id: future_feature
  notImplemented: true
  # ... rest of config
```

These will be marked as "Not Implemented" in the manifest.

## Uploading to Figma/FigJam

1. Download the ZIP from `exports/`
2. Extract the contents
3. Drag images from `screenshots/` into your Figma canvas
4. Reference `manifest.md` for descriptions and context
5. Use the README.txt in the ZIP for layout suggestions

## Troubleshooting

### App Not Running
The tool expects the app to be running at `http://localhost:5000`. Start it with:
```bash
npm run dev
```

### Login Issues
The tool uses `/dev/login?email=<email>` for authentication bypass. This only works when `NODE_ENV !== 'production'`.

### Missing Selectors
If `waitFor` selectors aren't found, screenshots are still captured but may show incomplete content. Check the console output for warnings.

### Browser Errors
Run with `--headed` to see what's happening:
```bash
npm run screenshots -- --headed
```

## Files

```
tools/
├── screenshots/
│   ├── run.ts           # Main entry point
│   ├── capture.ts       # Playwright capture logic
│   ├── plan-loader.ts   # YAML config loader
│   ├── manifest.ts      # JSON/MD generator
│   ├── redact.ts        # PII masking
│   ├── pack.ts          # ZIP creator
│   ├── types.ts         # TypeScript types
│   └── screenshot-plan.yaml  # Screenshot config
└── seed/
    └── demo.ts          # Demo data seeder
```
