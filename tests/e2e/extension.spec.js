import { test, expect } from "./fixtures";

/**
 * 拡張機能全体の主要なユーザー体験（CUJ）を検証する E2E テスト。
 */
test.describe("Issues-Solo E2E", () => {
  test("should record history when visiting a Jira issue", async ({
    page,
    context,
    extensionId,
  }) => {
    // 1. Jira の課題ページをシミュレート
    await page.route(
      "https://test.atlassian.net/browse/PROJ-1",
      async (route) => {
        await route.fulfill({
          contentType: "text/html",
          body: `
          <html>
            <head><title>PROJ-1 Test Issue</title></head>
            <body>
              <h1 data-testid="issue.views.issue-base.foundation.summary.heading">Test Issue Summary</h1>
              <div data-testid="issue.views.issue-base.foundation.priority.priority-view">
                <img alt="High" />
              </div>
              <button data-testid="issue.views.issue-base.foundation.status.status-button-item">In Progress</button>
              <div id="jira-frontend"></div>
            </body>
          </html>
        `,
        });
      },
    );

    await page.goto("https://test.atlassian.net/browse/PROJ-1");

    // コンテンツスクリプトが実行され、メッセージが送信されるのを待機
    await page.waitForTimeout(1000);

    // 2. サイドパネルを開く
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // 3. 履歴アイテムが表示されていることを確認
    const issueItem = sidePanel.locator(".issue-item");
    await expect(issueItem).toBeVisible();
    await expect(issueItem.locator(".issue-key")).toHaveText("PROJ-1");
    await expect(issueItem.locator(".issue-title")).toHaveText(
      "Test Issue Summary",
    );
  });

  test("should detect editing state", async ({
    page,
    context,
    extensionId,
  }) => {
    await page.route(
      "https://test.atlassian.net/browse/PROJ-1",
      async (route) => {
        await route.fulfill({
          contentType: "text/html",
          body: `
          <html>
            <body>
              <h1 data-testid="issue.views.issue-base.foundation.summary.heading">Test</h1>
              <textarea id="comment"></textarea>
              <div id="jira-frontend"></div>
            </body>
          </html>
        `,
        });
      },
    );

    await page.goto("https://test.atlassian.net/browse/PROJ-1");

    // サイドパネルを開く
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // テキストエリアにフォーカスして編集状態をトリガー
    // 注: content.js の仕様変更により、フォーカスしただけでは「編集中」にならず、
    // 保存・キャンセルボタンが存在する必要がある。
    await page.evaluate(() => {
      const btn = document.createElement("button");
      btn.innerText = "Save";
      document.body.appendChild(btn);
    });
    await page.focus("#comment");
    await page.type("#comment", "Working on it");

    // デバウンス（300ms）とメッセージ送信を待機
    await page.waitForTimeout(1000);

    // サイドパネルで「編集中」インジケーターが表示されることを確認
    const editIndicator = sidePanel.locator(".indicator.is-editing");
    await expect(editIndicator).toBeVisible();

    // 保存ボタンのクリックをシミュレート（Jira の挙動を再現）
    await page.evaluate(() => {
      const btn = document.createElement("button");
      btn.innerText = "Save";
      document.body.appendChild(btn);
      btn.click();
    });

    await page.waitForTimeout(1000);
    // 保存後は「編集中」状態が解除されることを確認
    await expect(editIndicator).not.toBeVisible();
  });

  test("should handle navigation away from Jira", async ({
    page,
    context,
    extensionId,
  }) => {
    await page.route(
      "https://test.atlassian.net/browse/PROJ-1",
      async (route) => {
        await route.fulfill({
          body: '<html><body><h1 data-testid="issue.views.issue-base.foundation.summary.heading">Jira</h1><div id="jira-frontend"></div></body></html>',
          contentType: "text/html",
        });
      },
    );
    await page.route("https://google.com", async (route) => {
      await route.fulfill({
        body: "<html><body>Google</body></html>",
        contentType: "text/html",
      });
    });

    await page.goto("https://test.atlassian.net/browse/PROJ-1");
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await expect(sidePanel.locator(".indicator.is-opened")).toBeVisible();

    // Navigate away
    await page.goto("https://google.com");
    await page.waitForTimeout(1000);

    // Jira 以外のページに遷移した後は「開いている」インジケーターが消えることを確認
    await expect(sidePanel.locator(".indicator.is-opened")).not.toBeVisible();
  });

  test("should handle host and project settings", async ({
    context,
    extensionId,
  }) => {
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // 設定を開く
    await sidePanel.click("#settings-btn");
    await sidePanel.click('[data-tab="projects"]');

    // プロジェクトキーを追加
    await sidePanel.click("#add-project-btn");
    await sidePanel.fill("#project-key-input", "TEST");
    await sidePanel.click("#confirm-project");

    // プロジェクトグループのヘッダーが表示されることを確認
    await sidePanel.click("#close-settings");

    // テスト用の課題ページを別タブで開き、DB に記録させる
    const page = await context.newPage();
    await page.route(
      "https://test.atlassian.net/browse/TEST-1",
      async (route) => {
        await route.fulfill({
          body: '<html><body><h1 data-testid="issue.views.issue-base.foundation.summary.heading">Test</h1><div id="jira-frontend"></div></body></html>',
          contentType: "text/html",
        });
      },
    );
    await page.goto("https://test.atlassian.net/browse/TEST-1");
    await page.waitForTimeout(1000);

    await expect(sidePanel.locator(".project-group-header")).toContainText(
      "TEST",
    );
  });
});
