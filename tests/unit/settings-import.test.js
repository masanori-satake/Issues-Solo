import { SettingsManager } from "../../projects/app/modules/settings-manager.js";
import { IssuesDB } from "../../projects/app/db.js";

/**
 * handleSettingsImport のテスト
 */
describe("SettingsManager.handleSettingsImport", () => {
  let db;
  let renderer;
  let manager;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="settings-panel">
        <ul id="host-list"></ul>
        <ul id="project-list"></ul>
        <input type="range" id="max-history-range">
        <span id="max-history-value"></span>
        <div id="host-dialog">
          <h3 id="host-dialog-title"></h3>
          <input id="host-name">
          <input id="host-url">
          <button id="confirm-host"></button>
        </div>
        <div id="project-dialog">
          <h3 id="project-dialog-title"></h3>
          <input id="project-key-input">
          <button id="confirm-project"></button>
        </div>
        <div id="confirm-dialog">
          <span id="confirm-title"></span>
          <p id="confirm-message"></p>
          <button id="confirm-ok"></button>
          <button id="confirm-cancel"></button>
        </div>
      </div>
    `;

    db = new IssuesDB();
    renderer = { render: jest.fn() };

    global.chrome = {
      i18n: { getMessage: jest.fn().mockImplementation((key) => key) },
      runtime: {
        sendMessage: jest.fn().mockReturnValue({ catch: jest.fn() }),
      },
      permissions: {
        getAll: jest.fn().mockResolvedValue({ origins: [] }),
        request: jest.fn().mockResolvedValue(true),
        remove: jest.fn().mockResolvedValue(true),
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn().mockImplementation((data, cb) => cb && cb()),
        },
      },
    };

    manager = new SettingsManager(db, renderer);
    // Mock db methods that interact with chrome.storage
    db.getSettings = jest.fn().mockResolvedValue([]);
    db.getProjectSettings = jest.fn().mockResolvedValue([]);
    db.getMaxHistoryCount = jest.fn().mockResolvedValue(50);
    db.processSettingsImport = jest
      .fn()
      .mockImplementation(async (json, mode) => {
        const data = JSON.parse(json);
        if (mode === "overwrite") {
          return {
            settings: data.settings || [],
            projectSettings: data.projectSettings || [],
            maxHistoryCount: data.maxHistoryCount || 50,
          };
        } else {
          return {
            settings: data.settings || [],
            projectSettings: data.projectSettings || [],
          };
        }
      });

    global.alert = jest.fn();
  });

  test("should request permissions for new hosts during import", async () => {
    const importData = {
      settings: [{ id: "1", name: "New Jira", url: "new-jira.com" }],
    };

    await manager.handleSettingsImport(JSON.stringify(importData), "add");

    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ["https://new-jira.com/*"],
    });
    expect(chrome.storage.local.set).toHaveBeenCalled();
    expect(global.alert).toHaveBeenCalledWith("settingsImportSuccess");
  });

  test("should exclude host if permission is denied", async () => {
    const importData = {
      settings: [
        { id: "1", name: "Denied Jira", url: "denied.com" },
        { id: "2", name: "Allowed Jira", url: "allowed.com" },
      ],
    };

    chrome.permissions.request
      .mockResolvedValueOnce(false) // Denied
      .mockResolvedValueOnce(true); // Allowed

    await manager.handleSettingsImport(JSON.stringify(importData), "add");

    const savedData = chrome.storage.local.set.mock.calls[0][0];
    expect(savedData.settings.length).toBe(1);
    expect(savedData.settings[0].url).toBe("allowed.com");
  });

  test("should remove unused permissions in overwrite mode", async () => {
    db.getSettings.mockResolvedValue([
      { id: "old", name: "Old Jira", url: "old-jira.com" },
    ]);

    chrome.permissions.getAll.mockResolvedValue({
      origins: ["https://old-jira.com/*"],
    });

    const importData = {
      settings: [{ id: "new", name: "New Jira", url: "new-jira.com" }],
    };

    await manager.handleSettingsImport(JSON.stringify(importData), "overwrite");

    expect(chrome.permissions.remove).toHaveBeenCalledWith({
      origins: ["https://old-jira.com/*"],
    });
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ["https://new-jira.com/*"],
    });
  });

  test("should not request permissions for builtin hosts", async () => {
    const importData = {
      settings: [{ id: "cloud", name: "Jira Cloud", url: "atlassian.net" }],
    };

    await manager.handleSettingsImport(JSON.stringify(importData), "add");

    expect(chrome.permissions.request).not.toHaveBeenCalled();
  });
});
