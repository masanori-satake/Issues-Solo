export class IssuesDB {
  constructor() {
    this.dbName = "IssuesSoloDB";
    this.dbVersion = 3; // バージョンアップ: tabId インデックスの追加
    this.storeName = "issues";
    this._db = null;
  }

  async open() {
    if (this._db) return this._db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        let store;
        if (!db.objectStoreNames.contains(this.storeName)) {
          store = db.createObjectStore(this.storeName, { keyPath: "url" });
        } else {
          store = event.currentTarget.transaction.objectStore(this.storeName);
        }

        if (!store.indexNames.contains("tabId")) {
          store.createIndex("tabId", "tabId", { unique: false });
        }
      };

      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async upsertIssue(issue) {
    const db = await this.open();
    const maxCount = await this.getMaxHistoryCount();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const getRequest = store.get(issue.url);
      getRequest.onsuccess = () => {
        const existing = getRequest.result || {};
        const updated = { ...existing, ...issue, lastAccessed: Date.now() };
        store.put(updated);
        this._applyMaxHistoryLimit(store, maxCount);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAllIssues() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearTabAssociation(tabId, exceptUrl = null) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("tabId");
      const request = index.openCursor(IDBKeyRange.only(tabId));
      let changed = false;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const issue = cursor.value;
          if (issue.url !== exceptUrl) {
            issue.isOpened = false;
            issue.isEditing = false;
            issue.tabId = null;
            cursor.update(issue);
            changed = true;
          }
          cursor.continue();
        } else {
          resolve(changed);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllIssues() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const issues = request.result.sort(
          (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
        );
        resolve(issues);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteIssue(url) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(url);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (result) => {
        if (result.settings) {
          resolve(result.settings);
        } else {
          const defaultSettings = [
            {
              id: Date.now().toString(),
              name: "Jira Cloud",
              url: "atlassian.net",
              visible: true,
            },
          ];
          chrome.storage.local.set({ settings: defaultSettings });
          resolve(defaultSettings);
        }
      });
    });
  }

  async setSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings }, () => {
        resolve();
      });
    });
  }

  async getProjectSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["projectSettings"], (result) => {
        if (result.projectSettings) {
          resolve(result.projectSettings);
        } else {
          resolve([]);
        }
      });
    });
  }

  async setProjectSettings(projectSettings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ projectSettings }, () => {
        resolve();
      });
    });
  }

  async getOtherCollapsed() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["otherCollapsed"], (result) => {
        resolve(!!result.otherCollapsed);
      });
    });
  }

  async setOtherCollapsed(otherCollapsed) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ otherCollapsed }, () => {
        resolve();
      });
    });
  }

  async getMaxHistoryCount() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["maxHistoryCount"], (result) => {
        resolve(result.maxHistoryCount || 50);
      });
    });
  }

  async setMaxHistoryCount(maxHistoryCount) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ maxHistoryCount }, () => {
        resolve();
      });
    });
  }

  async getHistoryImportMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["historyImportMode"], (result) => {
        resolve(result.historyImportMode || "add");
      });
    });
  }

  async setHistoryImportMode(historyImportMode) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ historyImportMode }, () => {
        resolve();
      });
    });
  }

  async getSettingsImportMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settingsImportMode"], (result) => {
        resolve(result.settingsImportMode || "add");
      });
    });
  }

  async setSettingsImportMode(settingsImportMode) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settingsImportMode }, () => {
        resolve();
      });
    });
  }

  async getSortSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["sortSettings"], (result) => {
        resolve(
          result.sortSettings || { type: "lastAccessed", direction: "desc" },
        );
      });
    });
  }

  async setSortSettings(sortSettings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ sortSettings }, () => {
        resolve();
      });
    });
  }

  /**
   * 履歴の件数を制限数に収まるよう削除する
   */
  async pruneIssues(maxCount) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      this._applyMaxHistoryLimit(store, maxCount);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * トランザクション内で履歴上限を適用する（内部用）
   */
  _applyMaxHistoryLimit(store, maxCount) {
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > maxCount) {
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const allIssues = getAllRequest.result.sort(
            (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
          );
          const toDelete = allIssues.slice(maxCount);
          for (const item of toDelete) {
            store.delete(item.url);
          }
        };
      }
    };
  }

  /**
   * 履歴データのインポート
   */
  async importIssues(ndjsonText, mode = "add") {
    const lines = ndjsonText.trim().split("\n");
    const issues = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter((i) => i && i.url);

    const db = await this.open();
    const maxCount = await this.getMaxHistoryCount();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      if (mode === "overwrite") {
        store.clear();
      }

      for (const issue of issues) {
        // インポートデータに lastAccessed がない場合に備えて現在時刻を付与
        if (!issue.lastAccessed) {
          issue.lastAccessed = Date.now();
        }
        store.put(issue);
      }

      this._applyMaxHistoryLimit(store, maxCount);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 設定データのインポート
   */
  async importSettings(jsonText, mode = "add") {
    try {
      const data = JSON.parse(jsonText);
      if (mode === "overwrite") {
        const toSet = {};
        if (data.settings) toSet.settings = data.settings;
        if (data.projectSettings) toSet.projectSettings = data.projectSettings;
        if (data.otherCollapsed !== undefined)
          toSet.otherCollapsed = data.otherCollapsed;
        if (data.maxHistoryCount !== undefined)
          toSet.maxHistoryCount = data.maxHistoryCount;

        return new Promise((resolve) => {
          chrome.storage.local.set(toSet, () => resolve());
        });
      } else {
        // 追加モード
        const currentSettings = await this.getSettings();
        const currentProjectSettings = await this.getProjectSettings();

        const newSettings = [...currentSettings];
        if (data.settings) {
          for (const s of data.settings) {
            if (!newSettings.some((existing) => existing.url === s.url)) {
              newSettings.push(s);
            }
          }
        }

        const newProjectSettings = [...currentProjectSettings];
        if (data.projectSettings) {
          for (const ps of data.projectSettings) {
            if (
              !newProjectSettings.some((existing) => existing.key === ps.key)
            ) {
              newProjectSettings.push(ps);
            }
          }
        }

        const toSet = {
          settings: newSettings,
          projectSettings: newProjectSettings,
        };
        // booleanや数値は上書きせざるを得ないが、addモードなら現在の値を優先
        return new Promise((resolve) => {
          chrome.storage.local.set(toSet, () => resolve());
        });
      }
    } catch (e) {
      console.error("Import failed", e);
      throw e;
    }
  }
}
