import { test, expect } from "./fixtures";

test("should load the extension sidepanel", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const title = await page.textContent("title");
  // manifest.json のバージョンを取得
  const manifest = require("../../projects/app/manifest.json");
  expect(title).toBe(`Issues-Solo v${manifest.version}`);
});
