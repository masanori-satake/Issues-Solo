import { test, expect } from './fixtures';

test.describe('Issues-Solo E2E', () => {
  test('should record history when visiting a Jira issue', async ({ page, context, extensionId }) => {
    // 1. Visit a Jira-like page (we mock the content because we don't have a real Jira)
    // For E2E we can use a local html file or a mock route
    await page.route('https://test.atlassian.net/browse/PROJ-1', async route => {
      await route.fulfill({
        contentType: 'text/html',
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
        `
      });
    });

    await page.goto('https://test.atlassian.net/browse/PROJ-1');

    // Wait for content script to run and send message
    await page.waitForTimeout(1000);

    // 2. Open side panel
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // 3. Verify history item exists
    const issueItem = sidePanel.locator('.issue-item');
    await expect(issueItem).toBeVisible();
    await expect(issueItem.locator('.issue-key')).toHaveText('PROJ-1');
    await expect(issueItem.locator('.issue-title')).toHaveText('Test Issue Summary');
  });

  test('should detect editing state', async ({ page, context, extensionId }) => {
    await page.route('https://test.atlassian.net/browse/PROJ-1', async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: `
          <html>
            <body>
              <h1 data-testid="issue.views.issue-base.foundation.summary.heading">Test</h1>
              <textarea id="comment"></textarea>
              <div id="jira-frontend"></div>
            </body>
          </html>
        `
      });
    });

    await page.goto('https://test.atlassian.net/browse/PROJ-1');

    // Open side panel
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Focus textarea to trigger editing state
    await page.focus('#comment');
    await page.type('#comment', 'Working on it');

    // Wait for debounce and message
    await page.waitForTimeout(1000);

    // Verify editing indicator in side panel
    const editIndicator = sidePanel.locator('.indicator.is-editing');
    await expect(editIndicator).toBeVisible();

    // Remove focus/Simulate save (mocking Jira save button behavior)
    // content.js detects editing if save/cancel buttons exist.
    // Let's mock that.
    await page.evaluate(() => {
        const btn = document.createElement('button');
        btn.innerText = 'Save';
        document.body.appendChild(btn);
        btn.click();
    });

    // In our simplified mock, we might need to manually trigger the click or wait
    await page.waitForTimeout(1000);
    // After "Save" click, it should stop editing (based on content.js handleClick)
    await expect(editIndicator).not.toBeVisible();
  });

  test('should handle navigation away from Jira', async ({ page, context, extensionId }) => {
    await page.route('https://test.atlassian.net/browse/PROJ-1', async route => {
        await route.fulfill({ body: '<html><body><h1 data-testid="issue.views.issue-base.foundation.summary.heading">Jira</h1><div id="jira-frontend"></div></body></html>', contentType: 'text/html' });
    });
    await page.route('https://google.com', async route => {
        await route.fulfill({ body: '<html><body>Google</body></html>', contentType: 'text/html' });
    });

    await page.goto('https://test.atlassian.net/browse/PROJ-1');
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await expect(sidePanel.locator('.indicator.is-opened')).toBeVisible();

    // Navigate away
    await page.goto('https://google.com');
    await page.waitForTimeout(1000);

    // opened indicator should be gone
    await expect(sidePanel.locator('.indicator.is-opened')).not.toBeVisible();
  });

  test('should handle host and project settings', async ({ context, extensionId }) => {
    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Open settings
    await sidePanel.click('#settings-btn');
    await sidePanel.click('[data-tab="projects"]');

    // Add project key
    await sidePanel.click('#add-project-btn');
    await sidePanel.fill('#project-key-input', 'TEST');
    await sidePanel.click('#confirm-add-project');

    // Verify project header in list (need to close settings or check list)
    await sidePanel.click('#close-settings');
    // We need at least one issue with TEST key to see the header
    // But since we are in E2E and DB is shared, we can visit a TEST page in another tab
    const page = await context.newPage();
    await page.route('https://test.atlassian.net/browse/TEST-1', async route => {
        await route.fulfill({ body: '<html><body><h1 data-testid="issue.views.issue-base.foundation.summary.heading">Test</h1><div id="jira-frontend"></div></body></html>', contentType: 'text/html' });
    });
    await page.goto('https://test.atlassian.net/browse/TEST-1');
    await page.waitForTimeout(1000);

    await expect(sidePanel.locator('.project-group-header')).toContainText('TEST');
  });
});
