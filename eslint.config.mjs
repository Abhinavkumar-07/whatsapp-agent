import js from '@eslint/js';

export default [
  // Apply recommended rules to all JS files
  js.configs.recommended,

  {
    files: ['src/**/*.js', 'test/**/*.js', 'index.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js globals
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Web APIs available in Node 18+ (used for fetch, FormData, Blob)
        fetch: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // Style
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'space-infix-ops': 'error',
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],

      // Logic / safety
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'off', // We use pino; console is only used in config.js before logger is ready
      eqeqeq: ['error', 'always'],
      'no-throw-literal': 'error',
      'handle-callback-err': 'error',
      'no-await-in-loop': 'warn', // We intentionally use it for sequential message processing
      'no-return-await': 'error',
    },
  },

  // Relax some rules for test files
  {
    files: ['test/**/*.js'],
    rules: {
      'no-await-in-loop': 'off',
    },
  },

  // Ignore generated / installed directories
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
];
