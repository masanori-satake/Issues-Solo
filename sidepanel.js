import { IssuesDB } from './db.js';

const db = new IssuesDB();
const listElement = document.getElementById('issue-list');

async function renderList() {
  const issues = await db.getAllIssues();

  if (issues.length === 0) {
    listElement.innerHTML = '<div class="no-history">No history found.</div>';
    return;
  }

  listElement.textContent = '';
  issues.forEach(issue => {
    const item = document.createElement('div');
    item.className = 'issue-item';

    // インスタンスを区別するためにドメインを表示
    const domain = new URL(issue.url).hostname;

    const indicators = document.createElement('div');
    indicators.className = 'status-indicators';

    const openIndicator = document.createElement('div');
    openIndicator.className = `indicator ${issue.isOpened ? 'is-opened' : ''}`;
    openIndicator.title = issue.isOpened ? 'Tab is open' : 'Tab is closed';

    const editIndicator = document.createElement('div');
    editIndicator.className = `indicator ${issue.isEditing ? 'is-editing' : ''}`;
    editIndicator.title = issue.isEditing ? 'Currently editing' : '';

    indicators.appendChild(openIndicator);
    indicators.appendChild(editIndicator);

    const content = document.createElement('div');
    content.className = 'issue-content';

    const keySpan = document.createElement('span');
    keySpan.className = 'issue-key';
    keySpan.textContent = issue.issueKey + ' ';

    const domainSmall = document.createElement('small');
    domainSmall.style.color = '#6b778c';
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
