module.exports = {
  env: {
    es2021: true,
    browser: true,
    node: true
  },
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [ '@typescript-eslint' ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [ './tsconfig.json' ],
    ecmaVersion: 12,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    'import/parsers': { '@typescript-eslint/parser': [ '.ts', '.tsx' ]},
    'import/resolver': {
      'node': true,
      'eslint-import-resolver-typescript': true
    },
  },
  globals: {
    JSX: "readonly"
  },
  extends: [ 'react-app',
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript', ],
  rules: {
    'import/extensions': [
      'error',
      'ignorePackages', { js: 'never', jsx: 'never', ts: 'never', tsx: 'never', },
    ],
    'comma-dangle': [ 'error', 'never' ],
    'no-cond-assign': [ 'error', 'always' ],
    'no-console': ['warn'],
    'no-unexpected-multiline': 'error',
    'accessor-pairs': [ 'error', { getWithoutSet: false, setWithoutGet: true} ],
    'block-scoped-var': 'warn',
    'consistent-return': 'error',
    'curly': 'error',
    'default-case': 'warn',
    'dot-location': [ 'warn', 'property' ],
    'dot-notation': 'warn',
    'eqeqeq': [ 'error', 'smart' ],
    'guard-for-in': 'warn',
    'no-caller': 'error',
    'no-case-declarations': 'warn',
    'no-else-return': 'warn',
    'no-empty-pattern': 'warn',
    'no-eq-null': 'warn',
    'no-extend-native': 'error',
    'no-extra-bind': 'warn',
    'no-floating-decimal': 'warn',
    'no-implicit-coercion': [ 'warn', { boolean: true, number: true, string: true } ],
    'no-invalid-this': 'error',
    'no-iterator': 'error',
    'no-labels': 'warn',
    'no-lone-blocks': 'warn',
    'no-loop-func': 'error',
    'no-multi-spaces': 'error',
    'no-multi-str': 'warn',
    'no-native-reassign': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-new': 'error',
    'no-octal-escape': 'error',
    'no-param-reassign': 'error',
    'no-proto': 'error',
    'no-redeclare': 'error',
    'no-return-assign': 'error',
    'no-script-url': 'error',
    'no-throw-literal': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-warning-comments': [ 'warn', { terms: [ 'TODO', 'FIXME' ], location: 'start' } ],
    'no-with': 'warn',
    'radix': 'warn',
    'vars-on-top': 'error',
    'wrap-iife': [ 'error', 'outside' ],
    'yoda': 'error',
    'strict': [ 'error', 'never' ],
    'no-catch-shadow': 'warn',
    'no-delete-var': 'error',
    'no-label-var': 'error',
    'no-shadow-restricted-names': 'error',
    'no-shadow': 'warn',
    'no-undef-init': 'off',
    'no-undef': 'error',
    'no-undefined': 'off',
    'no-unused-vars': 'warn',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [ 'error' ],
    'callback-return': [ 'warn', [ 'callback', 'next' ] ],
    'global-require': 'error',
    'handle-callback-err': 'warn',
    'no-mixed-requires': 'warn',
    'no-new-require': 'error',
    'no-path-concat': 'error',
    'no-process-exit': 'error',
    'no-restricted-modules': 'off',
    'arrow-body-style': [ 'error', 'as-needed' ],
    'arrow-parens': [ 'error', 'as-needed' ],
    'arrow-spacing': [ 'error', { before: true, after: true } ],
    'constructor-super': 'error',
    'generator-star-spacing': [ 'error', 'before' ],
    'no-class-assign': 'error',
    'no-const-assign': 'error',
    'no-dupe-class-members': 'error',
    'no-this-before-super': 'error',
    'no-var': 'warn',
    'object-shorthand': [ 'warn', 'never' ],
    'prefer-arrow-callback': 'warn',
    'prefer-spread': 'warn',
    'prefer-template': 'warn',
    'require-yield': 'error',
    'array-bracket-spacing': [ 'warn', 'always' ],
    'block-spacing': [ 'warn', 'always' ],
    'brace-style': [ 'warn', '1tbs', { allowSingleLine: false } ],
    'camelcase': 'warn',
    'comma-spacing': [ 'warn', { before: false, after: true } ],
    'comma-style': [ 'warn', 'last' ],
    'computed-property-spacing': [ 'warn', 'never' ],
    'consistent-this': [ 'warn', 'self' ],
    'eol-last': 'warn',
    'func-names': 'warn',
    'id-length': [ 'warn', { min: 1, max: 32 } ],
    'indent': [ 'warn', 'tab' ],
    'jsx-quotes': [ 'warn', 'prefer-double' ],
    'linebreak-style': [ 'warn', 'unix' ],
    'lines-around-comment': [ 'warn', { beforeBlockComment: true } ],
    'max-depth': [ 'warn', 8 ],
    'max-nested-callbacks': [ 'warn', 8 ],
    'max-params': [ 'warn', 8 ],
    'new-cap': 'warn',
    'new-parens': 'warn',
    'no-array-constructor': 'warn',
    'no-bitwise': 'off',
    'no-continue': 'off',
    'no-inline-comments': 'off',
    'no-lonely-if': 'warn',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-multiple-empty-lines': 'warn',
    'no-negated-condition': 'off',
    'no-nested-ternary': 'warn',
    'no-new-object': 'warn',
    'no-plusplus': 'off',
    'no-spaced-func': 'warn',
    'no-ternary': 'off',
    'no-trailing-spaces': 'warn',
    'no-unneeded-ternary': 'warn',
    'object-curly-spacing': [ 'warn', 'always' ],
    'one-var': 'off',
    'operator-linebreak': [ 'warn', 'after' ],
    'padded-blocks': [ 'warn', 'never' ],
    'quote-props': [ 'warn', 'consistent-as-needed' ],
    'quotes': [ 'error', 'single' ],
    'semi-spacing': [ 'warn', { before: false, after: true } ],
    'semi': [ 'error', 'always' ],
    'sort-vars': 'off',
    'keyword-spacing': [ 'warn', { before: true, after: true } ],
    'space-before-blocks': [ 'warn', 'always' ],
    'space-before-function-paren': [ 'warn', 'never' ],
    'space-in-parens': [ 'warn', 'never' ],
    'space-infix-ops': [ 'warn', { int32Hint: true } ],
    'space-unary-ops': 'error',
    'spaced-comment': [ 'warn', 'always' ],
    'wrap-regex': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/array-type': ['warn', {default: 'generic'}],
    '@typescript-eslint/explicit-member-accessibility': ['error'],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/no-empty-interface': ['error'],
    '@typescript-eslint/prefer-readonly': ['warn'],
    '@typescript-eslint/no-inferrable-types': ['error'],
    'comma-dangle': ['error'],
    'indent': ['error', 2],
    'object-shorthand': ['error', 'never'],
    'arrow-parens': ['error', 'as-needed'],
    'quotes': ['error', 'single'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-in-parens': ['error', 'never'],
    'no-tabs': ['error'],
    'no-mixed-operators': ['off'],
    'no-nested-ternary': ['off'],
    'id-length': ['off'],
    '@typescript-eslint/await-thenable': ['off']
  }
};
