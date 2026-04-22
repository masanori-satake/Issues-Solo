import { IssuesDB } from './db.js';

const db = new IssuesDB();
const listElement = document.getElementById('issue-list');

async function renderList() {
  const issues = await db.getAllIssues();

  // 清掃
  while (listElement.firstChild) {
    listElement.removeChild(listElement.firstChild);
  }

  if (issues.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'no-history';
    emptyDiv.textContent = 'No history found.';
    listElement.appendChild(emptyDiv);
    return;
  }

  issues.forEach(issue => {
    const item = document.createElement('div');
    item.className = 'issue-item';

    // インスタンスを区別するためにドメインを表示
    const domain = new URL(issue.url).hostname;

    // ステータスインジケーター
    const indicators = document.createElement('div');
    indicators.className = 'status-indicators';

    const openedIndicator = document.createElement('div');
    openedIndicator.className = `indicator ${issue.isOpened ? 'is-opened' : ''}`;
    openedIndicator.title = issue.isOpened ? 'Tab is open' : 'Tab is closed';
    indicators.appendChild(openedIndicator);

    const editingIndicator = document.createElement('div');
    editingIndicator.className = `indicator ${issue.isEditing ? 'is-editing' : ''}`;
    editingIndicator.title = issue.isEditing ? 'Currently editing' : 'Not editing';
    indicators.appendChild(editingIndicator);

    // コンテンツ
    const content = document.createElement('div');
    content.className = 'issue-content';

    const keySpan = document.createElement('span');
    keySpan.className = 'issue-key';
    keySpan.textContent = issue.issueKey + ' ';

    const domainSmall = document.createElement('small');
    domainSmall.style.color = 'var(--md-sys-color-on-surface-variant)';
    domainSmall.style.fontWeight = 'normal';
    domainSmall.textContent = `(${domain})`;
    keySpan.appendChild(domainSmall);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'issue-title';
    titleSpan.textContent = issue.title;

    content.appendChild(keySpan);
    content.appendChild(titleSpan);

    item.appendChild(indicators);
    item.appendChild(content);

    item.addEventListener('click', () => {
      handleIssueClick(issue);
    });

    listElement.appendChild(item);
  });
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
