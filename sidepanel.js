import { IssuesDB } from './db.js';

const db = new IssuesDB();
const listElement = document.getElementById('issue-list');

async function renderList() {
  const issues = await db.getAllIssues();

  if (issues.length === 0) {
    listElement.innerHTML = '<div class="no-history">No history found.</div>';
    return;
  }

  listElement.innerHTML = '';
  issues.forEach(issue => {
    const item = document.createElement('div');
    item.className = 'issue-item';

    // インスタンスを区別するためにドメインを表示
    const domain = new URL(issue.url).hostname;

    item.innerHTML = `
      <div class="status-indicators">
        <div class="indicator ${issue.isOpened ? 'is-opened' : ''}" title="${issue.isOpened ? 'Tab is open' : 'Tab is closed'}"></div>
        <div class="indicator ${issue.isEditing ? 'is-editing' : ''}" title="${issue.isEditing ? 'Currently editing' : ''}"></div>
      </div>
      <div class="issue-content">
        <span class="issue-key">${issue.issueKey} <small style="color: #6b778c; font-weight: normal;">(${domain})</small></span>
        <span class="issue-title">${escapeHtml(issue.title)}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      handleIssueClick(issue);
    });

    listElement.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function handleIssueClick(issue) {
  if (issue.isOpened && issue.tabId) {
    try {
      await chrome.tabs.update(issue.tabId, { active: true });
      const tab = await chrome.tabs.get(issue.tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch (e) {
      chrome.tabs.create({ url: issue.url });
    }
  } else {
    chrome.tabs.create({ url: issue.url });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DB_UPDATED') {
    renderList();
  }
});

renderList();
