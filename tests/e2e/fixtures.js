import { test as base, chromium, expect } from "@playwright/test";
import path from "path";

export const test = base.extend({
  context: async ({}, use) => {
    const pathToExtension = path.join(process.cwd(), "projects/app");
    const context = await chromium.launchPersistentContext("", {
      headless: false, // Chrome extensions only work in non-headless mode in some versions, but Playwright supports it in some ways.
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // for chromium, the extension id is stable if you specify a key in manifest.json,
    // otherwise you can find it from service worker.
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent("serviceworker");

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});
export { expect };
