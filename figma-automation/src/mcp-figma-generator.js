import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * LawnFlow Figma Generator using MCP Figma Extension
 * Generates complete Figma file from UX metadata JSON
 */
export class MCPFigmaGenerator {
  constructor(metadataPath) {
    this.metadataPath = metadataPath;
    this.metadata = null;
    this.theme = null;
    this.componentMappings = null;
    this.fileKey = null;
    this.nodeIdMap = new Map(); // Track created nodes
  }

  /**
   * Load all required configuration files
   */
  async loadConfig() {
    console.log('📦 Loading configuration...');

    // Load metadata - resolve from figma-automation/src to root
    const metadataFullPath = join(process.cwd(), this.metadataPath);
    this.metadata = JSON.parse(readFileSync(metadataFullPath, 'utf-8'));
    console.log(`  ✓ Loaded metadata: ${this.metadata.screens.length} screens, ${this.metadata.components.length} components`);

    // Load theme
    const themePath = join(process.cwd(), 'config/theme.json');
    this.theme = JSON.parse(readFileSync(themePath, 'utf-8'));
    console.log(`  ✓ Loaded theme configuration`);

    // Load component mappings
    const mappingsPath = join(process.cwd(), 'config/component-mappings.json');
    this.componentMappings = JSON.parse(readFileSync(mappingsPath, 'utf-8'));
    console.log(`  ✓ Loaded component mappings`);
  }

  /**
   * Generate complete Figma file structure
   * This will output the MCP commands needed
   */
  async generate() {
    await this.loadConfig();

    console.log('\n🎨 Generating Figma file structure...\n');

    const steps = [];

    // Step 1: Create file structure
    steps.push({
      step: 1,
      action: 'CREATE_FILE',
      description: 'Create new Figma file',
      data: {
        name: 'LawnFlow Mobile App - Auto-Generated',
        pages: [
          { name: '📱 Cover & Info' },
          { name: '🎨 Component Library' },
          { name: '👤 Customer Screens' },
          { name: '👔 Owner Screens' },
          { name: '👷 Crew Leader Screens' },
          { name: '🔧 Crew Screens' },
          { name: '🔗 Navigation Flow' }
        ]
      }
    });

    // Step 2: Create component library
    steps.push({
      step: 2,
      action: 'CREATE_COMPONENTS',
      description: 'Generate reusable component library',
      data: this._buildComponentLibrary()
    });

    // Step 3: Create screen frames by role
    steps.push({
      step: 3,
      action: 'CREATE_SCREENS',
      description: 'Generate all screen frames',
      data: this._buildScreenFrames()
    });

    // Step 4: Apply styles and design tokens
    steps.push({
      step: 4,
      action: 'APPLY_STYLES',
      description: 'Apply design system styles',
      data: this._buildStyleDefinitions()
    });

    // Step 5: Link navigation flows
    steps.push({
      step: 5,
      action: 'CREATE_PROTOTYPES',
      description: 'Add interactive prototype links',
      data: this._buildPrototypeLinks()
    });

    return steps;
  }

  /**
   * Build component library structure
   */
  _buildComponentLibrary() {
    const components = [];

    for (const component of this.metadata.components) {
      components.push({
        name: component.componentName,
        description: `Reusable component from ${component.filePath}`,
        type: 'COMPONENT',
        children: this._convertLayoutTree(component.layoutTree),
        props: component.props
      });
    }

    return components;
  }

  /**
   * Build screen frames organized by role
   */
  _buildScreenFrames() {
    const screensByRole = {
      Customer: [],
      Owner: [],
      CrewLeader: [],
      Crew: []
    };

    for (const screen of this.metadata.screens) {
      const frame = {
        name: screen.screenName,
        routeKey: screen.routeKey,
        type: 'FRAME',
        width: this.theme.mobileFrames.width,
        height: this.theme.mobileFrames.height,
        backgroundColor: '#FFFFFF',
        children: screen.layoutTree.map(node => this._convertLayoutTree(node)),
        interactions: screen.interactions,
        metadata: {
          filePath: screen.filePath,
          conditional: screen.layoutTree.some(n => n.conditional)
        }
      };

      screensByRole[screen.userRole].push(frame);
    }

    return screensByRole;
  }

  /**
   * Convert metadata layout tree to Figma node structure
   */
  _convertLayoutTree(node) {
    if (!node) return null;

    const mapping = this.componentMappings.reactNativeToFigma[node.component] || {};

    const figmaNode = {
      type: mapping.figmaType || 'FRAME',
      name: node.component,
      styles: this._convertStyles(node.styles),
      props: node.props || {}
    };

    // Handle Auto Layout
    if (mapping.autoLayout && node.styles) {
      figmaNode.layoutMode = this._mapFlexDirection(node.styles.flexDirection);
      figmaNode.primaryAxisAlignItems = this._mapJustifyContent(node.styles.justifyContent);
      figmaNode.counterAxisAlignItems = this._mapAlignItems(node.styles.alignItems);
      figmaNode.itemSpacing = node.styles.gap || 0;
    }

    // Handle text content
    if (node.text) {
      figmaNode.characters = node.text;
      figmaNode.fontSize = node.styles?.fontSize || this.theme.typography.sizes.base;
      figmaNode.fontFamily = this.theme.typography.fontFamily;
    }

    // Handle conditional rendering
    if (node.conditional) {
      figmaNode.visible = false; // Create as hidden variant
      figmaNode.name += ` (Conditional: ${node.conditional})`;
    }

    // Recursively convert children
    if (node.children && node.children.length > 0) {
      figmaNode.children = node.children
        .map(child => this._convertLayoutTree(child))
        .filter(Boolean);
    }

    return figmaNode;
  }

  /**
   * Convert React Native styles to Figma format
   */
  _convertStyles(styles) {
    if (!styles) return {};

    const figmaStyles = {};

    // Layout & Sizing
    if (styles.flex !== undefined) figmaStyles.layoutGrow = styles.flex;
    if (styles.width !== undefined) figmaStyles.width = styles.width;
    if (styles.height !== undefined) figmaStyles.height = styles.height;

    // Spacing
    const padding = this._extractPadding(styles);
    Object.assign(figmaStyles, padding);

    const margin = this._extractMargin(styles);
    Object.assign(figmaStyles, margin);

    // Background
    if (styles.backgroundColor) {
      figmaStyles.fills = [{
        type: 'SOLID',
        color: this._hexToRgb(styles.backgroundColor),
        opacity: 1
      }];
    }

    // Border
    if (styles.borderRadius !== undefined) {
      figmaStyles.cornerRadius = styles.borderRadius;
    }

    if (styles.borderWidth !== undefined) {
      figmaStyles.strokeWeight = styles.borderWidth;
    }

    if (styles.borderColor) {
      figmaStyles.strokes = [{
        type: 'SOLID',
        color: this._hexToRgb(styles.borderColor)
      }];
    }

    // Typography
    if (styles.fontSize !== undefined) {
      figmaStyles.fontSize = styles.fontSize;
    }

    if (styles.fontWeight) {
      figmaStyles.fontWeight = this._mapFontWeight(styles.fontWeight);
    }

    if (styles.color) {
      figmaStyles.fills = [{
        type: 'SOLID',
        color: this._hexToRgb(styles.color)
      }];
    }

    if (styles.textAlign) {
      figmaStyles.textAlignHorizontal = styles.textAlign.toUpperCase();
    }

    // Shadow
    if (styles.shadowColor && styles.shadowOffset) {
      figmaStyles.effects = [{
        type: 'DROP_SHADOW',
        color: this._hexToRgba(styles.shadowColor, styles.shadowOpacity || 0.1),
        offset: {
          x: styles.shadowOffset.width || 0,
          y: styles.shadowOffset.height || 0
        },
        radius: styles.shadowRadius || 0
      }];
    }

    return figmaStyles;
  }

  /**
   * Extract padding values
   */
  _extractPadding(styles) {
    const padding = {};

    if (styles.padding !== undefined) {
      padding.paddingLeft = styles.padding;
      padding.paddingRight = styles.padding;
      padding.paddingTop = styles.padding;
      padding.paddingBottom = styles.padding;
    }

    if (styles.paddingHorizontal !== undefined) {
      padding.paddingLeft = styles.paddingHorizontal;
      padding.paddingRight = styles.paddingHorizontal;
    }

    if (styles.paddingVertical !== undefined) {
      padding.paddingTop = styles.paddingVertical;
      padding.paddingBottom = styles.paddingVertical;
    }

    // Individual overrides
    if (styles.paddingLeft !== undefined) padding.paddingLeft = styles.paddingLeft;
    if (styles.paddingRight !== undefined) padding.paddingRight = styles.paddingRight;
    if (styles.paddingTop !== undefined) padding.paddingTop = styles.paddingTop;
    if (styles.paddingBottom !== undefined) padding.paddingBottom = styles.paddingBottom;

    return padding;
  }

  /**
   * Extract margin values (converted to item spacing in Auto Layout)
   */
  _extractMargin(styles) {
    const margin = {};

    if (styles.marginBottom !== undefined) {
      margin.itemSpacing = styles.marginBottom;
    }

    if (styles.marginTop !== undefined) {
      margin.marginTop = styles.marginTop;
    }

    return margin;
  }

  /**
   * Map flexDirection to Figma layoutMode
   */
  _mapFlexDirection(flexDirection) {
    return this.componentMappings.flexDirectionMapping[flexDirection] || 'VERTICAL';
  }

  /**
   * Map justifyContent to Figma primary axis alignment
   */
  _mapJustifyContent(justifyContent) {
    return this.componentMappings.justifyContentMapping[justifyContent] || 'MIN';
  }

  /**
   * Map alignItems to Figma counter axis alignment
   */
  _mapAlignItems(alignItems) {
    return this.componentMappings.alignItemsMapping[alignItems] || 'CENTER';
  }

  /**
   * Map font weight
   */
  _mapFontWeight(weight) {
    return this.componentMappings.fontWeightMapping[String(weight)] || 'Regular';
  }

  /**
   * Convert hex to RGB (0-1 range for Figma)
   */
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Convert hex to RGBA
   */
  _hexToRgba(hex, alpha) {
    const rgb = this._hexToRgb(hex);
    return { ...rgb, a: alpha };
  }

  /**
   * Build style definitions for color styles, text styles, etc.
   */
  _buildStyleDefinitions() {
    return {
      colorStyles: this._buildColorStyles(),
      textStyles: this._buildTextStyles(),
      effectStyles: this._buildEffectStyles()
    };
  }

  /**
   * Build color styles from theme
   */
  _buildColorStyles() {
    const styles = [];

    // Primary colors
    for (const [name, color] of Object.entries(this.theme.colors.primary)) {
      styles.push({
        name: `Primary/${name}`,
        color: this._hexToRgb(color)
      });
    }

    // Success colors
    for (const [name, color] of Object.entries(this.theme.colors.success)) {
      styles.push({
        name: `Success/${name}`,
        color: this._hexToRgb(color)
      });
    }

    // Warning colors
    for (const [name, color] of Object.entries(this.theme.colors.warning)) {
      styles.push({
        name: `Warning/${name}`,
        color: this._hexToRgb(color)
      });
    }

    // Error colors
    for (const [name, color] of Object.entries(this.theme.colors.error)) {
      styles.push({
        name: `Error/${name}`,
        color: this._hexToRgb(color)
      });
    }

    // Neutral colors
    for (const [name, color] of Object.entries(this.theme.colors.neutral)) {
      styles.push({
        name: `Neutral/${name}`,
        color: this._hexToRgb(color)
      });
    }

    return styles;
  }

  /**
   * Build text styles from theme
   */
  _buildTextStyles() {
    const styles = [];

    for (const [sizeName, sizeValue] of Object.entries(this.theme.typography.sizes)) {
      for (const [weightName, weightValue] of Object.entries(this.theme.typography.weights)) {
        styles.push({
          name: `${sizeName}/${weightName}`,
          fontSize: sizeValue,
          fontFamily: this.theme.typography.fontFamily,
          fontWeight: weightValue,
          lineHeight: sizeValue * this.theme.typography.lineHeights.normal
        });
      }
    }

    return styles;
  }

  /**
   * Build effect styles (shadows) from theme
   */
  _buildEffectStyles() {
    const styles = [];

    for (const [name, shadow] of Object.entries(this.theme.shadows)) {
      styles.push({
        name: `Shadow/${name}`,
        type: 'DROP_SHADOW',
        color: this._hexToRgba(shadow.color, 1),
        offset: shadow.offset,
        radius: shadow.radius,
        spread: shadow.spread
      });
    }

    return styles;
  }

  /**
   * Build prototype links from navigation flows
   */
  _buildPrototypeLinks() {
    const links = [];

    for (const flow of this.metadata.uxFlowSummary.flow) {
      links.push({
        from: flow.fromScreen,
        to: flow.toScreen,
        trigger: flow.trigger,
        userRole: flow.userRole,
        transitionType: this._getTransitionType(flow.trigger),
        animation: 'SMART_ANIMATE',
        duration: 300
      });
    }

    return links;
  }

  /**
   * Get transition type based on trigger
   */
  _getTransitionType(trigger) {
    if (trigger.includes('button') || trigger.includes('press')) {
      return 'ON_CLICK';
    } else if (trigger.includes('swipe')) {
      return 'ON_DRAG';
    } else if (trigger.includes('auto')) {
      return 'AFTER_TIMEOUT';
    }
    return 'ON_CLICK';
  }

  /**
   * Generate execution plan as JSON
   */
  async generateExecutionPlan() {
    const steps = await this.generate();
    return {
      projectName: 'LawnFlow Mobile App',
      generatedAt: new Date().toISOString(),
      metadata: {
        screens: this.metadata.screens.length,
        components: this.metadata.components.length,
        flows: this.metadata.uxFlowSummary.flow.length
      },
      steps
    };
  }
}
