import { test, expect } from "./fixtures";

/**
 * 異常系や特殊なページ状態に関する E2E テスト。
 * Jira UI の構造変化や遅延ロードへの対応を検証します。
 */
test.describe("Jira UI Changes and Edge Cases", () => {
  test("should extract information even if Jira UI changes (fallback test)", async ({
    page,
    context,
    extensionId,
  }) => {
    // 既存のセレクタにマッチしないが h1 は存在するページをシミュレート
    await page.route(
      "https://test.atlassian.net/browse/FALLBACK-1",
      async (route) => {
        await route.fulfill({
          contentType: "text/html",
          body: `
          <html>
            <head><title>Jira Fallback</title></head>
            <body>
              <h1>Fallback Title</h1>
              <div class="new-jira-priority">High</div>
              <div class="new-jira-status">Done</div>
              <div id="jira-frontend"></div>
            </body>
          </html>
        `,
        });
      },
    );

    await page.goto("https://test.atlassian.net/browse/FALLBACK-1");
    await page.waitForTimeout(1000);

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // フォールバックロジックによりタイトルが抽出されることを確認
    const issueItem = sidePanel.locator(".issue-item");
    await expect(issueItem).toBeVisible();
    await expect(issueItem.locator(".issue-key")).toHaveText("FALLBACK-1");
    await expect(issueItem.locator(".issue-title")).toHaveText(
      "Fallback Title",
    );
  });

  test("should handle network failure / partial load", async ({
    page,
    context,
    extensionId,
  }) => {
    // タイトルが空の状態でロードされるページをシミュレート
    await page.route(
      "https://test.atlassian.net/browse/SLOW-1",
      async (route) => {
        await route.fulfill({
          contentType: "text/html",
          body: '<html><head><title></title></head><body><div id="jira-frontend"></div></body></html>',
        });
      },
    );

    await page.goto("https://test.atlassian.net/browse/SLOW-1");

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // キーさえ取得できれば、タイトルが空でも履歴に表示されることを確認
    await expect(sidePanel.locator(".issue-item")).toBeVisible();
    await expect(sidePanel.locator(".issue-item .issue-key")).toHaveText(
      "SLOW-1",
    );
  });
});
