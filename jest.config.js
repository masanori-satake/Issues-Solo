module.exports = {
  testEnvironment: "jsdom",
  setupFiles: ["jest-chrome"],
  setupFilesAfterEnv: ["fake-indexeddb/auto"],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
  },
  moduleFileExtensions: ["js", "jsx", "json", "node"],
  testMatch: ["**/tests/unit/**/*.test.js"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  collectCoverageFrom: [
    "projects/app/**/*.js",
    "!projects/app/assets/**",
  ],
};
