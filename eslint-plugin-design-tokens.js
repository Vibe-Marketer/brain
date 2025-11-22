/**
 * Custom ESLint Plugin for Design Token Enforcement
 *
 * Prevents inline colors and enforces design token usage
 */

export default {
  rules: {
    /**
     * Ban inline hex colors and enforce design tokens
     *
     * ❌ WRONG:
     * - className="bg-[#111111]"
     * - className="hover:bg-cb-ink" (BLACK)
     * - style={{ background: '#F8F8F8' }}
     *
     * ✅ CORRECT:
     * - className="bg-cb-ink"
     * - className="hover:bg-cb-hover"
     * - No inline styles with colors
     */
    'no-inline-colors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce design token usage, ban inline hex colors',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          noInlineHex: '🚫 No inline hex colors! Use design tokens instead (bg-cb-white, text-cb-ink, etc.)',
          noInlineStyle: '🚫 No inline styles with colors! Use Tailwind tokens instead',
          wrongToken: '🚫 Don\'t use "{{wrong}}"! Use: {{correct}}',
        },
        schema: [],
      },

      create(context) {
        return {
          JSXAttribute(node) {
            // Check className attribute
            if (node.name.name === 'className') {
              const value = node.value?.value || '';

              // Ban any inline hex colors in className
              if (value.includes('#')) {
                context.report({
                  node,
                  messageId: 'noInlineHex',
                });
                return;
              }

              // Ban specific wrong token usages
              const bannedPatterns = [
                {
                  pattern: /hover:bg-cb-ink(?![a-z-])/,
                  wrong: 'hover:bg-cb-ink',
                  correct: 'hover:bg-cb-hover (light gray, not black)',
                },
                {
                  pattern: /bg-\[#[0-9A-Fa-f]{6}\]/,
                  wrong: 'bg-[#hex]',
                  correct: 'design token like bg-cb-white, bg-card, etc.',
                },
                {
                  pattern: /text-\[#[0-9A-Fa-f]{6}\]/,
                  wrong: 'text-[#hex]',
                  correct: 'design token like text-cb-ink, text-cb-ink-muted',
                },
                {
                  pattern: /border-\[#[0-9A-Fa-f]{6}\]/,
                  wrong: 'border-[#hex]',
                  correct: 'border-cb-border or border-cb-border-dark',
                },
                {
                  pattern: /dark:bg-\[#[0-9A-Fa-f]{6}\]/,
                  wrong: 'dark:bg-[#hex]',
                  correct: 'dark:bg-card or dark:bg-cb-panel-dark',
                },
              ];

              for (const { pattern, wrong, correct } of bannedPatterns) {
                if (pattern.test(value)) {
                  context.report({
                    node,
                    messageId: 'wrongToken',
                    data: { wrong, correct },
                  });
                  break; // Only report first match
                }
              }
            }

            // Ban inline style attribute with colors
            if (node.name.name === 'style') {
              const value = node.value;

              // Check if JSXExpressionContainer has color properties
              if (value?.type === 'JSXExpressionContainer') {
                const expr = value.expression;

                // Check if it's an object expression
                if (expr?.type === 'ObjectExpression') {
                  for (const prop of expr.properties) {
                    if (prop.key?.name && ['background', 'backgroundColor', 'color', 'borderColor'].includes(prop.key.name)) {
                      context.report({
                        node,
                        messageId: 'noInlineStyle',
                      });
                      break;
                    }
                  }
                }
              }
            }
          },

          // Also check template literals in styled components (if used)
          TaggedTemplateExpression(node) {
            if (node.tag.name === 'css' || node.tag.name === 'styled') {
              const template = node.quasi.quasis[0]?.value.raw || '';

              // Check for hex colors in css`` or styled`` templates
              if (/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/.test(template)) {
                context.report({
                  node,
                  messageId: 'noInlineHex',
                });
              }
            }
          },
        };
      },
    },
  },
};
