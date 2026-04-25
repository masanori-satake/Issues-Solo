import { IssuesDB } from "./db.js";

const db = new IssuesDB();
const BUILTIN_HOST_PATTERNS = ["https://*.atlassian.net/*"];

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "ISSUE_UPDATED") {
    handleIssueUpdated(message.data, sender.tab?.id);
    return;
  }

  if (message.type === "CLEAR_TAB_ASSOCIATION") {
    handleClearTabAssociation(sender.tab?.id);
    return;
  }

  if (message.type === "HOST_PERMISSION_GRANTED" && message.origin) {
    syncGrantedHostTabs([message.origin]);
  }
});

async function handleIssueUpdated(data, tabId) {
  if (!tabId) return;

  await db.clearTabAssociation(tabId, data.url);

  const issueData = {
    ...data,
    tabId,
    isOpened: true,
  };
  await db.upsertIssue(issueData);
  chrome.runtime.sendMessage({ type: "DB_UPDATED" }).catch(() => {});
}

async function handleClearTabAssociation(tabId) {
  if (!tabId) return;

  const changed = await db.clearTabAssociation(tabId);
  if (changed) {
    chrome.runtime.sendMessage({ type: "DB_UPDATED" }).catch(() => {});
  }
}

function isIssuePageUrl(url) {
  return /\/(?:browse|issues)\/([A-Z0-9]+-[0-9]+)/.test(url);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function originPatternToRegExp(pattern) {
  const escaped = escapeRegExp(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function isUrlCoveredByOrigins(url, origins) {
  return origins.some((origin) => originPatternToRegExp(origin).test(url));
}

async function getGrantedOptionalOrigins() {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter((origin) => !BUILTIN_HOST_PATTERNS.includes(origin));
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    // Ignore tabs where scripts cannot be injected.
  }
}

async function syncGrantedHostTabs(origins = null) {
  const targetOrigins = origins ?? (await getGrantedOptionalOrigins());
  if (!targetOrigins.length) {
    return [];
  }

  const tabs = await chrome.tabs.query({ url: targetOrigins });
  for (const tab of tabs) {
    await injectContentScript(tab.id);
  }
  return tabs;
}

async function reconcileOpenTabsState() {
  const optionalOrigins = await getGrantedOptionalOrigins();
  const queryPatterns = [...BUILTIN_HOST_PATTERNS, ...optionalOrigins];
  const tabs = queryPatterns.length
    ? await chrome.tabs.query({ url: queryPatterns })
    : [];

  for (const tab of tabs) {
    await injectContentScript(tab.id);
  }

  const openTabIds = new Set(tabs.map((tab) => tab.id));
  const issues = await db.getAllIssues();
  for (const issue of issues) {
    if (issue.isOpened && !openTabIds.has(issue.tabId)) {
      await db.upsertIssue({
        url: issue.url,
        isOpened: false,
        isEditing: false,
        tabId: null,
      });
    }
  }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const changed = await db.clearTabAssociation(tabId);
  if (changed) {
    chrome.runtime.sendMessage({ type: "DB_UPDATED" }).catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }

  const { url } = changeInfo;

  if (isUrlCoveredByOrigins(url, BUILTIN_HOST_PATTERNS)) {
    if (!isIssuePageUrl(url)) {
      const changed = await db.clearTabAssociation(tabId);
      if (changed) {
        chrome.runtime.sendMessage({ type: "DB_UPDATED" }).catch(() => {});
      }
    }
    return;
  }

  const optionalOrigins = await getGrantedOptionalOrigins();
  if (isUrlCoveredByOrigins(url, optionalOrigins)) {
    await injectContentScript(tabId);
    if (!isIssuePageUrl(url)) {
      const changed = await db.clearTabAssociation(tabId);
      if (changed) {
        chrome.runtime.sendMessage({ type: "DB_UPDATED" }).catch(() => {});
      }
    }
    return;
  }

  const changed = await db.clearTabAssociation(tabId);
  if (changed) {
    chrome.runtime.sendMessage({ type: "DB_UPDATED" }).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await reconcileOpenTabsState();
});

chrome.runtime.onStartup.addListener(async () => {
  await reconcileOpenTabsState();
});
