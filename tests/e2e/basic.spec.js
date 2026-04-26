import { test, expect } from './fixtures';

test('should load the extension sidepanel', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const title = await page.textContent('title');
  expect(title).toBe('Issues-Solo');
});
