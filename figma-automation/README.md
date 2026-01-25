# LawnFlow Figma Automation

Automated Figma file generation from React Native UX metadata for the LawnFlow mobile app.

## Overview

This automation tool reads the extracted UX metadata JSON and generates a complete Figma file with:
- ✅ Screen frames for all user roles (Customer, Owner, Crew Leader, Crew)
- ✅ Auto Layout containers matching React Native flexbox
- ✅ Reusable component library
- ✅ Interactive prototypes with navigation flows
- ✅ Role-based variants for adaptive screens

## Prerequisites

1. **Figma Account**: You need a Figma account (free or paid)
2. **Personal Access Token**: Generate one at https://www.figma.com/developers/api#access-tokens
3. **Node.js**: Version 18+ required

## Setup

### 1. Install Dependencies

```bash
cd figma-automation
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Figma Personal Access Token:

```
FIGMA_ACCESS_TOKEN=figd_your_token_here
```

### 3. Validate Metadata

Before generating, validate your metadata structure:

```bash
npm run validate
```

## Usage

### Generate Complete Figma File

```bash
npm run generate
```

This will:
1. Load the UX metadata from `../figma-ux-metadata.json`
2. Create/update a Figma file
3. Generate all screens organized by user role
4. Create a component library
5. Add navigation prototype links
6. Output the Figma file URL

### Preview Structure (Dry Run)

Preview what will be generated without making API calls:

```bash
npm run preview
```

## Generated Structure

```
LawnFlow Mobile App (Figma File)
├── 📄 Cover Page
├── 🎨 Component Library
│   ├── LoadingSpinner
│   ├── NotificationBanner
│   ├── JobCard
│   ├── ReminderBanner
│   ├── QAPhotoViewer
│   ├── ServiceCard
│   ├── NotificationCard
│   └── JobActionsPanel
├── 👤 Customer Screens
│   ├── InviteLoginScreen
│   ├── HomeScreen
│   ├── JobsScreen
│   ├── JobDetailScreen
│   ├── ReviewPromptScreen
│   ├── ServiceCatalogScreen
│   ├── RequestServiceScreen
│   ├── ServiceRequestDetailScreen
│   ├── NotificationCenterScreen
│   └── SettingsScreen
├── 👔 Owner Screens
│   └── DashboardScreen (Owner Variant)
├── 👷 Crew Leader Screens
│   └── DashboardScreen (Crew Leader Variant)
├── 🔧 Crew Screens
│   └── DashboardScreen (Crew Variant)
└── 🔗 Navigation Flow Diagram
```

## Architecture

### Core Modules

| Module | Purpose |
|--------|---------|
| `index.js` | Main orchestration and CLI |
| `figma-client.js` | Figma API wrapper |
| `component-mapper.js` | Maps React Native components to Figma nodes |
| `layout-converter.js` | Converts flexbox to Auto Layout |
| `frame-generator.js` | Generates screen frames |
| `component-library.js` | Creates reusable components |
| `prototype-linker.js` | Adds interactive navigation |
| `style-converter.js` | Maps RN styles to Figma styles |

### Data Flow

```
figma-ux-metadata.json
        ↓
[Validate Metadata]
        ↓
[Load & Parse JSON]
        ↓
[Generate Component Library] → Figma Components
        ↓
[Generate Screen Frames] → Figma Frames with Auto Layout
        ↓
[Link Navigation Flows] → Prototype Interactions
        ↓
[Publish to Figma] → URL Output
```

## Customization

### Modify Component Mappings

Edit `src/config/component-mappings.json` to customize how React Native components map to Figma:

```json
{
  "View": {
    "figmaType": "FRAME",
    "autoLayout": true
  },
  "Text": {
    "figmaType": "TEXT",
    "defaultFont": "Inter"
  }
}
```

### Style Theme

Edit `src/config/theme.json` to define your design system:

```json
{
  "colors": {
    "primary": "#3B82F6",
    "success": "#22C55E",
    "error": "#EF4444"
  },
  "typography": {
    "fontFamily": "Inter",
    "sizes": { ... }
  }
}
```

## API Rate Limits

- Figma API has rate limits: 1000 requests/minute
- This tool uses batching to stay within limits
- Large files may take 2-5 minutes to generate

## Troubleshooting

### "Invalid token" error
- Verify your token in `.env`
- Regenerate token if expired

### "Permission denied" error
- Ensure your Figma account has edit permissions
- Check file isn't locked by another user

### Layout issues
- Verify metadata JSON is valid (`npm run validate`)
- Check that all style values are numbers, not strings

## Advanced Usage

### Generate for Specific Role Only

```bash
ROLE_FILTER=Customer npm run generate
```

### Update Existing File

```bash
FIGMA_FILE_KEY=your_file_key npm run generate
```

### Export as JSON (no Figma API call)

```bash
npm run preview > output/preview.json
```

## Contributing

To extend this tool:
1. Add new converters in `src/converters/`
2. Update component mappings in `src/config/`
3. Test with `npm run validate` and `npm run preview`

## Resources

- [Figma API Documentation](https://www.figma.com/developers/api)
- [figma-js Library](https://github.com/jongold/figma-js)
- [LawnFlow UX Metadata Schema](../figma-ux-metadata.json)

## License

MIT
