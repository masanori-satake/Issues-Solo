import { test, expect } from "./fixtures";

/**
 * サイドパネルの各種設定機能を検証する E2E テスト。
 */
test.describe("Sidepanel Features", () => {
  test.beforeEach(async ({ context, extensionId }) => {
    // 各テストの前にサイドパネルを開く
    const sidePanel = await context.newPage();

    // Chrome 権限リクエストとアラートをモック化
    await sidePanel.addInitScript(() => {
      window.chrome = window.chrome || {};
      window.chrome.permissions = window.chrome.permissions || {};
      window.chrome.permissions.request = async () => true;
      window.alert = () => {};
    });

    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    test.info().annotations.push({ type: 'sidePanel', description: sidePanel });
  });

  async function getSidePanel(testInfo) {
    return testInfo.annotations.find(a => a.type === 'sidePanel').description;
  }

  test("should toggle settings panel and switch tabs", async ({ }, testInfo) => {
    const sidePanel = await getSidePanel(testInfo);

    // 設定を開く
    await sidePanel.click("#settings-btn");
    await expect(sidePanel.locator("#settings-panel")).not.toHaveClass(/hidden/);

    // プロジェクトタブに切り替え
    await sidePanel.click('[data-tab="projects"]');
    await expect(sidePanel.locator("#projects-tab")).toBeVisible();
    await expect(sidePanel.locator("#general-tab")).not.toBeVisible();

    // Aboutタブに切り替え
    await sidePanel.click('[data-tab="about"]');
    await expect(sidePanel.locator("#about-tab")).toBeVisible();
    await expect(sidePanel.locator("#projects-tab")).not.toBeVisible();

    // 設定を閉じる
    await sidePanel.click("#close-settings");
    await expect(sidePanel.locator("#settings-panel")).toHaveClass(/hidden/);
  });

  test("should manage project keys", async ({ }, testInfo) => {
    const sidePanel = await getSidePanel(testInfo);

    await sidePanel.click("#settings-btn");
    await sidePanel.click('[data-tab="projects"]');

    // プロジェクトを追加
    await sidePanel.click("#add-project-btn");
    await sidePanel.fill("#project-key-input", "NEWPROJ");
    await sidePanel.click("#confirm-add-project");

    // 追加されたことを確認
    await expect(sidePanel.locator(".project-item .project-key-label")).toContainText("NEWPROJ");

    // 色を変更
    const colorOption = sidePanel.locator(".color-option").nth(1);
    await colorOption.click();
    await expect(colorOption).toHaveClass(/selected/);

    // プロジェクトを削除
    await sidePanel.click(".project-item:has-text('NEWPROJ') .delete-btn");
    await expect(sidePanel.locator(".project-item:has-text('NEWPROJ')")).not.toBeVisible();
  });

  test("should manage Jira hosts", async ({ }, testInfo) => {
    const sidePanel = await getSidePanel(testInfo);

    await sidePanel.click("#settings-btn");

    // ホストを追加
    await sidePanel.click("#add-host-btn");
    await sidePanel.fill("#host-name", "Custom Jira");
    await sidePanel.fill("#host-url", "jira.custom.com");
    await sidePanel.click("#confirm-add-host");

    // 追加されたことを確認
    const hostItem = sidePanel.locator(".host-item", { hasText: "Custom Jira" });
    await expect(hostItem).toBeVisible();
    await expect(hostItem.locator(".host-name")).toContainText("Custom Jira");
    await expect(hostItem.locator(".host-url-preview")).toContainText("jira.custom.com");

    // 表示・非表示を切り替え
    const toggleBtn = hostItem.locator(".visibility-toggle");
    await expect(toggleBtn.locator(".material-symbols-outlined")).toHaveText("visibility");
    await toggleBtn.click();
    await expect(toggleBtn.locator(".material-symbols-outlined")).toHaveText("visibility_off");

    // ホストを削除
    await hostItem.locator(".delete-btn").click();
    await expect(hostItem).not.toBeVisible();
  });

  test("should clear history with confirmation", async ({ }, testInfo) => {
    const sidePanel = await getSidePanel(testInfo);

    await sidePanel.click("#settings-btn");
    await sidePanel.click("#clear-history-btn");

    await expect(sidePanel.locator("#confirm-dialog")).not.toHaveClass(/hidden/);
    await sidePanel.click("#confirm-ok");
    await expect(sidePanel.locator("#confirm-dialog")).toHaveClass(/hidden/);
  });
});
