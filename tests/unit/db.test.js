import { chrome } from "jest-chrome";
import { IssuesDB } from "../../projects/app/db.js";

/**
 * IssuesDB クラスのユニットテスト。
 * IndexedDB と chrome.storage.local の相互作用を検証します。
 */

// 古い Node.js 環境や JSDOM 用の structuredClone ポリフィル
if (typeof global.structuredClone !== "function") {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

describe("IssuesDB", () => {
  let db;

  beforeEach(() => {
    db = new IssuesDB();
    global.chrome = chrome;
  });

  afterEach(async () => {
    if (db._db) {
      db._db.close();
      db._db = null;
    }
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("IssuesSoloDB");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
    jest.clearAllMocks();
  });

  test("should open the database", async () => {
    const database = await db.open();
    expect(database.name).toBe("IssuesSoloDB");
    expect(database.version).toBe(3);
  });

  test("upsertIssue and getAllIssues", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });

    const issue1 = {
      url: "https://test.atlassian.net/browse/PROJ-1",
      issueKey: "PROJ-1",
      title: "Test Issue 1",
      lastAccessed: 1000,
    };
    const issue2 = {
      url: "https://test.atlassian.net/browse/PROJ-2",
      issueKey: "PROJ-2",
      title: "Test Issue 2",
      lastAccessed: 2000,
    };

    await db.upsertIssue(issue1);
    await db.upsertIssue(issue2);

    const issues = await db.getAllIssues();
    expect(issues.length).toBe(2);
    // 最終表示時刻の降順でソートされていることを確認
    expect(issues[0].issueKey).toBe("PROJ-2");
    expect(issues[1].issueKey).toBe("PROJ-1");
  });

  test("getIssueCount", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });
    await db.upsertIssue({ url: "url1", issueKey: "K1" });
    await db.upsertIssue({ url: "url2", issueKey: "K2" });
    const count = await db.getIssueCount();
    expect(count).toBe(2);
  });

  test("deleteIssue", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });
    await db.upsertIssue({ url: "url1", issueKey: "K1" });
    await db.deleteIssue("url1");
    const count = await db.getIssueCount();
    expect(count).toBe(0);
  });

  test("clearAllIssues", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });
    await db.upsertIssue({ url: "url1", issueKey: "K1" });
    await db.upsertIssue({ url: "url2", issueKey: "K2" });
    await db.clearAllIssues();
    const count = await db.getIssueCount();
    expect(count).toBe(0);
  });

  test("clearTabAssociation", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });
    await db.upsertIssue({
      url: "url1",
      issueKey: "K1",
      tabId: 123,
      isOpened: true,
    });
    await db.upsertIssue({
      url: "url2",
      issueKey: "K2",
      tabId: 123,
      isOpened: true,
    });

    const changed = await db.clearTabAssociation(123, "url1");
    expect(changed).toBe(true);

    const issues = await db.getAllIssues();
    const i1 = issues.find((i) => i.url === "url1");
    const i2 = issues.find((i) => i.url === "url2");

    // url1 は除外URLとして指定したため、変更されないことを確認
    expect(i1.tabId).toBe(123);
    expect(i1.isOpened).toBe(true);

    // url2 は同じタブIDを持っていたため、フラグがクリアされることを確認
    expect(i2.tabId).toBeNull();
    expect(i2.isOpened).toBe(false);
  });

  test("storage settings: getSettings/setSettings", async () => {
    const mockSettings = [
      { id: "1", name: "Jira", url: "jira.com", visible: true },
    ];

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (keys.includes("settings")) callback({ settings: mockSettings });
      else callback({});
    });
    chrome.storage.local.set.mockImplementation(
      (obj, callback) => callback && callback(),
    );

    const settings = await db.getSettings();
    expect(settings).toEqual(mockSettings);

    await db.setSettings(mockSettings);
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  test("pruneIssues (history limit)", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 10 });
    });

    // 順序を制御するため、IndexedDBに直接データを投入
    const database = await db.open();
    const tx = database.transaction(["issues"], "readwrite");
    const store = tx.objectStore("issues");
    store.put({ url: "url1", issueKey: "K1", lastAccessed: 1000 });
    store.put({ url: "url2", issueKey: "K2", lastAccessed: 2000 });
    store.put({ url: "url3", issueKey: "K3", lastAccessed: 3000 });
    store.put({ url: "url4", issueKey: "K4", lastAccessed: 4000 });
    store.put({ url: "url5", issueKey: "K5", lastAccessed: 5000 });

    await new Promise((r) => (tx.oncomplete = r));

    // 履歴を3件に制限（prune）
    await db.pruneIssues(3);

    const issues = await db.getAllIssues();
    expect(issues.length).toBe(3);

    const keys = issues.map((i) => i.issueKey);
    // 最終表示時刻の降順（K5, K4, K3...）のうち、新しい方から3件残ることを確認
    expect(keys).toContain("K5");
    expect(keys).toContain("K4");
    expect(keys).toContain("K3");
  });

  test("importIssues - add mode", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });
    await db.upsertIssue({ url: "url1", issueKey: "K1" });
    const ndjson =
      JSON.stringify({ url: "url2", issueKey: "K2" }) +
      "\n" +
      JSON.stringify({ url: "url3", issueKey: "K3" });

    await db.importIssues(ndjson, "add");
    const count = await db.getIssueCount();
    expect(count).toBe(3);
  });

  test("importIssues - overwrite mode", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });
    await db.upsertIssue({ url: "url1", issueKey: "K1" });
    const ndjson = JSON.stringify({ url: "url2", issueKey: "K2" });

    await db.importIssues(ndjson, "overwrite");
    const issues = await db.getAllIssues();
    expect(issues.length).toBe(1);
    expect(issues[0].issueKey).toBe("K2");
  });

  test("importIssues - invalid json handling", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ maxHistoryCount: 50 });
    });
    const ndjson =
      '{"url": "url1", "issueKey": "K1"}\nINVALID\n{"url": "url2", "issueKey": "K2"}';
    await db.importIssues(ndjson, "add");
    const count = await db.getIssueCount();
    expect(count).toBe(2);
  });

  test("importSettings - overwrite mode", async () => {
    const settingsData = {
      settings: [
        { id: "1", name: "New Jira", url: "new.jira.com", visible: true },
      ],
      projectSettings: [{ key: "NEW", color: "#000000" }],
      maxHistoryCount: 100,
    };

    chrome.storage.local.set.mockImplementation(
      (obj, callback) => callback && callback(),
    );

    await db.importSettings(JSON.stringify(settingsData), "overwrite");
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: settingsData.settings,
        projectSettings: settingsData.projectSettings,
        maxHistoryCount: 100,
      }),
      expect.any(Function),
    );
  });

  test("importSettings - add mode", async () => {
    // 追加モードでは、既存の設定は維持され、新しい設定のみが追加される
    const currentProjectSettings = [{ key: "OLD", color: "#FFFFFF" }];
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (keys.includes("projectSettings"))
        callback({ projectSettings: currentProjectSettings });
      else if (keys.includes("settings")) callback({ settings: [] });
      else callback({});
    });
    chrome.storage.local.set.mockImplementation(
      (obj, callback) => callback && callback(),
    );

    const settingsData = {
      settings: [{ id: "2", name: "New", url: "new.com", visible: true }], // 重複がなければ追加
      projectSettings: [
        { key: "OLD", color: "#CHANGED" }, // 既存キーは無視（上書きしない）
        { key: "NEW", color: "#000000" }, // 新規キーは追加
      ],
    };

    await db.importSettings(JSON.stringify(settingsData), "add");

    const setCall = chrome.storage.local.set.mock.calls.find(
      (call) => call[0].projectSettings,
    );
    const updatedProjectSettings = setCall[0].projectSettings;
    expect(updatedProjectSettings.length).toBe(2);
    expect(
      updatedProjectSettings.some(
        (p) => p.key === "OLD" && p.color === "#FFFFFF",
      ),
    ).toBe(true);
    expect(updatedProjectSettings.some((p) => p.key === "NEW")).toBe(true);
  });

  test("getOtherCollapsed - default and set", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) =>
      callback({}),
    );
    expect(await db.getOtherCollapsed()).toBe(false);

    await db.setOtherCollapsed(true);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { otherCollapsed: true },
      expect.any(Function),
    );
  });

  test("getSortSettings - default and set", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) =>
      callback({}),
    );
    expect(await db.getSortSettings()).toEqual({
      type: "lastAccessed",
      direction: "desc",
    });

    const newSort = { type: "issueKey", direction: "asc" };
    await db.setSortSettings(newSort);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { sortSettings: newSort },
      expect.any(Function),
    );
  });

  test("history import modes", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) =>
      callback({}),
    );
    expect(await db.getHistoryImportMode()).toBe("add");
    await db.setHistoryImportMode("overwrite");
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { historyImportMode: "overwrite" },
      expect.any(Function),
    );
  });

  test("settings import modes", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) =>
      callback({}),
    );
    expect(await db.getSettingsImportMode()).toBe("add");
    await db.setSettingsImportMode("overwrite");
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { settingsImportMode: "overwrite" },
      expect.any(Function),
    );
  });

  test("importSettings - handle missing fields in overwrite mode", async () => {
    const settingsData = { maxHistoryCount: 20 };
    await db.importSettings(JSON.stringify(settingsData), "overwrite");
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { maxHistoryCount: 20 },
      expect.any(Function),
    );
  });

  test("importSettings - invalid json", async () => {
    await expect(db.importSettings("invalid")).rejects.toThrow();
  });

  test("upsertIssue - update existing issue", async () => {
    chrome.storage.local.get.mockImplementation((keys, callback) =>
      callback({ maxHistoryCount: 50 }),
    );
    const url = "https://test.com";
    await db.upsertIssue({ url, title: "Title 1" });
    await db.upsertIssue({ url, title: "Title 2" });
    const issues = await db.getAllIssues();
    expect(issues.length).toBe(1);
    expect(issues[0].title).toBe("Title 2");
  });

  test("db open error handling", async () => {
    const error = new Error("DB Open Error");
    jest.spyOn(indexedDB, "open").mockImplementation(() => {
      const req = {};
      setTimeout(() => req.onerror(), 0);
      req.error = error;
      return req;
    });
    const newDb = new IssuesDB();
    await expect(newDb.open()).rejects.toBe(error);
    jest.restoreAllMocks();
  });

  test("db upgrade handling", async () => {
    // 複数回 open を呼んでも同一のインスタンスが返る（キャッシュが効いている）ことを確認
    const database1 = await db.open();
    const database2 = await db.open();
    expect(database1).toBe(database2);
  });
});
