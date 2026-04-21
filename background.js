import { IssuesDB } from './db.js';

const db = new IssuesDB();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ISSUE_UPDATED') {
    const issueData = {
      ...message.data,
      tabId: sender.tab.id,
      isOpened: true
    };
    db.upsertIssue(issueData).then(() => {
      chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
    });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const issues = await db.getAllIssues();
  const issueToUpdate = issues.find(i => i.tabId === tabId);
  if (issueToUpdate) {
    await db.upsertIssue({
      url: issueToUpdate.url, // URL をキーに使用
      isOpened: false,
      isEditing: false,
      tabId: null
    });
    chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  // すべての JIRA インスタンスを対象にクエリ
  const tabs = await chrome.tabs.query({ url: "*://*/browse/*" });
  const openTabIds = new Set(tabs.map(t => t.id));

  const issues = await db.getAllIssues();
  for (const issue of issues) {
    if (issue.isOpened && !openTabIds.has(issue.tabId)) {
      await db.upsertIssue({
        url: issue.url,
        isOpened: false,
        isEditing: false,
        tabId: null
      });
    }
  }
});
