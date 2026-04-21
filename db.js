export class IssuesDB {
  constructor() {
    this.dbName = 'IssuesSoloDB';
    this.dbVersion = 1;
    this.storeName = 'issues';
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'issueKey' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async upsertIssue(issue) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // 既存のデータを取得してマージ（一部のフィールドのみ更新される場合に対応）
      const getRequest = store.get(issue.issueKey);
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

  async getAllIssues() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        // lastAccessed 降順でソート
        const issues = request.result.sort((a, b) => b.lastAccessed - a.lastAccessed);
        resolve(issues);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteIssue(issueKey) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(issueKey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
