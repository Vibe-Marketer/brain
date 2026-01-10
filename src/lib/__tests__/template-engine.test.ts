import { describe, it, expect } from 'vitest';
import {
  sanitizeValue,
  parseVariables,
  hasVariables,
  validateVariables,
  detectUndefinedVariables,
  interpolate,
  interpolateWithValidation,
  createVariableDefinitions,
  previewTemplate,
} from '../template-engine';
import type { TemplateVariable } from '@/types/content-library';

describe('sanitizeValue', () => {
  it('should escape HTML special characters', () => {
    expect(sanitizeValue('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(sanitizeValue('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape quotes', () => {
    expect(sanitizeValue('Say "hello"')).toBe('Say &quot;hello&quot;');
    expect(sanitizeValue("It's fine")).toBe('It&#x27;s fine');
  });

  it('should escape backticks and equals', () => {
    expect(sanitizeValue('`code` = value')).toBe('&#x60;code&#x60; &#x3D; value');
  });

  it('should handle empty strings', () => {
    expect(sanitizeValue('')).toBe('');
  });

  it('should handle strings without special characters', () => {
    expect(sanitizeValue('Hello World')).toBe('Hello World');
  });

  it('should convert non-strings to strings', () => {
    expect(sanitizeValue(123 as unknown as string)).toBe('123');
    expect(sanitizeValue(null as unknown as string)).toBe('null');
  });
});

describe('parseVariables', () => {
  it('should parse single variable', () => {
    const result = parseVariables('Hello {{name}}!');
    expect(result).toEqual(['name']);
  });

  it('should parse multiple variables', () => {
    const result = parseVariables('Hello {{firstName}} {{lastName}}!');
    expect(result).toEqual(['firstName', 'lastName']);
  });

  it('should return unique variable names only', () => {
    const result = parseVariables('{{name}} and {{name}} again');
    expect(result).toEqual(['name']);
  });

  it('should handle variables with underscores', () => {
    const result = parseVariables('{{first_name}} {{last_name}}');
    expect(result).toEqual(['first_name', 'last_name']);
  });

  it('should handle variables with numbers', () => {
    const result = parseVariables('{{item1}} {{item2}}');
    expect(result).toEqual(['item1', 'item2']);
  });

  it('should return empty array for template without variables', () => {
    const result = parseVariables('Hello World!');
    expect(result).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    const result = parseVariables('');
    expect(result).toEqual([]);
  });

  it('should return empty array for null/undefined', () => {
    expect(parseVariables(null as unknown as string)).toEqual([]);
    expect(parseVariables(undefined as unknown as string)).toEqual([]);
  });

  it('should not parse malformed variables', () => {
    expect(parseVariables('{name}')).toEqual([]);
    expect(parseVariables('{{ name }}')).toEqual([]);
    expect(parseVariables('{{123}}')).toEqual([]); // can't start with number
    expect(parseVariables('{{name-with-dash}}')).toEqual([]);
  });
});

describe('hasVariables', () => {
  it('should return true when template has variables', () => {
    expect(hasVariables('Hello {{name}}')).toBe(true);
  });

  it('should return false when template has no variables', () => {
    expect(hasVariables('Hello World')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(hasVariables('')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(hasVariables(null as unknown as string)).toBe(false);
    expect(hasVariables(undefined as unknown as string)).toBe(false);
  });
});

describe('validateVariables', () => {
  const variables: TemplateVariable[] = [
    { name: 'firstName', required: true },
    { name: 'lastName', required: true },
    { name: 'middleName', required: false },
    { name: 'title', required: true, defaultValue: 'Mr./Ms.' },
  ];

  it('should return empty arrays when all required variables provided', () => {
    const values = { firstName: 'John', lastName: 'Doe' };
    const result = validateVariables(variables, values);
    expect(result.missing).toEqual([]);
    expect(result.empty).toEqual([]);
  });

  it('should detect missing required variables', () => {
    const values = { firstName: 'John' };
    const result = validateVariables(variables, values);
    expect(result.missing).toContain('lastName');
    expect(result.missing).not.toContain('middleName');
  });

  it('should not report missing when default value exists', () => {
    const values = { firstName: 'John', lastName: 'Doe' };
    const result = validateVariables(variables, values);
    expect(result.missing).not.toContain('title');
  });

  it('should detect empty string values for required variables', () => {
    const values = { firstName: '', lastName: 'Doe' };
    const result = validateVariables(variables, values);
    expect(result.empty).toContain('firstName');
  });

  it('should not report optional variables as missing', () => {
    const values = { firstName: 'John', lastName: 'Doe' };
    const result = validateVariables(variables, values);
    expect(result.missing).not.toContain('middleName');
    expect(result.empty).not.toContain('middleName');
  });
});

describe('detectUndefinedVariables', () => {
  it('should detect variables used but not defined', () => {
    const template = '{{firstName}} {{lastName}} {{undefinedVar}}';
    const variables: TemplateVariable[] = [
      { name: 'firstName', required: true },
      { name: 'lastName', required: true },
    ];
    const result = detectUndefinedVariables(template, variables);
    expect(result).toEqual(['undefinedVar']);
  });

  it('should return empty array when all variables defined', () => {
    const template = '{{firstName}} {{lastName}}';
    const variables: TemplateVariable[] = [
      { name: 'firstName', required: true },
      { name: 'lastName', required: true },
    ];
    const result = detectUndefinedVariables(template, variables);
    expect(result).toEqual([]);
  });
});

describe('interpolate', () => {
  it('should replace variables with values', () => {
    const template = 'Hello {{name}}!';
    const result = interpolate(template, { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('should replace multiple variables', () => {
    const template = 'Dear {{title}} {{lastName}}, Welcome to {{company}}!';
    const result = interpolate(template, {
      title: 'Dr.',
      lastName: 'Smith',
      company: 'Acme Corp',
    });
    expect(result).toBe('Dear Dr. Smith, Welcome to Acme Corp!');
  });

  it('should replace same variable multiple times', () => {
    const template = '{{name}} likes {{name}}';
    const result = interpolate(template, { name: 'Alice' });
    expect(result).toBe('Alice likes Alice');
  });

  it('should sanitize values by default', () => {
    const template = 'Message: {{content}}';
    const result = interpolate(template, {
      content: '<script>alert("xss")</script>',
    });
    expect(result).toBe(
      'Message: &lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('should allow disabling sanitization', () => {
    const template = 'HTML: {{content}}';
    const result = interpolate(
      template,
      { content: '<b>bold</b>' },
      undefined,
      { sanitize: false }
    );
    expect(result).toBe('HTML: <b>bold</b>');
  });

  it('should remove undefined variables by default', () => {
    const template = 'Hello {{name}} from {{city}}';
    const result = interpolate(template, { name: 'John' });
    expect(result).toBe('Hello John from ');
  });

  it('should preserve undefined variables when option set', () => {
    const template = 'Hello {{name}} from {{city}}';
    const result = interpolate(template, { name: 'John' }, undefined, {
      preserveUndefined: true,
    });
    expect(result).toBe('Hello John from {{city}}');
  });

  it('should use default values from variable definitions', () => {
    const template = 'Hello {{title}} {{name}}';
    const variables: TemplateVariable[] = [
      { name: 'title', required: false, defaultValue: 'Mr./Ms.' },
      { name: 'name', required: true },
    ];
    const result = interpolate(template, { name: 'Smith' }, variables);
    expect(result).toBe('Hello Mr./Ms. Smith');
  });

  it('should override default with provided value', () => {
    const template = '{{greeting}} {{name}}';
    const variables: TemplateVariable[] = [
      { name: 'greeting', required: false, defaultValue: 'Hello' },
      { name: 'name', required: true },
    ];
    const result = interpolate(
      template,
      { greeting: 'Hi', name: 'Alice' },
      variables
    );
    expect(result).toBe('Hi Alice');
  });

  it('should handle empty template', () => {
    expect(interpolate('', { name: 'test' })).toBe('');
    expect(interpolate(null as unknown as string, { name: 'test' })).toBe('');
  });

  it('should handle empty values object', () => {
    const template = 'Hello {{name}}!';
    const result = interpolate(template, {});
    expect(result).toBe('Hello !');
  });
});

describe('interpolateWithValidation', () => {
  const variables: TemplateVariable[] = [
    { name: 'firstName', required: true },
    { name: 'lastName', required: true },
    { name: 'company', required: false },
  ];

  it('should return interpolated content with no warnings', () => {
    const template = 'Hello {{firstName}} {{lastName}}';
    const result = interpolateWithValidation(template, {
      firstName: 'John',
      lastName: 'Doe',
    }, variables);

    expect(result.content).toBe('Hello John Doe');
    expect(result.missingVariables).toEqual([]);
    expect(result.hasWarnings).toBe(false);
  });

  it('should report missing required variables', () => {
    const template = 'Hello {{firstName}} {{lastName}}';
    const result = interpolateWithValidation(template, {
      firstName: 'John',
    }, variables);

    expect(result.missingVariables).toContain('lastName');
    expect(result.hasWarnings).toBe(true);
  });

  it('should report undefined variables in template', () => {
    const template = 'Hello {{firstName}} from {{city}}';
    const result = interpolateWithValidation(template, {
      firstName: 'John',
      lastName: 'Doe',
    }, variables);

    expect(result.missingVariables).toContain('city');
    expect(result.hasWarnings).toBe(true);
  });

  it('should sanitize all values', () => {
    const template = '{{firstName}} says {{message}}';
    const vars: TemplateVariable[] = [
      { name: 'firstName', required: true },
      { name: 'message', required: true },
    ];
    const result = interpolateWithValidation(template, {
      firstName: '<John>',
      message: '<script>bad</script>',
    }, vars);

    expect(result.content).toBe(
      '&lt;John&gt; says &lt;script&gt;bad&lt;&#x2F;script&gt;'
    );
  });
});

describe('createVariableDefinitions', () => {
  it('should create definitions for all variables', () => {
    const template = 'Hello {{firstName}} {{lastName}}';
    const result = createVariableDefinitions(template);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: 'firstName', required: true });
    expect(result).toContainEqual({ name: 'lastName', required: true });
  });

  it('should mark variables as optional when specified', () => {
    const template = '{{name}}';
    const result = createVariableDefinitions(template, false);

    expect(result).toEqual([{ name: 'name', required: false }]);
  });

  it('should return empty array for template without variables', () => {
    const result = createVariableDefinitions('Hello World');
    expect(result).toEqual([]);
  });
});

describe('previewTemplate', () => {
  it('should show variable names in brackets for missing values', () => {
    const template = 'Hello {{firstName}} {{lastName}}';
    const result = previewTemplate(template);

    expect(result).toBe('Hello [firstName] [lastName]');
  });

  it('should show values when provided', () => {
    const template = 'Hello {{firstName}} {{lastName}}';
    const result = previewTemplate(template, { firstName: 'John' });

    expect(result).toBe('Hello John [lastName]');
  });

  it('should sanitize preview values', () => {
    const template = '{{name}} says {{message}}';
    const result = previewTemplate(template, { name: '<b>Bold</b>' });

    expect(result).toBe('&lt;b&gt;Bold&lt;&#x2F;b&gt; says [message]');
  });

  it('should handle empty template', () => {
    expect(previewTemplate('')).toBe('');
    expect(previewTemplate(null as unknown as string)).toBe('');
  });
});

describe('XSS Prevention', () => {
  it('should prevent script injection via interpolate', () => {
    const template = 'User comment: {{comment}}';
    const malicious = '<script>document.cookie</script>';
    const result = interpolate(template, { comment: malicious });

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should prevent event handler injection', () => {
    const template = 'Image: {{imgTag}}';
    const malicious = '<img src="x" onerror="alert(1)">';
    const result = interpolate(template, { imgTag: malicious });

    expect(result).not.toContain('onerror=');
    expect(result).toContain('&lt;img');
  });

  it('should prevent href javascript injection', () => {
    const template = 'Link: {{link}}';
    const malicious = '<a href="javascript:alert(1)">click</a>';
    const result = interpolate(template, { link: malicious });

    expect(result).not.toContain('href="javascript');
    expect(result).toContain('&lt;a');
  });

  it('should prevent data URI injection', () => {
    const template = '{{content}}';
    const malicious = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = interpolate(template, { content: malicious });

    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('should prevent SQL injection characters (when displayed in HTML)', () => {
    const template = 'Query: {{input}}';
    const malicious = "'; DROP TABLE users; --";
    const result = interpolate(template, { input: malicious });

    // SQL injection is primarily a server concern, but we still escape quotes
    expect(result).toContain('&#x27;');
  });

  it('should handle complex XSS payloads', () => {
    const template = '{{payload}}';
    const payloads = [
      '<script>alert(String.fromCharCode(88,83,83))</script>',
      '"><script>alert(1)</script>',
      "'-alert(1)-'",
      '<img src=x onerror=alert(1)//>',
      '<svg/onload=alert(1)>',
      '{{constructor.constructor("alert(1)")()}}',
    ];

    for (const payload of payloads) {
      const result = interpolate(template, { payload });
      expect(result).not.toContain('<script');
      expect(result).not.toContain('<img');
      expect(result).not.toContain('<svg');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
    }
  });
});

describe('Edge Cases', () => {
  it('should handle template with only variables', () => {
    const result = interpolate('{{a}}{{b}}{{c}}', { a: '1', b: '2', c: '3' });
    expect(result).toBe('123');
  });

  it('should handle adjacent variables', () => {
    const result = interpolate('{{first}}{{last}}', {
      first: 'Hello',
      last: 'World',
    });
    expect(result).toBe('HelloWorld');
  });

  it('should handle very long templates', () => {
    const longContent = 'x'.repeat(10000);
    const template = `Start {{var}} ${longContent} {{var}} End`;
    const result = interpolate(template, { var: 'test' });

    expect(result).toBe(`Start test ${longContent} test End`);
  });

  it('should handle special characters in surrounding text', () => {
    const template = '{{name}} <3 coding!';
    const result = interpolate(template, { name: 'Alice' });
    expect(result).toBe('Alice <3 coding!');
  });

  it('should handle newlines in template', () => {
    const template = 'Line 1: {{line1}}\nLine 2: {{line2}}';
    const result = interpolate(template, { line1: 'Hello', line2: 'World' });
    expect(result).toBe('Line 1: Hello\nLine 2: World');
  });

  it('should handle unicode characters', () => {
    const template = '{{greeting}} {{name}}! 🎉';
    const result = interpolate(template, { greeting: 'Привет', name: '世界' });
    expect(result).toBe('Привет 世界! 🎉');
  });

  it('should handle variables with values containing braces', () => {
    const template = 'JSON: {{json}}';
    const result = interpolate(template, { json: '{"key": "value"}' });
    // Braces in values should not be interpreted as template variables
    expect(result).toBe('JSON: {&quot;key&quot;: &quot;value&quot;}');
  });
});
