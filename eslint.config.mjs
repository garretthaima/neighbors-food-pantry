import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// File sizes, folder layout and import boundaries are checked by
// server/test/structure.test.ts. This file covers what is inside a file.
export default tseslint.config(
    { ignores: ['**/dist/**', '**/node_modules/**', '.devdb/**', 'test-results/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            eqeqeq: ['error', 'always'],
            'no-console': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/consistent-type-imports': 'error',
        },
    },
    {
        files: ['server/**/*.ts', 'e2e/**/*.ts', '*.ts', '*.js'],
        languageOptions: { globals: globals.node },
    },
    {
        // Function length limits (.claude/rules/file-size-conventions.md).
        files: ['server/src/**/*.ts'],
        ignores: ['**/__tests__/**'],
        rules: { 'max-lines-per-function': ['error', { max: 50 }] },
    },
    {
        // A router factory holds every handler of a module, so its own
        // length is not the signal. Handlers stay short: parse, call the
        // service, respond.
        files: ['server/src/**/routes.ts'],
        rules: { 'max-lines-per-function': 'off' },
    },
    {
        // Command-line scripts print to the terminal.
        files: ['server/scripts/**/*.ts'],
        rules: { 'no-console': 'off' },
    },
    {
        files: ['web/**/*.{ts,tsx}'],
        languageOptions: { globals: globals.browser },
        plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...jsxA11y.flatConfigs.recommended.rules,
            // Deliberate here: the scan box must hold focus for a USB scanner,
            // and a dialog puts the cursor in its first field.
            'jsx-a11y/no-autofocus': 'off',
        },
    }
);
