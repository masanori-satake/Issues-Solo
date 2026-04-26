import { test, expect } from "./fixtures";

test.describe("Settings Reordering", () => {
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

  test("should reorder Jira hosts via drag and drop", async ({}, testInfo) => {
    const sidePanel = await getSidePanel(testInfo);
    await sidePanel.click("#settings-btn");

    // Add a second host
    await sidePanel.click("#add-host-btn");
    await sidePanel.fill("#host-name", "Second Jira");
    await sidePanel.fill("#host-url", "second.atlassian.net");
    await sidePanel.click("#confirm-host");

    const hostItems = sidePanel.locator(".host-item");
    await expect(hostItems).toHaveCount(2);

    const firstHostName = await hostItems
      .nth(0)
      .locator(".host-name")
      .textContent();
    const secondHostName = await hostItems
      .nth(1)
      .locator(".host-name")
      .textContent();

    expect(firstHostName).toBe("Jira Cloud");
    expect(secondHostName).toBe("Second Jira");

    // Drag the second host to the top
    const firstHost = hostItems.nth(0);
    const secondHost = hostItems.nth(1);

    await secondHost.hover();
    await sidePanel.mouse.down();
    // Move to the top half of the first host to trigger 'top' drop position
    const box = await firstHost.boundingBox();
    await sidePanel.mouse.move(box.x + box.width / 2, box.y + box.height / 4, {
      steps: 5,
    });
    await sidePanel.mouse.up();

    // Verify order changed
    await expect(hostItems.nth(0).locator(".host-name")).toHaveText(
      "Second Jira",
    );
    await expect(hostItems.nth(1).locator(".host-name")).toHaveText(
      "Jira Cloud",
    );

    // Reload sidepanel to verify persistence
    await sidePanel.reload();
    await sidePanel.click("#settings-btn");
    await expect(
      sidePanel.locator(".host-item").nth(0).locator(".host-name"),
    ).toHaveText("Second Jira");
  });

  test("should reorder project keys via drag and drop", async ({}, testInfo) => {
    const sidePanel = await getSidePanel(testInfo);
    await sidePanel.click("#settings-btn");
    await sidePanel.click('[data-tab="projects"]');

    // Add two projects
    await sidePanel.click("#add-project-btn");
    await sidePanel.fill("#project-key-input", "AAA");
    await sidePanel.click("#confirm-project");

    await sidePanel.click("#add-project-btn");
    await sidePanel.fill("#project-key-input", "BBB");
    await sidePanel.click("#confirm-project");

    const projectItems = sidePanel.locator(".project-item");
    await expect(projectItems).toHaveCount(2);

    expect(
      await projectItems.nth(0).locator(".project-key-label").textContent(),
    ).toBe("AAA");
    expect(
      await projectItems.nth(1).locator(".project-key-label").textContent(),
    ).toBe("BBB");

    // Drag BBB to the top
    const firstProj = projectItems.nth(0);
    const secondProj = projectItems.nth(1);

    await secondProj.hover();
    await sidePanel.mouse.down();
    const box = await firstProj.boundingBox();
    await sidePanel.mouse.move(box.x + box.width / 2, box.y + box.height / 4, {
      steps: 5,
    });
    await sidePanel.mouse.up();

    // Verify order changed
    await expect(projectItems.nth(0).locator(".project-key-label")).toHaveText(
      "BBB",
    );
    await expect(projectItems.nth(1).locator(".project-key-label")).toHaveText(
      "AAA",
    );

    // Reload sidepanel to verify persistence
    await sidePanel.reload();
    await sidePanel.click("#settings-btn");
    await sidePanel.click('[data-tab="projects"]');
    await expect(
      sidePanel.locator(".project-item").nth(0).locator(".project-key-label"),
    ).toHaveText("BBB");
  });
});
