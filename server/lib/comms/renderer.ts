export function renderTemplate(template: string, context: Record<string, any>): string {
  let result = template;

  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(conditionalRegex, (match, variable, content) => {
    const value = context[variable];
    if (value !== undefined && value !== null && value !== "" && value !== false) {
      return content;
    }
    return "";
  });

  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  result = result.replace(eachRegex, (match, arrayName, itemTemplate) => {
    const array = context[arrayName];
    if (!Array.isArray(array) || array.length === 0) {
      return "";
    }

    return array.map((item, index) => {
      let itemResult = itemTemplate;
      
      itemResult = itemResult.replace(/\{\{@index\}\}/g, String(index + 1));
      
      if (typeof item === "object" && item !== null) {
        Object.keys(item).forEach(key => {
          const itemRegex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          itemResult = itemResult.replace(itemRegex, String(item[key] ?? ""));
        });
      } else {
        itemResult = itemResult.replace(/\{\{this\}\}/g, String(item));
      }
      
      return itemResult;
    }).join("\n");
  });

  const variableRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(variableRegex, (match, variable) => {
    const value = context[variable];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return "";
  });

  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.trim();

  return result;
}

export function validateTemplate(template: string, requiredTokens: string[]): { valid: boolean; missingTokens: string[] } {
  const missingTokens: string[] = [];
  
  for (const token of requiredTokens) {
    const regex = new RegExp(`\\{\\{${token}\\}\\}|\\{\\{#if\\s+${token}\\}\\}`);
    if (!regex.test(template)) {
      missingTokens.push(token);
    }
  }

  return {
    valid: missingTokens.length === 0,
    missingTokens,
  };
}

export function extractTokensFromTemplate(template: string): string[] {
  const tokens = new Set<string>();
  
  const variableRegex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = variableRegex.exec(template)) !== null) {
    if (!["#if", "/if", "#each", "/each", "@index", "this"].includes(match[1])) {
      tokens.add(match[1]);
    }
  }

  const conditionalRegex = /\{\{#if\s+(\w+)\}\}/g;
  while ((match = conditionalRegex.exec(template)) !== null) {
    tokens.add(match[1]);
  }

  const eachRegex = /\{\{#each\s+(\w+)\}\}/g;
  while ((match = eachRegex.exec(template)) !== null) {
    tokens.add(match[1]);
  }

  return Array.from(tokens);
}

export function previewMessage(template: string, context: Record<string, any>): {
  rendered: string;
  characterCount: number;
  segments: number;
  warnings: string[];
} {
  const rendered = renderTemplate(template, context);
  const characterCount = rendered.length;
  const segments = Math.ceil(characterCount / 160);
  
  const warnings: string[] = [];
  
  if (characterCount > 160) {
    warnings.push(`Message exceeds 160 characters (${characterCount}). Will be sent as ${segments} segments.`);
  }
  
  if (characterCount > 480) {
    warnings.push(`Message is very long (${characterCount} chars). Consider shortening for better delivery.`);
  }

  const unresolvedTokens = rendered.match(/\{\{[^}]+\}\}/g);
  if (unresolvedTokens) {
    warnings.push(`Unresolved tokens found: ${unresolvedTokens.join(", ")}`);
  }

  return {
    rendered,
    characterCount,
    segments,
    warnings,
  };
}
