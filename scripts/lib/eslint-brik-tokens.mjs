// ESLint plugin: in-editor + CI feedback when a string literal or template
// references a CSS custom property that isn't declared anywhere we recognize.
//
// Mirrors the canonical-set logic used by scripts/lint-tokens.mjs so the two
// gates agree.

import { loadTokenSets, findVarRefs, isViolation } from './canonical-tokens.mjs';

let sets;
let loadError;
try {
  sets = loadTokenSets();
} catch (err) {
  loadError = err;
}

const noInventedTokens = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow CSS custom properties not declared in BDS dist/tokens.css, ' +
        'project globals.css, or scripts/tokens-allowlist.txt',
    },
    schema: [],
    messages: {
      invented:
        'Invented token `{{name}}`. Use a canonical token from @brikdesigns/bds, ' +
        'declare it project-locally in src/app/globals.css, or add to ' +
        'scripts/tokens-allowlist.txt with a TODO.',
      loadFailed:
        'Token rule could not load canonical set: {{message}}. Run `npm install`.',
    },
  },
  create(context) {
    if (loadError) {
      // Warn once per file at program start.
      return {
        Program(node) {
          context.report({
            node,
            messageId: 'loadFailed',
            data: { message: loadError.message },
          });
        },
      };
    }
    function check(node, value) {
      if (typeof value !== 'string' || !value.includes('var(--')) return;
      for (const { name } of findVarRefs(value)) {
        if (isViolation(name, sets)) {
          context.report({ node, messageId: 'invented', data: { name } });
        }
      }
    }
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked);
      },
    };
  },
};

const plugin = {
  meta: { name: 'brik-tokens', version: '1.0.0' },
  rules: { 'no-invented-tokens': noInventedTokens },
};

export default plugin;
