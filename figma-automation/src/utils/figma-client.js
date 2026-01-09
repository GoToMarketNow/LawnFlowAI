import Figma from 'figma-js';

/**
 * Figma API Client Wrapper
 * Handles authentication and API requests with rate limiting
 */
export class FigmaClient {
  constructor(accessToken) {
    if (!accessToken) {
      throw new Error('Figma access token is required');
    }
    this.client = Figma.Client({ personalAccessToken: accessToken });
    this.requestQueue = [];
    this.requestsThisMinute = 0;
    this.rateLimitMax = 900; // Stay under 1000/min limit
  }

  /**
   * Create a new Figma file
   */
  async createFile(fileName) {
    console.log(`Creating new Figma file: ${fileName}...`);

    // Note: figma-js doesn't have direct file creation
    // This would require REST API call
    const response = await this._makeRequest('POST', 'https://api.figma.com/v1/files', {
      name: fileName
    });

    return response;
  }

  /**
   * Get file information
   */
  async getFile(fileKey) {
    console.log(`Fetching file: ${fileKey}...`);
    return await this.client.file(fileKey);
  }

  /**
   * Get file nodes
   */
  async getFileNodes(fileKey, nodeIds) {
    console.log(`Fetching nodes from file: ${fileKey}...`);
    return await this.client.fileNodes(fileKey, { ids: nodeIds });
  }

  /**
   * Post comment to file
   */
  async postComment(fileKey, message, position) {
    return await this.client.postComment(fileKey, message, position);
  }

  /**
   * Get team projects
   */
  async getTeamProjects(teamId) {
    return await this.client.teamProjects(teamId);
  }

  /**
   * Raw API request with rate limiting
   */
  async _makeRequest(method, url, body = null) {
    await this._checkRateLimit();

    const options = {
      method,
      headers: {
        'X-Figma-Token': this.client.personalAccessToken,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Figma API Error: ${error.message || response.statusText}`);
    }

    this.requestsThisMinute++;
    return await response.json();
  }

  /**
   * Rate limiting check
   */
  async _checkRateLimit() {
    if (this.requestsThisMinute >= this.rateLimitMax) {
      console.log('Rate limit approaching, waiting 60 seconds...');
      await this._sleep(60000);
      this.requestsThisMinute = 0;
    }
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build Figma node structure from metadata
   * Note: Figma REST API doesn't support direct node creation
   * This generates the structure that would be manually created or via plugin
   */
  buildNodeStructure(layoutTree, theme) {
    const nodes = [];

    const traverse = (node, parentId = null) => {
      const figmaNode = this._convertToFigmaNode(node, theme);
      figmaNode.id = this._generateNodeId();
      figmaNode.parent = parentId;

      nodes.push(figmaNode);

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, figmaNode.id));
      }
    };

    traverse(layoutTree);
    return nodes;
  }

  /**
   * Convert metadata node to Figma node format
   */
  _convertToFigmaNode(node, theme) {
    const figmaNode = {
      type: this._getNodeType(node.component),
      name: node.component,
      styles: this._convertStyles(node.styles, theme),
      props: node.props || {}
    };

    // Add text content if present
    if (node.text) {
      figmaNode.characters = node.text;
    }

    return figmaNode;
  }

  /**
   * Get Figma node type from component
   */
  _getNodeType(component) {
    const typeMap = {
      'View': 'FRAME',
      'ScrollView': 'FRAME',
      'Text': 'TEXT',
      'Image': 'RECTANGLE',
      'TouchableOpacity': 'FRAME',
      'TextInput': 'FRAME',
      'ActivityIndicator': 'ELLIPSE',
      'FlatList': 'FRAME'
    };

    return typeMap[component] || 'FRAME';
  }

  /**
   * Convert React Native styles to Figma format
   */
  _convertStyles(styles, theme) {
    const figmaStyles = {};

    // Layout
    if (styles.flex !== undefined) {
      figmaStyles.layoutGrow = styles.flex;
    }

    if (styles.flexDirection) {
      figmaStyles.layoutMode = styles.flexDirection === 'row' ? 'HORIZONTAL' : 'VERTICAL';
    }

    // Spacing
    if (styles.padding !== undefined) {
      figmaStyles.paddingLeft = styles.padding;
      figmaStyles.paddingRight = styles.padding;
      figmaStyles.paddingTop = styles.padding;
      figmaStyles.paddingBottom = styles.padding;
    }

    if (styles.paddingHorizontal !== undefined) {
      figmaStyles.paddingLeft = styles.paddingHorizontal;
      figmaStyles.paddingRight = styles.paddingHorizontal;
    }

    if (styles.paddingVertical !== undefined) {
      figmaStyles.paddingTop = styles.paddingVertical;
      figmaStyles.paddingBottom = styles.paddingVertical;
    }

    // Background
    if (styles.backgroundColor) {
      figmaStyles.fills = [{
        type: 'SOLID',
        color: this._hexToRgb(styles.backgroundColor)
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
      figmaStyles.fontWeight = this._getFontWeight(styles.fontWeight);
    }

    if (styles.color) {
      figmaStyles.fills = [{
        type: 'SOLID',
        color: this._hexToRgb(styles.color)
      }];
    }

    return figmaStyles;
  }

  /**
   * Convert hex color to RGB object
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
   * Map font weight to Figma font weight
   */
  _getFontWeight(weight) {
    const weightMap = {
      'normal': 400,
      'bold': 700,
      '100': 100,
      '200': 200,
      '300': 300,
      '400': 400,
      '500': 500,
      '600': 600,
      '700': 700,
      '800': 800,
      '900': 900
    };

    return weightMap[String(weight)] || 400;
  }

  /**
   * Generate unique node ID
   */
  _generateNodeId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
