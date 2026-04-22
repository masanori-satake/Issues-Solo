import { IssuesDB } from './db.js';

const db = new IssuesDB();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ISSUE_UPDATED') {
    handleIssueUpdated(message.data, sender.tab.id);
  }
});

async function handleIssueUpdated(data, tabId) {
  const issues = await db.getAllIssues();

  // 同じタブで以前開いていた他の課題のステータスを更新
  for (const issue of issues) {
    if (issue.tabId === tabId && issue.url !== data.url) {
      await db.upsertIssue({
        url: issue.url,
        isOpened: false,
        isEditing: false,
        tabId: null
      });
    }
  }

  const issueData = {
    ...data,
    tabId: tabId,
    isOpened: true
  };
  await db.upsertIssue(issueData);
  chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const issues = await db.getAllIssues();
  const issuesToUpdate = issues.filter(i => i.tabId === tabId);

  if (issuesToUpdate.length > 0) {
    for (const issue of issuesToUpdate) {
      await db.upsertIssue({
        url: issue.url,
        isOpened: false,
        isEditing: false,
        tabId: null
      });
    }
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
