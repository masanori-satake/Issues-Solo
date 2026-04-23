import { IssuesDB } from './db.js';

const db = new IssuesDB();
const listElement = document.getElementById('issue-list');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const hostList = document.getElementById('host-list');
const addHostBtn = document.getElementById('add-host-btn');
const deleteHostBtn = document.getElementById('delete-host-btn');
const addHostDialog = document.getElementById('add-host-dialog');
const cancelAddHostBtn = document.getElementById('cancel-add-host');
const confirmAddHostBtn = document.getElementById('confirm-add-host');
const hostNameInput = document.getElementById('host-name');
const hostUrlInput = document.getElementById('host-url');
const deleteConfirmDialog = document.getElementById('delete-confirm-dialog');
const cancelDeleteHostBtn = document.getElementById('cancel-delete-host');
const confirmDeleteHostBtn = document.getElementById('confirm-delete-host');

let selectedHostIds = new Set();
let currentSettings = [];

async function renderList() {
  const issues = await db.getAllIssues();
  const settings = await db.getSettings();
  currentSettings = settings;

  if (issues.length === 0) {
    listElement.textContent = '';
    const noHistory = document.createElement('div');
    noHistory.className = 'no-history';
    noHistory.textContent = '履歴が見つかりません。';
    listElement.appendChild(noHistory);
    return;
  }

  listElement.textContent = '';

  const visibleSettings = settings.filter(s => s.visible);

  // 各ホストのIssueをあらかじめ抽出
  const hostGroups = visibleSettings.map(host => {
    const hostIssues = issues.filter(issue => {
      try {
        const url = new URL(issue.url);
        return url.hostname === host.url || url.hostname.endsWith('.' + host.url);
      } catch (e) {
        return false;
      }
    });
    return { host, issues: hostIssues };
  }).filter(group => group.issues.length > 0);

  const showHeaders = visibleSettings.length > 1;
  const showGlyphs = hostGroups.length > 1;

  hostGroups.forEach(({ host, issues: hostIssues }) => {
    if (showHeaders) {
      const header = document.createElement('div');
      header.className = 'host-group-header';
      if (showGlyphs) {
        header.classList.add('clickable');
        const glyph = document.createElement('span');
        glyph.className = 'collapse-glyph';
        const isCollapsed = host.isCollapsed || false;
        glyph.innerHTML = isCollapsed
          ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' // 右向き
          : '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>'; // 下向き
        header.appendChild(glyph);

        header.addEventListener('click', async () => {
          host.isCollapsed = !host.isCollapsed;
          await db.setSettings(settings);
          renderList();
        });
      }
      const name = document.createElement('span');
      name.textContent = host.name;
      header.appendChild(name);
      listElement.appendChild(header);
    }

    if (!showGlyphs || !host.isCollapsed) {
      hostIssues.forEach(issue => {
        const item = createIssueItem(issue);
        listElement.appendChild(item);
      });
    }
  });
}

function createIssueItem(issue) {
  const item = document.createElement('div');
  item.className = 'issue-item';

  const domain = new URL(issue.url).hostname;

  const indicators = document.createElement('div');
  indicators.className = 'status-indicators';

  const openIndicator = document.createElement('div');
  openIndicator.className = `indicator ${issue.isOpened ? 'is-opened' : ''}`;
  openIndicator.title = issue.isOpened ? 'タブが開いています' : 'タブは閉じています';

  const editIndicator = document.createElement('div');
  editIndicator.className = `indicator ${issue.isEditing ? 'is-editing' : ''}`;
  editIndicator.title = issue.isEditing ? '編集中' : '';

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

  return item;
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

// Settings Logic
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.remove('hidden');
  renderHostSettings();
});

closeSettingsBtn.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.toggle('active', b === btn));
    tabContents.forEach(c => c.classList.toggle('hidden', c.id !== `${tabName}-tab`));
  });
});

async function renderHostSettings() {
  const settings = await db.getSettings();
  currentSettings = settings;
  hostList.textContent = '';

  settings.forEach((host, index) => {
    const li = document.createElement('li');
    li.className = 'host-item';
    li.dataset.id = host.id;
    li.draggable = true;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedHostIds.has(host.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedHostIds.add(host.id);
      } else {
        selectedHostIds.delete(host.id);
      }
      deleteHostBtn.disabled = selectedHostIds.size === 0;
    });

    const info = document.createElement('div');
    info.className = 'host-info';

    const name = document.createElement('span');
    name.className = 'host-name';
    name.textContent = host.name;

    const url = document.createElement('span');
    url.className = 'host-url-preview';
    url.textContent = host.url;

    info.appendChild(name);
    info.appendChild(url);

    const toggle = document.createElement('div');
    toggle.className = 'visibility-toggle';
    toggle.title = host.visible ? '表示中' : '非表示';
    toggle.innerHTML = host.visible
      ? '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.39 2.59-3.21 3.44-5.24-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';

    toggle.addEventListener('click', async () => {
      host.visible = !host.visible;
      await db.setSettings(settings);
      renderHostSettings();
      renderList();
    });

    li.appendChild(dragHandle);
    li.appendChild(checkbox);
    li.appendChild(info);
    li.appendChild(toggle);

    // Drag and Drop
    li.addEventListener('dragstart', (e) => {
      li.classList.add('dragging');
      e.dataTransfer.setData('text/plain', index);
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });

    hostList.appendChild(li);
  });
}

// Drag and Drop global listeners to avoid duplication
hostList.addEventListener('dragover', (e) => {
  e.preventDefault();
  const draggingItem = document.querySelector('.dragging');
  if (!draggingItem) return;

  const siblings = [...hostList.querySelectorAll('.host-item:not(.dragging)')];
  const nextSibling = siblings.find(sibling => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  hostList.insertBefore(draggingItem, nextSibling);
});

hostList.addEventListener('drop', async (e) => {
  e.preventDefault();
  const newSettings = [...hostList.querySelectorAll('.host-item')].map(item => {
    return currentSettings.find(s => s.id === item.dataset.id);
  });
  await db.setSettings(newSettings);
  currentSettings = newSettings;
  renderList();
});

// Add Host
addHostBtn.addEventListener('click', () => {
  addHostDialog.classList.remove('hidden');
  hostNameInput.value = '';
  hostUrlInput.value = '';
});

cancelAddHostBtn.addEventListener('click', () => {
  addHostDialog.classList.add('hidden');
});

confirmAddHostBtn.addEventListener('click', async () => {
  const name = hostNameInput.value.trim();
  let url = hostUrlInput.value.trim();
  if (name && url) {
    try {
      if (url.includes('://')) {
        url = new URL(url).hostname;
      }
    } catch (e) {
      // If parsing fails, keep the original trimmed input
    }

    const settings = await db.getSettings();
    settings.push({
      id: Date.now().toString(),
      name,
      url,
      visible: true
    });
    await db.setSettings(settings);
    addHostDialog.classList.add('hidden');
    renderHostSettings();
    renderList();
  }
});

// Delete Host
deleteHostBtn.addEventListener('click', () => {
  deleteConfirmDialog.classList.remove('hidden');
});

cancelDeleteHostBtn.addEventListener('click', () => {
  deleteConfirmDialog.classList.add('hidden');
});

confirmDeleteHostBtn.addEventListener('click', async () => {
  let settings = await db.getSettings();
  settings = settings.filter(s => !selectedHostIds.has(s.id));
  await db.setSettings(settings);
  selectedHostIds.clear();
  deleteHostBtn.disabled = true;
  deleteConfirmDialog.classList.add('hidden');
  renderHostSettings();
  renderList();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DB_UPDATED') {
    renderList();
  }
});

renderList();
