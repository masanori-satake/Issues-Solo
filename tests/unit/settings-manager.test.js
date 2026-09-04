import { SettingsManager } from "../../projects/app/modules/settings-manager.js";

/**
 * SettingsManager クラスのユニットテスト。
 * 設定パネルの表示、操作、統計情報の更新を検証します。
 */
describe("SettingsManager", () => {
  let db;
  let renderer;
  let manager;

  beforeEach(() => {
    // テスト用の DOM 構造を構築
    document.body.innerHTML = `
      <div id="settings-panel" class="hidden">
        <ul id="host-list"></ul>
        <ul id="project-list"></ul>
        <input type="range" id="max-history-range">
        <span id="max-history-value"></span>
        <div id="host-dialog" class="hidden">
          <h3 id="host-dialog-title"></h3>
          <input id="host-name">
          <input id="host-url">
          <button id="confirm-host"></button>
        </div>
        <div id="project-dialog" class="hidden">
          <h3 id="project-dialog-title"></h3>
          <input id="project-key-input">
          <button id="confirm-project"></button>
        </div>
        <div id="confirm-dialog" class="hidden">
          <span id="confirm-title"></span>
          <p id="confirm-message"></p>
          <button id="confirm-ok"></button>
          <button id="confirm-cancel"></button>
        </div>
        <div id="import-dialog" class="hidden">
          <h3 id="import-dialog-title"></h3>
          <textarea id="import-textarea"></textarea>
          <div id="import-error-msg" class="hidden"></div>
          <button id="confirm-import"></button>
          <button id="cancel-import"></button>
        </div>
        <div id="extension-version"></div>
        <div id="stat-hosts"></div>
        <div id="stat-projects"></div>
        <div id="stat-history"></div>
      </div>
    `;

    db = {
      getSettings: jest.fn().mockResolvedValue([]),
      setSettings: jest.fn().mockResolvedValue(undefined),
      getProjectSettings: jest.fn().mockResolvedValue([]),
      setProjectSettings: jest.fn().mockResolvedValue(undefined),
      getMaxHistoryCount: jest.fn().mockResolvedValue(50),
      setMaxHistoryCount: jest.fn().mockResolvedValue(undefined),
      getIssueCount: jest.fn().mockResolvedValue(0),
      getHistoryImportMode: jest.fn().mockResolvedValue("add"),
      getSettingsImportMode: jest.fn().mockResolvedValue("add"),
    };
    renderer = { render: jest.fn() };

    global.chrome = {
      i18n: { getMessage: jest.fn().mockImplementation((key) => key) },
      runtime: {
        getManifest: jest.fn().mockReturnValue({ version: "1.0.0" }),
        sendMessage: jest.fn().mockReturnValue({ catch: jest.fn() }),
      },
      permissions: { request: jest.fn().mockResolvedValue(true) },
    };

    manager = new SettingsManager(db, renderer);
  });

  test("should open panel and render settings", async () => {
    await manager.open();
    expect(
      document.getElementById("settings-panel").classList.contains("hidden"),
    ).toBe(false);
    expect(db.getSettings).toHaveBeenCalled();
    expect(db.getProjectSettings).toHaveBeenCalled();
  });

  test("should update stats", async () => {
    db.getSettings.mockResolvedValue([{ id: "1" }]);
    db.getProjectSettings.mockResolvedValue([{ key: "P1" }, { key: "P2" }]);
    db.getIssueCount.mockResolvedValue(10);

    await manager.updateAboutStats();

    expect(document.getElementById("stat-hosts").textContent).toBe("1");
    expect(document.getElementById("stat-projects").textContent).toBe("2");
    expect(document.getElementById("stat-history").textContent).toBe("10");
  });

  test("should show confirm dialog", () => {
    const onOk = jest.fn();
    manager.showConfirm("Title", "Message", onOk);

    expect(document.getElementById("confirm-title").textContent).toBe("Title");
    expect(document.getElementById("confirm-message").textContent).toBe(
      "Message",
    );
    expect(
      document.getElementById("confirm-dialog").classList.contains("hidden"),
    ).toBe(false);

    document.getElementById("confirm-ok").click();
    expect(onOk).toHaveBeenCalled();
    expect(
      document.getElementById("confirm-dialog").classList.contains("hidden"),
    ).toBe(true);
  });

  test("should render host settings", async () => {
    const mockSettings = [
      { id: "1", name: "Jira Cloud", url: "atlassian.net", visible: true },
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();

    const items = document.querySelectorAll(".host-item");
    expect(items.length).toBe(1);
    expect(items[0].querySelector(".host-name").textContent).toBe("Jira Cloud");
  });

  test("should toggle host visibility", async () => {
    const mockSettings = [
      { id: "1", name: "Jira", url: "atlassian.net", visible: true },
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();
    const toggle = document.querySelector(".visibility-toggle");
    await toggle.click();

    expect(mockSettings[0].visible).toBe(false);
    expect(db.setSettings).toHaveBeenCalledWith(mockSettings);
  });

  test("should delete host", async () => {
    const mockSettings = [
      { id: "1", name: "Jira", url: "atlassian.net", visible: true },
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();
    const deleteBtn = document.querySelector(".delete-btn");
    await deleteBtn.click();

    expect(db.setSettings).toHaveBeenCalledWith([]);
  });

  test("should render project settings with 2-row layout", async () => {
    const mockProj = [{ key: "PROJ", color: "#0061A4" }];
    db.getProjectSettings.mockResolvedValue(mockProj);

    await manager.renderProjectSettings();

    const items = document.querySelectorAll(".project-item");
    expect(items.length).toBe(1);

    const mainRow = items[0].querySelector(".project-item-main");
    const subRow = items[0].querySelector(".project-item-sub");
    expect(mainRow).not.toBeNull();
    expect(subRow).not.toBeNull();

    expect(mainRow.querySelector(".project-key-label").textContent).toBe(
      "PROJ",
    );
    expect(subRow.querySelector(".color-picker")).not.toBeNull();
  });

  test("should change project color", async () => {
    const mockProj = [{ key: "PROJ", color: "#0061A4" }];
    db.getProjectSettings.mockResolvedValue(mockProj);

    await manager.renderProjectSettings();
    const colorOption = document.querySelectorAll(".color-option")[1];
    await colorOption.click();

    expect(mockProj[0].color).not.toBe("#0061A4");
    expect(db.setProjectSettings).toHaveBeenCalled();
  });

  test("should add host", async () => {
    db.getSettings.mockResolvedValue([]);
    const mockName = "New Jira";
    const mockUrl = "new.atlassian.net";

    // addHost 内部で utils.js の normalizeHostInput が呼ばれる
    await manager.addHost(mockName, mockUrl);

    expect(db.setSettings).toHaveBeenCalled();
    expect(
      document.getElementById("host-dialog").classList.contains("hidden"),
    ).toBe(true);
  });

  test("should update host", async () => {
    const mockSettings = [
      { id: "1", name: "Old Name", url: "old.atlassian.net", visible: true },
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    const newName = "New Name";
    const newUrl = "new.atlassian.net";

    await manager.updateHost("1", newName, newUrl);

    expect(db.setSettings).toHaveBeenCalled();
    const updated = db.setSettings.mock.calls[0][0][0];
    expect(updated.name).toBe(newName);
    expect(updated.url).toBe("new.atlassian.net");
    expect(
      document.getElementById("host-dialog").classList.contains("hidden"),
    ).toBe(true);
  });

  test("should add project", async () => {
    db.getProjectSettings.mockResolvedValue([]);
    await manager.addProject("NEWPROJ");

    expect(db.setProjectSettings).toHaveBeenCalled();
    expect(
      document.getElementById("project-dialog").classList.contains("hidden"),
    ).toBe(true);
  });

  test("should update project", async () => {
    const mockProj = [{ key: "OLDPROJ", color: "#0061A4" }];
    db.getProjectSettings.mockResolvedValue(mockProj);

    await manager.updateProject("OLDPROJ", "NEWPROJ");

    expect(db.setProjectSettings).toHaveBeenCalled();
    const updated = db.setProjectSettings.mock.calls[0][0][0];
    expect(updated.key).toBe("NEWPROJ");
    expect(
      document.getElementById("project-dialog").classList.contains("hidden"),
    ).toBe(true);
  });

  test("should reorder hosts via drag and drop", async () => {
    const mockSettings = [
      { id: "1", name: "Host 1", url: "host1.net", visible: true },
      { id: "2", name: "Host 2", url: "host2.net", visible: true },
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();
    const items = document.querySelectorAll(".host-item");
    const firstItem = items[0];
    const secondItem = items[1];

    // Simulate drag start on Host 1
    const dragStartEvent = new Event("dragstart");
    dragStartEvent.dataTransfer = { setData: jest.fn(), effectAllowed: null };
    firstItem.dispatchEvent(dragStartEvent);

    expect(manager.draggingIndex).toBe(0);
    expect(manager.draggingType).toBe("host");

    // Simulate drop on Host 2 (at the bottom)
    const dropEvent = new Event("drop");
    dropEvent.preventDefault = jest.fn();
    dropEvent.clientY = 1000; // Large value to simulate bottom
    secondItem.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ top: 100, height: 50 });
    secondItem.dispatchEvent(dropEvent);

    // Wait for async drop handler
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(db.setSettings).toHaveBeenCalled();
    const newSettings = db.setSettings.mock.calls[0][0];
    expect(newSettings[0].name).toBe("Host 2");
    expect(newSettings[1].name).toBe("Host 1");
  });

  test("should move host via move buttons", async () => {
    const mockSettings = [
      { id: "1", name: "Host 1", url: "host1.net", visible: true },
      { id: "2", name: "Host 2", url: "host2.net", visible: true },
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();
    const items = document.querySelectorAll(".host-item");
    const downBtn = items[0].querySelector(".down-btn");

    await downBtn.click();

    expect(db.setSettings).toHaveBeenCalled();
    const newSettings = db.setSettings.mock.calls[0][0];
    expect(newSettings[0].name).toBe("Host 2");
    expect(newSettings[1].name).toBe("Host 1");
  });

  test("should move project via move buttons", async () => {
    const mockProj = [
      { key: "PROJ1", color: "#0061A4" },
      { key: "PROJ2", color: "#0061A4" },
    ];
    db.getProjectSettings.mockResolvedValue(mockProj);

    await manager.renderProjectSettings();
    const items = document.querySelectorAll(".project-item");
    const downBtn = items[0].querySelector(".down-btn");

    await downBtn.click();

    expect(db.setProjectSettings).toHaveBeenCalled();
    const newSettings = db.setProjectSettings.mock.calls[0][0];
    expect(newSettings[0].key).toBe("PROJ2");
    expect(newSettings[1].key).toBe("PROJ1");
  });

  test("should reorder projects via drag and drop", async () => {
    const mockProj = [
      { key: "PROJ1", color: "#0061A4" },
      { key: "PROJ2", color: "#0061A4" },
    ];
    db.getProjectSettings.mockResolvedValue(mockProj);

    await manager.renderProjectSettings();
    const items = document.querySelectorAll(".project-item");
    const firstItem = items[0];
    const secondItem = items[1];

    // Simulate drag start on Project 1
    const dragStartEvent = new Event("dragstart");
    dragStartEvent.dataTransfer = { setData: jest.fn(), effectAllowed: null };
    firstItem.dispatchEvent(dragStartEvent);

    expect(manager.draggingIndex).toBe(0);
    expect(manager.draggingType).toBe("project");

    // Simulate drop on Project 2 (at the bottom)
    const dropEvent = new Event("drop");
    dropEvent.preventDefault = jest.fn();
    dropEvent.clientY = 1000; // Large value to simulate bottom
    secondItem.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ top: 100, height: 50 });
    secondItem.dispatchEvent(dropEvent);

    // Wait for async drop handler
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(db.setProjectSettings).toHaveBeenCalled();
    const newSettings = db.setProjectSettings.mock.calls[0][0];
    expect(newSettings[0].key).toBe("PROJ2");
    expect(newSettings[1].key).toBe("PROJ1");
  });

  test("should open import dialog and handle confirm and cancel", async () => {
    const onConfirm = jest.fn().mockResolvedValue();
    manager.openImportDialog("history", onConfirm);

    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(false);
    expect(document.getElementById("import-dialog-title").textContent).toBe(
      "importHistoryTitle",
    );

    document.getElementById("import-textarea").value =
      '{"url":"https://test.atlassian.net/browse/TEST-1"}';
    document.getElementById("confirm-import").click();

    expect(onConfirm).toHaveBeenCalledWith(
      '{"url":"https://test.atlassian.net/browse/TEST-1"}',
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(true);
  });

  test("should show error in import dialog if confirm fails or text empty", async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error("Invalid JSON"));
    manager.openImportDialog("settings", onConfirm);

    document.getElementById("import-textarea").value = "invalid json";
    document.getElementById("confirm-import").click();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      document.getElementById("import-error-msg").classList.contains("hidden"),
    ).toBe(false);
    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(false);
    expect(document.getElementById("confirm-import").disabled).toBe(false);
  });

  test("should prevent re-entry during async confirm and clean up on closeImportDialog", async () => {
    let resolveConfirm;
    const onConfirm = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveConfirm = resolve;
      });
    });

    manager.openImportDialog("history", onConfirm);
    const confirmBtn = document.getElementById("confirm-import");
    document.getElementById("import-textarea").value =
      '{"url":"https://test.com"}';

    // First click
    confirmBtn.click();
    expect(confirmBtn.disabled).toBe(true);

    // Second click while running should not call onConfirm again
    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Resolve confirm
    resolveConfirm();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(true);
    expect(confirmBtn.disabled).toBe(false);
  });

  test("old confirmation resolving should not close a reopened import dialog", async () => {
    let resolveOldConfirm;
    const oldConfirm = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveOldConfirm = resolve;
        }),
    );
    const newConfirm = jest.fn().mockResolvedValue();

    manager.openImportDialog("history", oldConfirm);
    document.getElementById("import-textarea").value = "old import";
    document.getElementById("confirm-import").click();

    manager.closeImportDialog();
    manager.openImportDialog("settings", newConfirm);
    resolveOldConfirm();
    await Promise.resolve();

    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(false);
    expect(document.getElementById("confirm-import").disabled).toBe(false);

    document.getElementById("import-textarea").value = "new import";
    document.getElementById("confirm-import").click();
    expect(newConfirm).toHaveBeenCalledWith("new import");
  });

  test("old confirmation rejecting should not alter a reopened import dialog", async () => {
    let rejectOldConfirm;
    const oldConfirm = jest.fn(
      () =>
        new Promise((resolve, reject) => {
          rejectOldConfirm = reject;
        }),
    );

    manager.openImportDialog("history", oldConfirm);
    document.getElementById("import-textarea").value = "old import";
    document.getElementById("confirm-import").click();

    manager.closeImportDialog();
    manager.openImportDialog("settings", jest.fn().mockResolvedValue());
    rejectOldConfirm(new Error("old import failed"));
    await Promise.resolve();

    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(false);
    expect(
      document.getElementById("import-error-msg").classList.contains("hidden"),
    ).toBe(true);
    expect(document.getElementById("confirm-import").disabled).toBe(false);
  });

  test("closeImportDialog should hide dialog and remove event listeners", () => {
    const onConfirm = jest.fn().mockResolvedValue();
    manager.openImportDialog("history", onConfirm);

    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(false);

    manager.closeImportDialog();

    expect(
      document.getElementById("import-dialog").classList.contains("hidden"),
    ).toBe(true);

    // Clicking confirm now should not invoke onConfirm
    document.getElementById("import-textarea").value = "test";
    document.getElementById("confirm-import").click();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
