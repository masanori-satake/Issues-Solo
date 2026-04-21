import { IssuesDB } from './db.js';

const db = new IssuesDB();

// サイドパネルを有効化
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ISSUE_UPDATED') {
    const issueData = {
      ...message.data,
      tabId: sender.tab.id,
      isOpened: true
    };
    db.upsertIssue(issueData).then(() => {
      // 必要に応じてサイドパネルに更新を通知
      chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {
        // サイドパネルが閉じてる場合はエラーになるが無視して良い
      });
    });
  }
});

// タブのクローズを監視
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const issues = await db.getAllIssues();
  const issueToUpdate = issues.find(i => i.tabId === tabId);
  if (issueToUpdate) {
    await db.upsertIssue({
      issueKey: issueToUpdate.issueKey,
      isOpened: false,
      isEditing: false,
      tabId: null
    });
    chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
  }
});

// 起動時に既存のタブをチェック
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: "https://*.atlassian.net/browse/*" });
  const openTabIds = new Set(tabs.map(t => t.id));

  const issues = await db.getAllIssues();
  for (const issue of issues) {
    if (issue.isOpened && !openTabIds.has(issue.tabId)) {
      await db.upsertIssue({
        issueKey: issue.issueKey,
        isOpened: false,
        isEditing: false,
        tabId: null
      });
    }
  }
});
