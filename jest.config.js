module.exports = {
  testEnvironment: "jsdom",
  // chrome API の最小モックは jest.setup.js で提供する（jest-chrome は jest@29 と
  // peer 依存が競合し npm ci を失敗させるため除去した）。
  // jest.fn を使うため setupFiles ではなく setupFilesAfterEnv に置く。
  setupFilesAfterEnv: ["fake-indexeddb/auto", "<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.jsx?$": "babel-jest",
  },
  moduleFileExtensions: ["js", "jsx", "json", "node"],
  testMatch: ["**/tests/unit/**/*.test.js"],
  // ローカルの作業ツリー(.kilo/worktrees)や node_modules 内の重複を走査しない。
  // （CI のクリーンチェックアウトには .kilo は存在しないが、ローカル実行時の誤検出を防ぐ）
  testPathIgnorePatterns: ["/node_modules/", "/.kilo/", "/tests/e2e/"],
  modulePathIgnorePatterns: ["/.kilo/"],
  // カバレッジは `npm run coverage`(= jest --coverage) 実行時のみ計測する。
  // 通常の `npm run test` では計測しない（統一方針）。
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  collectCoverageFrom: ["projects/app/**/*.js", "!projects/app/assets/**"],
};
