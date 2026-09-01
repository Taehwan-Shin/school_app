import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='collection'][arguments.0.value='audit_log']",
          message: "Direct access to 'audit_log' collection is forbidden. Use writeAudit() instead.",
        },
        {
          selector: "CallExpression[callee.property.name='collection'][arguments.0.type!='Literal']",
          message: "Dynamic collection access is forbidden. Pass string literals to collection().",
        },
      ],
    },
  },
  {
    files: ['src/audit/writeAudit.ts', 'src/audit/readAudit.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
