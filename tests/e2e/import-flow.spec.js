import { test, expect } from "./fixtures";

test.describe("Import and Interaction Flow", () => {
  test.beforeEach(async ({ context, extensionId }) => {
    const sidePanel = await context.newPage();

    await sidePanel.addInitScript(() => {
      window.chrome = window.chrome || {};
      window.chrome.permissions = window.chrome.permissions || {};
      window.chrome.permissions.request = async () => true;
      window.alert = () => {};
    });

    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    test.info().annotations.push({ type: "sidePanel", description: sidePanel });
  });

  async function getSidePanel(testInfo) {
    return testInfo.annotations.find((a) => a.type === "sidePanel").description;
  }

  test("should handle unconfigured host from imported history", async ({
    context,
    extensionId,
  }, testInfo) => {
    const sidePanel = await getSidePanel(testInfo);

    // 1. 設定を空にする（初期設定の Atlassian.net も消す）
    await sidePanel.click("#settings-btn");
    await sidePanel.click(".host-item .delete-btn");
    await sidePanel.click("#close-settings");

    // 2. 履歴をインポートする
    const ndjson = JSON.stringify({
      url: "https://imported-host.atlassian.net/browse/IMP-1",
      issueKey: "IMP-1",
      title: "Imported Issue",
      lastAccessed: Date.now(),
      isOpened: true, // これはインポート時に false になるはず
      tabId: 12345,
    });

    // クリップボードをモックしてインポートボタンをクリック
    await sidePanel.evaluate((text) => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          readText: async () => text,
          writeText: async () => {},
        },
      });
    }, ndjson);

    await sidePanel.click("#settings-btn");

    // Playwright handle alert/confirm/prompt
    sidePanel.on("dialog", (dialog) => {
      if (dialog.type() === "prompt") {
        dialog.accept(ndjson);
      } else {
        dialog.accept();
      }
    });

    await sidePanel.click("#import-history-btn");
    await sidePanel.fill("#import-textarea", ndjson);
    await sidePanel.click("#confirm-import");
    await sidePanel.click("#close-settings");

    // 3. 未設定ホストとして表示されていることを確認
    const unconfiguredHeader = sidePanel.locator(".unconfigured-header");
    await expect(unconfiguredHeader).toBeVisible();

    const issueItem = sidePanel.locator(".issue-item.disabled");
    await expect(issueItem).toBeVisible();
    await expect(issueItem.locator(".indicator")).not.toHaveClass(/is-opened/); // Sanitization check

    // 4. クリックしてホスト追加ダイアログが出ることを確認
    await issueItem.click();
    const confirmDialog = sidePanel.locator("#confirm-dialog");
    await expect(confirmDialog).toBeVisible();
    await expect(sidePanel.locator("#confirm-message")).toContainText(
      "imported-host.atlassian.net",
    );

    await sidePanel.click("#confirm-ok");

    // 設定パネルのホスト追加ダイアログが開いているはず
    await expect(sidePanel.locator("#host-dialog")).toBeVisible();
    await expect(sidePanel.locator("#host-url")).toHaveValue(
      "imported-host.atlassian.net",
    );

    // 5. ホストを追加して通常表示に戻ることを確認
    await sidePanel.fill("#host-name", "Imported Jira");
    await sidePanel.click("#confirm-host");
    await sidePanel.click("#close-settings");

    await expect(unconfiguredHeader).not.toBeVisible();
    await expect(sidePanel.locator(".issue-item:not(.disabled)")).toBeVisible();
  });
});
