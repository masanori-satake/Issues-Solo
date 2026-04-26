import { test as base, chromium, expect } from "@playwright/test";
import path from "path";

export const test = base.extend({
  context: async ({}, use) => {
    const pathToExtension = path.join(process.cwd(), "projects/app");
    const context = await chromium.launchPersistentContext("", {
      headless: false, // 拡張機能のロードには非ヘッドレスモードが必要な場合がある
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // サービスワーカーの URL から拡張機能 ID を取得
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent("serviceworker");

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});
export { expect };
