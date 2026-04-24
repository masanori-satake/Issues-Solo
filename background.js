import { IssuesDB } from './db.js';

const db = new IssuesDB();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ISSUE_UPDATED') {
    handleIssueUpdated(message.data, sender.tab.id);
  } else if (message.type === 'CLEAR_TAB_ASSOCIATION') {
    handleClearTabAssociation(sender.tab.id);
  }
});

async function handleIssueUpdated(data, tabId) {
  // 同じタブで以前開いていた他の課題のステータスを効率的に更新
  await db.clearTabAssociation(tabId, data.url);

  const issueData = {
    ...data,
    tabId: tabId,
    isOpened: true
  };
  await db.upsertIssue(issueData);
  chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
}

async function handleClearTabAssociation(tabId) {
  const changed = await db.clearTabAssociation(tabId);
  if (changed) {
    chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
  }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const changed = await db.clearTabAssociation(tabId);
  if (changed) {
    chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URLが変更され、かつ新しいURLがJiraの課題ページでない場合
  if (changeInfo.url) {
    const isIssuePage = /\/(?:browse|issues)\/([A-Z0-9]+-[0-9]+)/.test(changeInfo.url);
    if (!isIssuePage) {
      const changed = await db.clearTabAssociation(tabId);
      if (changed) {
        chrome.runtime.sendMessage({ type: 'DB_UPDATED' }).catch(() => {});
      }
    }
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  // すべての JIRA インスタンスを対象にクエリ
  const tabs = await chrome.tabs.query({
    url: ["https://*.atlassian.net/*", "https://*/*"]
  });

  // インストール時に既存のタブに content.js を注入する
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // 権限のないページや特殊なタブでは注入に失敗する場合があるが、
      // ユーザーへの影響はないため、エラー出力は抑制する
    }
  }

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
