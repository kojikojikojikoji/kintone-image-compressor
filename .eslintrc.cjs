module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: "module",
  },
  env: {
    browser: true,
    es2019: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  ignorePatterns: ["dist", "node_modules", "*.mjs"],
  globals: {
    kintone: "readonly",
  },
  rules: {
    "no-console": "off",
    // TypeScript checks these; the base rules produce false positives on
    // ambient globals and type-only identifiers.
    "no-unused-vars": "off",
    "no-undef": "off",
  },
};
