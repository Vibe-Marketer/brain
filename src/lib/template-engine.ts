/**
 * Template interpolation engine for variable replacement
 * Supports {{variable}} syntax with XSS prevention
 */

import type {
  TemplateVariable,
  TemplateVariableValues,
  TemplateInterpolationResult,
} from '@/types/content-library';

/**
 * Regex pattern for matching template variables: {{variableName}}
 * Supports alphanumeric characters and underscores
 */
const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/**
 * HTML entities map for XSS prevention
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Sanitize a string to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeValue(value: string): string {
  if (typeof value !== 'string') {
    return String(value);
  }
  return value.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Parse template content and extract all variable names
 * @param template - Template content with {{variable}} placeholders
 * @returns Array of unique variable names found in the template
 */
export function parseVariables(template: string): string[] {
  if (!template || typeof template !== 'string') {
    return [];
  }

  const variables = new Set<string>();
  let match: RegExpExecArray | null;

  // Reset regex lastIndex for safety
  VARIABLE_PATTERN.lastIndex = 0;

  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Check if a template contains any variables
 * @param template - Template content to check
 * @returns true if template contains at least one variable
 */
export function hasVariables(template: string): boolean {
  if (!template || typeof template !== 'string') {
    return false;
  }
  VARIABLE_PATTERN.lastIndex = 0;
  return VARIABLE_PATTERN.test(template);
}

/**
 * Validate that all required variables have values provided
 * @param templateVariables - Array of variable definitions from template
 * @param values - Object mapping variable names to values
 * @returns Object with arrays of missing and empty variable names
 */
export function validateVariables(
  templateVariables: TemplateVariable[],
  values: TemplateVariableValues
): { missing: string[]; empty: string[] } {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const variable of templateVariables) {
    const value = values[variable.name];

    if (value === undefined || value === null) {
      if (variable.required && !variable.defaultValue) {
        missing.push(variable.name);
      }
    } else if (typeof value === 'string' && value.trim() === '') {
      if (variable.required && !variable.defaultValue) {
        empty.push(variable.name);
      }
    }
  }

  return { missing, empty };
}

/**
 * Detect variables in template that are not defined in the variable definitions
 * @param template - Template content with {{variable}} placeholders
 * @param templateVariables - Array of defined variables
 * @returns Array of undefined variable names found in template
 */
export function detectUndefinedVariables(
  template: string,
  templateVariables: TemplateVariable[]
): string[] {
  const usedVariables = parseVariables(template);
  const definedNames = new Set(templateVariables.map((v) => v.name));

  return usedVariables.filter((name) => !definedNames.has(name));
}

/**
 * Interpolate template variables with provided values
 * All values are sanitized to prevent XSS attacks
 *
 * @param template - Template content with {{variable}} placeholders
 * @param values - Object mapping variable names to replacement values
 * @param templateVariables - Optional array of variable definitions for defaults
 * @param options - Interpolation options
 * @returns Interpolated content with variables replaced
 */
export function interpolate(
  template: string,
  values: TemplateVariableValues,
  templateVariables?: TemplateVariable[],
  options: { sanitize?: boolean; preserveUndefined?: boolean } = {}
): string {
  const { sanitize = true, preserveUndefined = false } = options;

  if (!template || typeof template !== 'string') {
    return '';
  }

  // Build a map of variable names to their values (with defaults)
  const valueMap = new Map<string, string>();

  // First, populate with default values from variable definitions
  if (templateVariables) {
    for (const variable of templateVariables) {
      if (variable.defaultValue !== undefined) {
        valueMap.set(variable.name, variable.defaultValue);
      }
    }
  }

  // Override with provided values
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      valueMap.set(key, String(value));
    }
  }

  // Reset regex lastIndex
  VARIABLE_PATTERN.lastIndex = 0;

  return template.replace(VARIABLE_PATTERN, (match, variableName: string) => {
    const value = valueMap.get(variableName);

    if (value === undefined) {
      // Variable not provided - either preserve the placeholder or remove it
      return preserveUndefined ? match : '';
    }

    return sanitize ? sanitizeValue(value) : value;
  });
}

/**
 * Full template interpolation with validation and result metadata
 * @param template - Template content with {{variable}} placeholders
 * @param values - Object mapping variable names to replacement values
 * @param templateVariables - Array of variable definitions
 * @returns TemplateInterpolationResult with content and validation info
 */
export function interpolateWithValidation(
  template: string,
  values: TemplateVariableValues,
  templateVariables: TemplateVariable[] = []
): TemplateInterpolationResult {
  // Validate required variables
  const { missing, empty } = validateVariables(templateVariables, values);
  const missingVariables = [...missing, ...empty];

  // Detect undefined variables used in template
  const undefinedVars = detectUndefinedVariables(template, templateVariables);

  // Perform interpolation (with defaults applied)
  const content = interpolate(template, values, templateVariables, {
    sanitize: true,
    preserveUndefined: false,
  });

  return {
    content,
    missingVariables: [...missingVariables, ...undefinedVars],
    hasWarnings: missingVariables.length > 0 || undefinedVars.length > 0,
  };
}

/**
 * Create TemplateVariable definitions from parsed variable names
 * Useful for auto-generating variable definitions from template content
 * @param template - Template content with {{variable}} placeholders
 * @param allRequired - Whether all variables should be marked as required
 * @returns Array of TemplateVariable definitions
 */
export function createVariableDefinitions(
  template: string,
  allRequired: boolean = true
): TemplateVariable[] {
  const names = parseVariables(template);
  return names.map((name) => ({
    name,
    required: allRequired,
  }));
}

/**
 * Preview template with sample values for variables
 * Shows [variableName] for variables without values
 * @param template - Template content
 * @param values - Partial values to preview
 * @returns Preview string with formatted placeholders
 */
export function previewTemplate(
  template: string,
  values: TemplateVariableValues = {}
): string {
  if (!template || typeof template !== 'string') {
    return '';
  }

  VARIABLE_PATTERN.lastIndex = 0;

  return template.replace(VARIABLE_PATTERN, (match, variableName: string) => {
    const value = values[variableName];

    if (value !== undefined && value !== null && value !== '') {
      return sanitizeValue(String(value));
    }

    // Show formatted placeholder for empty values
    return `[${variableName}]`;
  });
}
