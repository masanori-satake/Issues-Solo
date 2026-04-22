export class IssuesDB {
  constructor() {
    this.dbName = 'IssuesSoloDB';
    this.dbVersion = 3; // バージョンアップ: tabId インデックスの追加
    this.storeName = 'issues';
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
          store = db.createObjectStore(this.storeName, { keyPath: 'url' });
        } else {
          store = event.currentTarget.transaction.objectStore(this.storeName);
        }

        if (!store.indexNames.contains('tabId')) {
          store.createIndex('tabId', 'tabId', { unique: false });
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
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const getRequest = store.get(issue.url);
      getRequest.onsuccess = () => {
        const existing = getRequest.result || {};
        const updated = { ...existing, ...issue, lastAccessed: Date.now() };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearTabAssociation(tabId, exceptUrl = null) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('tabId');
      const request = index.openCursor(IDBKeyRange.only(tabId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const issue = cursor.value;
          if (issue.url !== exceptUrl) {
            issue.isOpened = false;
            issue.isEditing = false;
            issue.tabId = null;
            cursor.update(issue);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllIssues() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const issues = request.result.sort((a, b) => b.lastAccessed - a.lastAccessed);
        resolve(issues);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteIssue(url) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(url);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
