import { test, expect } from "@playwright/test";

export default {
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    headless: false,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
};
