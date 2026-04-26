import { IssuesDB } from "./db.js";
import {
  normalizeHostInput,
  compareIssueKeys,
  getPriorityWeight,
  compareStatus,
  M3_COLORS,
  OTHER_COLOR,
  PRIORITY_MAP,
  STATUS_COLOR_MAP,
} from "./utils.js";

const db = new IssuesDB();
const listElement = document.getElementById("issue-list");
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const closeSettingsBtn = document.getElementById("close-settings");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const hostList = document.getElementById("host-list");
const addHostBtn = document.getElementById("add-host-btn");
const addHostDialog = document.getElementById("add-host-dialog");
const cancelAddHostBtn = document.getElementById("cancel-add-host");
const confirmAddHostBtn = document.getElementById("confirm-add-host");
const hostNameInput = document.getElementById("host-name");
const hostUrlInput = document.getElementById("host-url");
const projectList = document.getElementById("project-list");
const addProjectBtn = document.getElementById("add-project-btn");
const addProjectDialog = document.getElementById("add-project-dialog");
const cancelAddProjectBtn = document.getElementById("cancel-add-project");
const confirmAddProjectBtn = document.getElementById("confirm-add-project");
const projectKeyInput = document.getElementById("project-key-input");
const maxHistoryRange = document.getElementById("max-history-range");
const maxHistoryValue = document.getElementById("max-history-value");
const exportHistoryBtn = document.getElementById("export-history-btn");
const importHistoryBtn = document.getElementById("import-history-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const exportSettingsBtn = document.getElementById("export-settings-btn");
const importSettingsBtn = document.getElementById("import-settings-btn");
const historyImportModes = document.querySelectorAll(
  'input[name="history-import-mode"]',
);
const settingsImportModes = document.querySelectorAll(
  'input[name="settings-import-mode"]',
);
const confirmDialog = document.getElementById("confirm-dialog");
const confirmTitle = document.getElementById("confirm-title");
const confirmMessage = document.getElementById("confirm-message");
const confirmOkBtn = document.getElementById("confirm-ok");
const confirmCancelBtn = document.getElementById("confirm-cancel");

const sortBtns = {
  lastAccessed: document.getElementById("sort-lastAccessed"),
  issueKey: document.getElementById("sort-issueKey"),
  priority: document.getElementById("sort-priority"),
  status: document.getElementById("sort-status"),
};

let currentSettings = [];
let currentProjectSettings = [];

const uiLanguage = navigator.language.startsWith("ja") ? "ja" : "en";
const hostAccessMessages = {
  en: {
    invalidHost: "Please enter a valid HTTPS Jira host.",
    permissionDenied:
      "Host access permission is required to track issues on this Jira site.",
  },
  ja: {
    invalidHost: "有効な HTTPS の Jira ホストを入力してください。",
    permissionDenied:
      "この Jira サイトで課題を追跡するには、ホスト権限の許可が必要です。",
  },
};

function hostAccessText(key) {
  return hostAccessMessages[uiLanguage][key];
}

function getPermissionOriginFromStoredHost(hostUrl) {
  try {
    const parsedUrl = new URL(`https://${hostUrl}`);
    return `https://${parsedUrl.hostname}/*`;
  } catch (error) {
    return null;
  }
}

function isBuiltinHostOrigin(origin) {
  return /^https:\/\/(?:[^/]+\.)?atlassian\.net\/\*$/.test(origin);
}


/**
 * i18n対応: data-i18n属性を持つ要素のテキストを更新
 */
function applyTranslations() {
  // ブラウザの言語設定に合わせてhtmlのlang属性を更新
  const uiLang = chrome.i18n.getUILanguage();
  if (uiLang) {
    document.documentElement.lang = uiLang.split("-")[0];
  }

  const selectors = [
    "[data-i18n]",
    "[data-i18n-title]",
    "[data-i18n-placeholder]",
  ];
  document.querySelectorAll(selectors.join(", ")).forEach((el) => {
    const textKey = el.dataset.i18n;
    const titleKey = el.dataset.i18nTitle;
    const placeholderKey = el.dataset.i18nPlaceholder;

    if (textKey) {
      const message = chrome.i18n.getMessage(textKey);
      if (message) el.textContent = message;
    }
    if (titleKey) {
      const message = chrome.i18n.getMessage(titleKey);
      if (message) el.setAttribute("title", message);
    }
    if (placeholderKey) {
      const message = chrome.i18n.getMessage(placeholderKey);
      if (message) el.setAttribute("placeholder", message);
    }
  });
}

/**
 * 履歴リストのレンダリング
 */
async function renderList() {
  const issues = await db.getAllIssues();
  const sortSettings = await db.getSortSettings();
  updateSortUI(sortSettings);

  // ソートの適用
  issues.sort((a, b) => {
    const { type, direction } = sortSettings;

    if (type === "lastAccessed") {
      const result = (a.lastAccessed || 0) - (b.lastAccessed || 0);
      return direction === "desc" ? -result : result;
    }

    if (type === "issueKey") {
      const result = compareIssueKeys(a.issueKey, b.issueKey);
      return direction === "desc" ? -result : result;
    }

    if (type === "priority") {
      // 降順で重みが小さい(Highest:0)が先
      const result =
        getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
      return direction === "desc" ? -result : result;
    }

    if (type === "status") {
      return compareStatus(a, b, direction);
    }

    return 0;
  });

  const settings = await db.getSettings();
  const projectSettings = await db.getProjectSettings();
  const otherCollapsed = await db.getOtherCollapsed();
  currentSettings = settings;
  currentProjectSettings = projectSettings;

  if (issues.length === 0) {
    listElement.textContent = "";
    const noHistory = document.createElement("div");
    noHistory.className = "no-history";
    noHistory.textContent = chrome.i18n.getMessage("noHistory");
    listElement.appendChild(noHistory);
    return;
  }

  listElement.textContent = "";

  const visibleSettings = settings.filter((s) => s.visible);

  // 各ホストのIssueをあらかじめ抽出
  const hostGroups = visibleSettings
    .map((host) => {
      const hostIssues = issues.filter((issue) => {
        try {
          const url = new URL(issue.url);
          const hostUrl = host.url.toLowerCase();
          const issueHostname = url.hostname.toLowerCase();
          const issuePathname = url.pathname.toLowerCase();

          // ホスト設定にパスが含まれている場合 (例: foo.bar.com/jira)
          if (hostUrl.includes("/")) {
            const [hostPart, ...pathParts] = hostUrl.split("/");
            const pathPart = "/" + pathParts.join("/");
            // パスセグメントとして一致することを確認 (例: /jira が /jira-test/ に前方一致しないようにする)
            const isCorrectPath =
              issuePathname === pathPart ||
              issuePathname.startsWith(pathPart + "/");
            return (
              (issueHostname === hostPart ||
                issueHostname.endsWith("." + hostPart)) &&
              isCorrectPath
            );
          }

          // ホスト名のみの場合
          return (
            issueHostname === hostUrl || issueHostname.endsWith("." + hostUrl)
          );
        } catch (e) {
          return false;
        }
      });
      return { host, issues: hostIssues };
    })
    .filter((group) => group.issues.length > 0);

  const useAccordion = hostGroups.length > 1;

  hostGroups.forEach(({ host, issues: hostIssues }) => {
    if (useAccordion) {
      const header = document.createElement("div");
      header.className = "host-group-header clickable";

      const glyph = document.createElement("span");
      glyph.className = "collapse-glyph";
      const isCollapsed = !!host.isCollapsed;

      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined";
      icon.textContent = isCollapsed ? "arrow_right" : "arrow_drop_down";
      glyph.appendChild(icon);

      header.appendChild(glyph);

      header.addEventListener("click", async () => {
        host.isCollapsed = !host.isCollapsed;
        await db.setSettings(settings);
      });

      const name = document.createElement("span");
      name.textContent = host.name;
      header.appendChild(name);
      listElement.appendChild(header);
    }

    if (!useAccordion || !host.isCollapsed) {
      // プロジェクトキー設定に従ってグルーピング
      let remainingIssues = [...hostIssues];

      projectSettings.forEach((proj) => {
        // プロジェクトキーが完全一致することを確認 (例: ABC-1 が ABCD のグループに入らないように)
        const projIssues = remainingIssues.filter((i) => {
          const parts = i.issueKey.split("-");
          return parts.length > 1 && parts[0] === proj.key;
        });

        if (projIssues.length > 0) {
          remainingIssues = remainingIssues.filter(
            (i) => !projIssues.includes(i),
          );

          const projHeader = document.createElement("div");
          projHeader.className = "project-group-header";
          projHeader.style.backgroundColor = proj.color + "22"; // 薄く背景色をつける (alpha 22)
          projHeader.style.color = proj.color;
          projHeader.style.borderLeft = `4px solid ${proj.color}`;

          const glyph = document.createElement("span");
          glyph.className = "collapse-glyph";
          const isCollapsed = !!proj.isCollapsed;

          const icon = document.createElement("span");
          icon.className = "material-symbols-outlined";
          icon.textContent = isCollapsed ? "arrow_right" : "arrow_drop_down";
          glyph.appendChild(icon);

          projHeader.appendChild(glyph);

          const name = document.createElement("span");
          name.textContent = proj.key;
          projHeader.appendChild(name);

          projHeader.addEventListener("click", async () => {
            proj.isCollapsed = !proj.isCollapsed;
            await db.setProjectSettings(projectSettings);
          });

          listElement.appendChild(projHeader);

          if (!isCollapsed) {
            projIssues.forEach((issue) => {
              listElement.appendChild(createIssueItem(issue));
            });
          }
        }
      });

      // 設定にないプロジェクトキーのIssue ("other" グループ)
      if (remainingIssues.length > 0) {
        const otherHeader = document.createElement("div");
        otherHeader.className = "project-group-header";
        otherHeader.style.backgroundColor = OTHER_COLOR + "22";
        otherHeader.style.color = OTHER_COLOR;
        otherHeader.style.borderLeft = `4px solid ${OTHER_COLOR}`;

        const glyph = document.createElement("span");
        glyph.className = "collapse-glyph";

        const icon = document.createElement("span");
        icon.className = "material-symbols-outlined";
        icon.textContent = otherCollapsed ? "arrow_right" : "arrow_drop_down";
        glyph.appendChild(icon);

        otherHeader.appendChild(glyph);

        const name = document.createElement("span");
        name.textContent = chrome.i18n.getMessage("other") || "other";
        otherHeader.appendChild(name);

        otherHeader.addEventListener("click", async () => {
          await db.setOtherCollapsed(!otherCollapsed);
        });

        listElement.appendChild(otherHeader);

        if (!otherCollapsed) {
          remainingIssues.forEach((issue) => {
            listElement.appendChild(createIssueItem(issue));
          });
        }
      }
    }
  });
}

/**
 * 課題アイテム（1行分）のDOMを生成
 */
function createIssueItem(issue) {
  const item = document.createElement("div");
  item.className = "issue-item";
  item.title = issue.title; // ツールチップで全文を表示

  const indicators = document.createElement("div");
  indicators.className = "status-indicators";

  const openIndicator = document.createElement("div");
  openIndicator.className = `indicator ${issue.isOpened ? "is-opened" : ""}`;
  openIndicator.title = issue.isOpened
    ? chrome.i18n.getMessage("tabOpened")
    : chrome.i18n.getMessage("tabClosed");

  const editIndicator = document.createElement("div");
  editIndicator.className = `indicator ${issue.isEditing ? "is-editing" : ""}`;
  editIndicator.title = issue.isEditing
    ? chrome.i18n.getMessage("editing")
    : "";

  indicators.appendChild(openIndicator);
  indicators.appendChild(editIndicator);

  const content = document.createElement("div");
  content.className = "issue-content";

  const keySpan = document.createElement("span");
  keySpan.className = "issue-key";
  keySpan.textContent = issue.issueKey;

  const titleSpan = document.createElement("span");
  titleSpan.className = "issue-title";
  titleSpan.textContent = issue.title;

  content.appendChild(keySpan);
  content.appendChild(titleSpan);

  // 優先度とステータスのグリフ表示
  const glyphs = document.createElement("div");
  glyphs.className = "issue-glyphs";

  if (issue.status) {
    const sColor = STATUS_COLOR_MAP[issue.status] || "#7A869A";
    const sBadge = document.createElement("span");
    sBadge.className = "status-badge";
    sBadge.textContent = issue.status;
    sBadge.style.color = sColor;
    sBadge.style.backgroundColor = sColor + "15";
    sBadge.style.border = `1px solid ${sColor}44`;
    sBadge.title = chrome.i18n.getMessage("statusLabel", [issue.status]);
    glyphs.appendChild(sBadge);
  }

  if (issue.priority) {
    const pInfo = PRIORITY_MAP[issue.priority] || {
      glyph: "•",
      color: "#7A869A",
    };
    const pBadge = document.createElement("span");
    pBadge.className = "priority-badge";
    pBadge.textContent = pInfo.glyph;
    pBadge.style.color = pInfo.color;
    pBadge.style.backgroundColor = pInfo.color + "15"; // 15 is approx 8% opacity
    pBadge.style.border = `1px solid ${pInfo.color}44`; // 44 is approx 25% opacity
    pBadge.title = chrome.i18n.getMessage("priorityLabel", [issue.priority]);
    glyphs.appendChild(pBadge);
  }

  item.appendChild(indicators);
  item.appendChild(content);
  item.appendChild(glyphs);

  item.addEventListener("click", () => {
    handleIssueClick(issue);
  });

  return item;
}

/**
 * 課題クリック時の動作（タブ切り替えまたは新規作成）
 */
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

  // 最終表示時刻を即座に更新して、ソート順を反映させる
  const sortSettings = await db.getSortSettings();
  if (sortSettings.type === "lastAccessed") {
    // upsertIssueを呼び出すことで、IndexedDBのlastAccessedが更新される。
    // その後、renderListを呼び出すことでリストが再描画され、順序が更新される。
    await db.upsertIssue({ ...issue, lastAccessed: Date.now() });
    renderList();
  }
}

/**
 * ソートUIの更新
 */
function updateSortUI(sortSettings) {
  Object.keys(sortBtns).forEach((type) => {
    const btn = sortBtns[type];
    const isActive = sortSettings.type === type;
    btn.classList.toggle("active", isActive);

    const dirIcon = btn.querySelector(".dir-icon");
    if (isActive) {
      dirIcon.textContent =
        sortSettings.direction === "desc" ? "arrow_downward" : "arrow_upward";
    } else {
      dirIcon.textContent = "arrow_downward"; // デフォルト
    }
  });
}

// ソートボタンのイベントリスナー
Object.keys(sortBtns).forEach((type) => {
  sortBtns[type].addEventListener("click", async () => {
    const current = await db.getSortSettings();
    let newDirection = "desc";

    if (current.type === type) {
      newDirection = current.direction === "desc" ? "asc" : "desc";
    }

    const newSettings = { type, direction: newDirection };
    await db.setSortSettings(newSettings);
    renderList();
  });
});

// 設定画面の制御ロジック
settingsBtn.addEventListener("click", async () => {
  settingsPanel.classList.remove("hidden");
  renderHostSettings();
  renderProjectSettings();
  updateAboutStats();
  const maxCount = await db.getMaxHistoryCount();
  previousMaxHistoryCount = maxCount; // 初期値を正確に保持
  updateMaxHistoryUI(maxCount);

  // インポートモードの初期化
  const hMode = await db.getHistoryImportMode();
  document.querySelector(
    `input[name="history-import-mode"][value="${hMode}"]`,
  ).checked = true;
  const sMode = await db.getSettingsImportMode();
  document.querySelector(
    `input[name="settings-import-mode"][value="${sMode}"]`,
  ).checked = true;
});

closeSettingsBtn.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
});

// パネルの外側をクリックして閉じる
settingsPanel.addEventListener("click", (e) => {
  if (e.target === settingsPanel) {
    settingsPanel.classList.add("hidden");
  }
});

function updateMaxHistoryUI(count) {
  maxHistoryValue.textContent = count;
  const index = [20, 50, 100].indexOf(count);
  if (index !== -1) {
    maxHistoryRange.value = index;
  }
}

let previousMaxHistoryCount = 50;

maxHistoryRange.addEventListener("change", async () => {
  const counts = [20, 50, 100];
  const newCount = counts[maxHistoryRange.value];
  const currentIssues = await db.getAllIssues();

  if (newCount < previousMaxHistoryCount && currentIssues.length > newCount) {
    showConfirm(
      chrome.i18n.getMessage("changeHistoryLimit"),
      chrome.i18n.getMessage("changeHistoryLimitConfirm", [
        newCount.toString(),
        (currentIssues.length - newCount).toString(),
      ]),
      async () => {
        maxHistoryValue.textContent = newCount;
        await db.setMaxHistoryCount(newCount);
        await db.pruneIssues(newCount);
        previousMaxHistoryCount = newCount;
        renderList();
      },
      () => {
        // キャンセル時は元の値に戻す
        updateMaxHistoryUI(previousMaxHistoryCount);
      },
    );
  } else {
    maxHistoryValue.textContent = newCount;
    await db.setMaxHistoryCount(newCount);
    previousMaxHistoryCount = newCount;
  }
});

/**
 * カスタム確認ダイアログ
 */
function showConfirm(title, message, onOk, onCancel) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmDialog.classList.remove("hidden");

  const cleanup = () => {
    confirmDialog.classList.add("hidden");
    confirmOkBtn.removeEventListener("click", handleOk);
    confirmCancelBtn.removeEventListener("click", handleCancel);
  };

  const handleOk = () => {
    onOk();
    cleanup();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    cleanup();
  };

  confirmOkBtn.addEventListener("click", handleOk);
  confirmCancelBtn.addEventListener("click", handleCancel);
}

// 履歴の全削除
clearHistoryBtn.addEventListener("click", () => {
  showConfirm(
    chrome.i18n.getMessage("clearHistoryTitle"),
    chrome.i18n.getMessage("clearHistoryConfirm"),
    async () => {
      await db.clearAllIssues();
      renderList();
    },
  );
});

// 履歴のエクスポート (NDJSON)
exportHistoryBtn.addEventListener("click", async () => {
  const issues = await db.getAllIssues();
  const ndjson = issues.map((i) => JSON.stringify(i)).join("\n");
  try {
    await navigator.clipboard.writeText(ndjson);
    alert(chrome.i18n.getMessage("historyExportSuccess"));
  } catch (err) {
    console.error("Failed to copy history", err);
  }
});

// 履歴のインポート
importHistoryBtn.addEventListener("click", async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert(chrome.i18n.getMessage("clipboardError"));
      return;
    }
    const text = await navigator.clipboard.readText();
    const mode = document.querySelector(
      'input[name="history-import-mode"]:checked',
    ).value;
    await db.importIssues(text, mode);
    renderList();
    alert(chrome.i18n.getMessage("historyImportSuccess"));
  } catch (err) {
    console.error("Failed to import history", err);
    alert(chrome.i18n.getMessage("importError"));
  }
});

historyImportModes.forEach((radio) => {
  radio.addEventListener("change", async () => {
    await db.setHistoryImportMode(radio.value);
  });
});

// 設定のエクスポート (JSON)
exportSettingsBtn.addEventListener("click", async () => {
  const settings = await db.getSettings();
  const projectSettings = await db.getProjectSettings();
  const otherCollapsed = await db.getOtherCollapsed();
  const maxHistoryCount = await db.getMaxHistoryCount();

  const data = {
    settings,
    projectSettings,
    otherCollapsed,
    maxHistoryCount,
  };

  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert(chrome.i18n.getMessage("settingsExportSuccess"));
  } catch (err) {
    console.error("Failed to copy settings", err);
  }
});

// 設定のインポート
importSettingsBtn.addEventListener("click", async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert(chrome.i18n.getMessage("clipboardError"));
      return;
    }
    const text = await navigator.clipboard.readText();
    const mode = document.querySelector(
      'input[name="settings-import-mode"]:checked',
    ).value;
    await db.importSettings(text, mode);
    renderList();
    renderHostSettings();
    renderProjectSettings();
    const maxCount = await db.getMaxHistoryCount();
    updateMaxHistoryUI(maxCount);
    alert(chrome.i18n.getMessage("settingsImportSuccess"));
  } catch (err) {
    console.error("Failed to import settings", err);
    alert(chrome.i18n.getMessage("importError"));
  }
});

settingsImportModes.forEach((radio) => {
  radio.addEventListener("change", async () => {
    await db.setSettingsImportMode(radio.value);
  });
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    tabContents.forEach((c) =>
      c.classList.toggle("hidden", c.id !== `${tabName}-tab`),
    );
    if (tabName === "about") {
      updateAboutStats();
    }
  });
});

/**
 * プロジェクト設定リストのレンダリング
 */
async function renderProjectSettings() {
  const settings = await db.getProjectSettings();
  currentProjectSettings = settings;
  projectList.textContent = "";

  settings.forEach((proj, index) => {
    const li = document.createElement("li");
    li.className = "project-item";
    li.dataset.key = proj.key;
    li.draggable = true;

    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    const dragIcon = document.createElement("span");
    dragIcon.className = "material-symbols-outlined";
    dragIcon.textContent = "drag_indicator";
    dragHandle.appendChild(dragIcon);

    const keyLabel = document.createElement("span");
    keyLabel.className = "project-key-label";
    keyLabel.textContent = proj.key;

    const colorPicker = document.createElement("div");
    colorPicker.className = "color-picker";
    M3_COLORS.forEach((color) => {
      const option = document.createElement("div");
      option.className = `color-option ${
        proj.color === color ? "selected" : ""
      }`;
      option.style.backgroundColor = color;
      option.addEventListener("click", async () => {
        proj.color = color;
        await db.setProjectSettings(settings);
      });
      colorPicker.appendChild(option);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    const deleteIcon = document.createElement("span");
    deleteIcon.className = "material-symbols-outlined";
    deleteIcon.textContent = "delete";
    deleteBtn.appendChild(deleteIcon);

    deleteBtn.addEventListener("click", async () => {
      const newSettings = settings.filter((_, i) => i !== index);
      await db.setProjectSettings(newSettings);
    });

    li.appendChild(dragHandle);
    li.appendChild(keyLabel);
    li.appendChild(colorPicker);
    li.appendChild(deleteBtn);

    // ドラッグ＆ドロップ
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", index);
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
    });

    projectList.appendChild(li);
  });
}

// プロジェクトリストのドラッグ＆ドロップ
projectList.addEventListener("dragover", (e) => {
  e.preventDefault();
  const draggingItem = document.querySelector(".project-item.dragging");
  if (!draggingItem) return;

  const siblings = [
    ...projectList.querySelectorAll(".project-item:not(.dragging)"),
  ];
  const nextSibling = siblings.find((sibling) => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  projectList.insertBefore(draggingItem, nextSibling);
});

projectList.addEventListener("drop", async (e) => {
  e.preventDefault();
  const newSettings = [...projectList.querySelectorAll(".project-item")].map(
    (item) => {
      return currentProjectSettings.find((p) => p.key === item.dataset.key);
    },
  );
  await db.setProjectSettings(newSettings);
  currentProjectSettings = newSettings;
});

// プロジェクト追加
addProjectBtn.addEventListener("click", () => {
  addProjectDialog.classList.remove("hidden");
  projectKeyInput.value = "";
  projectKeyInput.focus();
});

cancelAddProjectBtn.addEventListener("click", () => {
  addProjectDialog.classList.add("hidden");
});

confirmAddProjectBtn.addEventListener("click", async () => {
  const key = projectKeyInput.value.trim().toUpperCase();
  if (key) {
    const settings = await db.getProjectSettings();
    if (!settings.some((p) => p.key === key)) {
      settings.push({
        key,
        color: M3_COLORS[0],
        isCollapsed: false,
      });
      await db.setProjectSettings(settings);
    }
    addProjectDialog.classList.add("hidden");
  }
});

/**
 * ホスト設定リストのレンダリング
 */
async function renderHostSettings() {
  const settings = await db.getSettings();
  currentSettings = settings;
  hostList.textContent = "";

  settings.forEach((host, index) => {
    const li = document.createElement("li");
    li.className = "host-item";
    li.dataset.id = host.id;
    li.draggable = true;

    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    const dragIcon = document.createElement("span");
    dragIcon.className = "material-symbols-outlined";
    dragIcon.textContent = "drag_indicator";
    dragHandle.appendChild(dragIcon);

    const info = document.createElement("div");
    info.className = "host-info";

    const name = document.createElement("span");
    name.className = "host-name";
    name.textContent = host.name;

    const url = document.createElement("span");
    url.className = "host-url-preview";
    url.textContent = host.url;

    info.appendChild(name);
    info.appendChild(url);

    const toggle = document.createElement("div");
    toggle.className = "visibility-toggle";
    toggle.title = host.visible
      ? chrome.i18n.getMessage("visible")
      : chrome.i18n.getMessage("hidden");
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "material-symbols-outlined";
    toggleIcon.textContent = host.visible ? "visibility" : "visibility_off";
    toggle.appendChild(toggleIcon);

    toggle.addEventListener("click", async (e) => {
      e.stopPropagation();
      host.visible = !host.visible;
      await db.setSettings(settings);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    const deleteIcon = document.createElement("span");
    deleteIcon.className = "material-symbols-outlined";
    deleteIcon.textContent = "delete";
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newSettings = settings.filter((_, i) => i !== index);
      const removedPermissionOrigin = getPermissionOriginFromStoredHost(
        host.url,
      );
      await db.setSettings(newSettings);
      if (
        removedPermissionOrigin &&
        !isBuiltinHostOrigin(removedPermissionOrigin) &&
        !newSettings.some(
          (item) =>
            getPermissionOriginFromStoredHost(item.url) ===
            removedPermissionOrigin,
        )
      ) {
        try {
          await chrome.permissions.remove({
            origins: [removedPermissionOrigin],
          });
        } catch (error) {
          // Ignore permission cleanup failures.
        }
      }
    });

    li.appendChild(dragHandle);
    li.appendChild(info);
    li.appendChild(toggle);
    li.appendChild(deleteBtn);

    // ドラッグ＆ドロップ
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", index);
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
    });

    hostList.appendChild(li);
  });
}

// ドラッグ＆ドロップのグローバルリスナー（重複防止）
hostList.addEventListener("dragover", (e) => {
  e.preventDefault();
  const draggingItem = document.querySelector(".dragging");
  if (!draggingItem) return;

  const siblings = [...hostList.querySelectorAll(".host-item:not(.dragging)")];
  const nextSibling = siblings.find((sibling) => {
    return e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2;
  });
  hostList.insertBefore(draggingItem, nextSibling);
});

hostList.addEventListener("drop", async (e) => {
  e.preventDefault();
  const newSettings = [...hostList.querySelectorAll(".host-item")].map(
    (item) => {
      return currentSettings.find((s) => s.id === item.dataset.id);
    },
  );
  await db.setSettings(newSettings);
  currentSettings = newSettings;
});

// ホスト追加
addHostBtn.addEventListener("click", () => {
  addHostDialog.classList.remove("hidden");
  hostNameInput.value = "";
  hostUrlInput.value = "";
});

cancelAddHostBtn.addEventListener("click", () => {
  addHostDialog.classList.add("hidden");
});

confirmAddHostBtn.addEventListener("click", async () => {
  const name = hostNameInput.value.trim();
  const rawUrl = hostUrlInput.value.trim();
  if (!name || !rawUrl) {
    return;
  }

  let normalizedHost;
  try {
    normalizedHost = normalizeHostInput(rawUrl);
  } catch (error) {
    alert(hostAccessText("invalidHost"));
    return;
  }

  if (!isBuiltinHostOrigin(normalizedHost.permissionOrigin)) {
    let granted = false;
    try {
      granted = await chrome.permissions.request({
        origins: [normalizedHost.permissionOrigin],
      });
    } catch (error) {
      granted = false;
    }

    if (!granted) {
      alert(hostAccessText("permissionDenied"));
      return;
    }
  }

  const nextSettings = await db.getSettings();
  nextSettings.push({
    id: Date.now().toString(),
    name,
    url: normalizedHost.storedUrl,
    visible: true,
  });
  await db.setSettings(nextSettings);
  addHostDialog.classList.add("hidden");

  chrome.runtime
    .sendMessage({
      type: "HOST_PERMISSION_GRANTED",
      origin: normalizedHost.permissionOrigin,
    })
    .catch(() => {});
});

/**
 * バージョン情報と統計情報の表示
 */
async function updateAboutStats() {
  const versionSpan = document.getElementById("extension-version");
  if (versionSpan) {
    versionSpan.textContent = "v" + chrome.runtime.getManifest().version;
  }

  const hosts = await db.getSettings();
  const projects = await db.getProjectSettings();
  const issueCount = await db.getIssueCount();

  const statHosts = document.getElementById("stat-hosts");
  const statProjects = document.getElementById("stat-projects");
  const statHistory = document.getElementById("stat-history");

  if (statHosts) statHosts.textContent = hosts.length;
  if (statProjects) statProjects.textContent = projects.length;
  if (statHistory) statHistory.textContent = issueCount;
}

// DB更新通知の受信 (Issueの追加・削除・タブ状態の変更など)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "DB_UPDATED") {
    renderList();
  }
});

// 設定変更の同期 (別ウィンドウでの設定変更を検知)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings || changes.projectSettings || changes.otherCollapsed) {
    renderList();
    // 設定パネルが開いている場合は、そちらも更新する
    if (!settingsPanel.classList.contains("hidden")) {
      renderHostSettings();
      renderProjectSettings();
    }
  }
});

applyTranslations();
renderList();
