const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(chalk)/)',
  ],
  // Only run files that are actual Jest tests
  testMatch: [
    "**/test/**/*.test.ts",
    "**/test/**/*.test.js"
  ],
  // Exclude script files that are not Jest tests
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "test/.*\\.(example|manual)\\.test\\.ts$",
    "test/.*\\.(example|manual)\\.test\\.js$"
  ]
};