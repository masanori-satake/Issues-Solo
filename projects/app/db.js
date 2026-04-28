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

  async getIssueCount() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
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
   * 履歴の件数を上限数に収まるように古いものから削除します。
   *
   * @param {number} maxCount 保持する履歴の最大件数
   * @returns {Promise<void>}
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
   * 指定されたオブジェクトストアに対して、履歴上限を適用します。
   * 最終表示時刻（lastAccessed）が古い順に削除対象を決定します。
   *
   * @private
   * @param {IDBObjectStore} store 対象のオブジェクトストア
   * @param {number} maxCount 保持する最大件数
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
   * NDJSON形式のテキストから履歴データをインポートします。
   * インポートされた課題は、一貫性のため「未読・タブ未紐付け」状態で保存されます。
   *
   * @param {string} ndjsonText インポートするNDJSON文字列
   * @param {string} mode "add"（追加）または "overwrite"（全削除後に上書き）
   * @returns {Promise<void>}
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
        // 他のブラウザや再インストール時での不整合を防ぐため、開閉状態をリセットする
        issue.isOpened = false;
        issue.tabId = null;

        store.put(issue);
      }

      this._applyMaxHistoryLimit(store, maxCount);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 設定データのインポート用にデータを処理します。
   *
   * 背景：外部からインポートされるデータは、現在の設定とマージ（追加モード）
   * または完全に置換（上書きモード）する必要があります。その際、設定IDの重複回避
   * や、不足しているプロパティの補完などの整合性チェックを行います。
   *
   * @param {string} jsonText インポートするJSON文字列
   * @param {string} mode "add"（マージ） または "overwrite"（置換）
   * @returns {Promise<Object>} 処理済みの設定データ（chrome.storageにそのまま保存可能な形式）
   * @throws {Error} JSONのパースに失敗した場合などにスロー
   */
  async processSettingsImport(jsonText, mode = "add") {
    try {
      const data = JSON.parse(jsonText);
      const getNextId = (currentMaxId) => {
        let nextId = Math.max(Date.now(), currentMaxId + 1);
        return () => (nextId++).toString();
      };

      if (mode === "overwrite") {
        const toSet = {};
        if (data.settings) {
          const maxId = data.settings.reduce(
            (max, s) => Math.max(max, parseInt(s.id, 10) || 0),
            0,
          );
          const generateId = getNextId(maxId);
          const seenIds = new Set();

          toSet.settings = data.settings.map((s) => {
            // インポートデータ内のIDの重複や欠落を修正して一貫性を保つ
            if (!s.id || seenIds.has(s.id)) {
              s.id = generateId();
            }
            seenIds.add(s.id);
            return s;
          });
        }
        if (data.projectSettings) toSet.projectSettings = data.projectSettings;
        if (data.otherCollapsed !== undefined)
          toSet.otherCollapsed = data.otherCollapsed;
        if (data.maxHistoryCount !== undefined)
          toSet.maxHistoryCount = data.maxHistoryCount;

        return toSet;
      }

      // 追加モード（デフォルト）
      const currentSettings = await this.getSettings();
      const currentProjectSettings = await this.getProjectSettings();

      const newSettings = [...currentSettings];
      if (data.settings) {
        const maxIdInCurrent = currentSettings.reduce(
          (max, s) => Math.max(max, parseInt(s.id, 10) || 0),
          0,
        );
        const maxIdInImport = data.settings.reduce(
          (max, s) => Math.max(max, parseInt(s.id, 10) || 0),
          0,
        );
        const generateId = getNextId(Math.max(maxIdInCurrent, maxIdInImport));
        const seenIds = new Set(newSettings.map((s) => s.id));

        for (const s of data.settings) {
          // すでに同じURLのホストが登録されている場合はスキップ
          if (!newSettings.some((existing) => existing.url === s.url)) {
            // IDが既存のものと重複する場合は新しく採番
            if (!s.id || seenIds.has(s.id)) {
              s.id = generateId();
            }
            seenIds.add(s.id);
            newSettings.push(s);
          }
        }
      }

      const newProjectSettings = [...currentProjectSettings];
      if (data.projectSettings) {
        for (const ps of data.projectSettings) {
          // すでに同じキーのプロジェクトが登録されている場合はスキップ
          if (!newProjectSettings.some((existing) => existing.key === ps.key)) {
            newProjectSettings.push(ps);
          }
        }
      }

      return {
        settings: newSettings,
        projectSettings: newProjectSettings,
      };
    } catch (e) {
      throw e;
    }
  }
}
