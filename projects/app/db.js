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
      getRequest.onsuccess = async () => {
        const existing = getRequest.result || {};
        const updated = { ...existing, ...issue, lastAccessed: Date.now() };
        const putRequest = store.put(updated);

        putRequest.onsuccess = async () => {
          // 履歴上限チェック
          const countRequest = store.count();
          countRequest.onsuccess = async () => {
            if (countRequest.result > maxCount) {
              const allIssues = await this.getAllIssues();
              const toDelete = allIssues.slice(maxCount);
              const deleteTransaction = db.transaction(
                [this.storeName],
                "readwrite",
              );
              const deleteStore = deleteTransaction.objectStore(this.storeName);
              for (const item of toDelete) {
                deleteStore.delete(item.url);
              }
              deleteTransaction.oncomplete = () => resolve();
            } else {
              resolve();
            }
          };
        };
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
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
          (a, b) => b.lastAccessed - a.lastAccessed,
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

    if (mode === "overwrite") {
      await this.clearAllIssues();
    }

    // 重複を考慮しつつインポート（overwriteなら全件、addなら既存を優先するか上書きするか）
    // ここでは単純に upsertIssue を使う（最新の visitation 情報が保持されるため）
    // ただし、一括処理の方が効率的なので transaction を手動で制御する
    const db = await this.open();
    const maxCount = await this.getMaxHistoryCount();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      for (const issue of issues) {
        store.put(issue);
      }

      transaction.oncomplete = async () => {
        // インポート後の上限チェック
        const allIssues = await this.getAllIssues();
        if (allIssues.length > maxCount) {
          const toDelete = allIssues.slice(maxCount);
          const deleteTransaction = db.transaction(
            [this.storeName],
            "readwrite",
          );
          const deleteStore = deleteTransaction.objectStore(this.storeName);
          for (const item of toDelete) {
            deleteStore.delete(item.url);
          }
          deleteTransaction.oncomplete = () => resolve();
        } else {
          resolve();
        }
      };
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
            if (!newProjectSettings.some((existing) => existing.key === ps.key)) {
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
