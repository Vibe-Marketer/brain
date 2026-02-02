/**
 * Prompt Loader Utility for CallVault
 * 
 * Following PromptForge standards for loading and rendering prompts from .md files
 * with YAML frontmatter and XML tags.
 * 
 * @see /prompts folder for prompt files
 * @see /Users/Naegele/dev/prompt-forge/docs/prompt-standards.md
 */

import matter from 'gray-matter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Prompt configuration from frontmatter
 */
export interface PromptConfig {
  id: string;
  model: string;
  name?: string;
  version?: string;
  temperature?: number;
  max_tokens?: number;
  tags?: string[];
  variables?: string[];
  partials?: string[];
  output_format?: 'text' | 'json' | 'xml';
  description?: string;
}

/**
 * Loaded prompt with config and content
 */
export interface Prompt extends PromptConfig {
  prompt: string;           // The raw prompt content
  filePath: string;         // Path to source file
}

/**
 * Cache for loaded prompts (avoid re-reading files)
 */
const promptCache = new Map<string, Prompt>();
const partialCache = new Map<string, string>();

// Path to prompts directory (relative to project root)
const PROMPTS_DIR = path.join(process.cwd(), 'prompts');
const PARTIALS_DIR = path.join(PROMPTS_DIR, '_partials');

/**
 * Load a partial by name
 */
function loadPartial(name: string): string {
  if (partialCache.has(name)) {
    return partialCache.get(name)!;
  }
  
  const filePath = path.join(PARTIALS_DIR, `${name}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Partial not found: ${name}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  partialCache.set(name, content);
  return content;
}

/**
 * Resolve all {{>partial}} includes in content
 */
function resolvePartials(content: string): string {
  return content.replace(/\{\{>(\w[\w-]*)\}\}/g, (_match, partialName) => {
    try {
      return loadPartial(partialName);
    } catch (e) {
      console.error(`Failed to load partial: ${partialName}`, e);
      return _match; // Leave unresolved if partial not found
    }
  });
}

/**
 * Load a prompt file by path (relative to /prompts folder)
 * 
 * @param promptPath - Path like "chat/callvault-assistant" (no .md extension)
 * @returns Parsed prompt with config and content
 * 
 * @example
 * const assistant = loadPrompt('chat/callvault-assistant');
 * console.log(assistant.model);  // "openai/gpt-4o-mini"
 * console.log(assistant.prompt); // The full prompt text
 */
export function loadPrompt(promptPath: string): Prompt {
  // Normalize path
  const normalizedPath = promptPath.replace(/\.md$/, '');
  
  // Check cache
  if (promptCache.has(normalizedPath)) {
    return promptCache.get(normalizedPath)!;
  }
  
  // Build full path
  const fullPath = path.join(PROMPTS_DIR, `${normalizedPath}.md`);
  
  // Check file exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Prompt not found: ${fullPath}`);
  }
  
  // Read and parse
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  const { data, content } = matter(fileContent);
  
  // Validate required fields
  if (!data.id) {
    throw new Error(`Prompt missing required field 'id': ${fullPath}`);
  }
  if (!data.model) {
    throw new Error(`Prompt missing required field 'model': ${fullPath}`);
  }
  
  // Build prompt object
  const prompt: Prompt = {
    ...(data as PromptConfig),
    prompt: content.trim(),
    filePath: fullPath,
  };
  
  // Cache and return
  promptCache.set(normalizedPath, prompt);
  return prompt;
}

/**
 * Render a prompt with partials resolved and variables substituted
 * 
 * @param promptPath - Path like "chat/callvault-assistant"
 * @param variables - Object with variable values
 * @returns Rendered prompt string ready to send to LLM
 * 
 * @example
 * const rendered = renderPrompt('chat/callvault-assistant', {
 *   today_date: '2026-02-02',
 *   recent_date: '2026-01-19',
 *   business_context: 'Company: TechCorp',
 *   filter_context: '',
 * });
 */
export function renderPrompt(
  promptPath: string,
  variables: Record<string, string> = {}
): string {
  const { prompt } = loadPrompt(promptPath);
  
  // 1. Resolve partials first
  let rendered = resolvePartials(prompt);
  
  // 2. Then substitute variables
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  
  // 3. Warn about unsubstituted variables (but not partials)
  const unsubstituted = rendered.match(/\{\{(?!>)[^}]+\}\}/g);
  if (unsubstituted) {
    console.warn(`Warning: Unsubstituted variables: ${unsubstituted.join(', ')}`);
  }
  
  return rendered;
}

/**
 * Get all prompts in a directory
 * 
 * @param directory - Folder name like "chat" or "extraction"
 * @returns Array of loaded prompts
 */
export function getPromptsInDirectory(directory: string): Prompt[] {
  const dirPath = path.join(PROMPTS_DIR, directory);
  
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  return files.map(f => loadPrompt(`${directory}/${f.replace('.md', '')}`));
}

/**
 * List all available partials
 */
export function listPartials(): string[] {
  if (!fs.existsSync(PARTIALS_DIR)) {
    return [];
  }
  return fs.readdirSync(PARTIALS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));
}

/**
 * Clear caches (for hot reloading in development)
 */
export function clearPromptCaches(): void {
  promptCache.clear();
  partialCache.clear();
}

/**
 * Get prompt config without full content (for listings)
 */
export function getPromptConfig(promptPath: string): PromptConfig {
  const { prompt: _prompt, filePath: _filePath, ...config } = loadPrompt(promptPath);
  return config;
}
