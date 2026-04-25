import { IssuesDB } from "./db.js";

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

let currentSettings = [];
let currentProjectSettings = [];

const M3_COLORS = [
  "#0061A4", // Blue
  "#006D39", // Green
  "#695F00", // Yellow
  "#B3261E", // Red
  "#6750A4", // Purple
  "#006A60", // Teal
];

const OTHER_COLOR = "#79747E"; // Material 3 Outline color

// 優先度のマッピングと色設定 (Material 3 パレット準拠)
const PRIORITY_MAP = {
  Highest: { glyph: "↑↑", color: "#DE350B" }, // Jira Red
  High: { glyph: "↑", color: "#FF5630" }, // Jira Orange-Red
  Medium: { glyph: "•", color: "#FFAB00" }, // Jira Yellow/Orange
  Low: { glyph: "↓", color: "#0052CC" }, // Jira Blue
  Lowest: { glyph: "↓↓", color: "#00B8D9" }, // Jira Sky Blue
  最高: { glyph: "↑↑", color: "#DE350B" },
  高: { glyph: "↑", color: "#FF5630" },
  中: { glyph: "•", color: "#FFAB00" },
  低: { glyph: "↓", color: "#0052CC" },
  最低: { glyph: "↓↓", color: "#00B8D9" },
};

// ステータスの色設定
const STATUS_COLOR_MAP = {
  // 未着手系 (Grey)
  "To Do": "#7A869A",
  未着手: "#7A869A",
  Open: "#7A869A",
  Reopened: "#7A869A",
  // 進行中系 (Blue)
  "In Progress": "#0052CC",
  進行中: "#0052CC",
  "In Review": "#0052CC",
  レビュー中: "#0052CC",
  // 完了系 (Green)
  Done: "#36B37E",
  完了: "#36B37E",
  Resolved: "#36B37E",
  解決済: "#36B37E",
  Closed: "#36B37E",
};

/**
 * 履歴リストのレンダリング
 */
async function renderList() {
  const issues = await db.getAllIssues();
  const settings = await db.getSettings();
  const projectSettings = await db.getProjectSettings();
  const otherCollapsed = await db.getOtherCollapsed();
  currentSettings = settings;
  currentProjectSettings = projectSettings;

  if (issues.length === 0) {
    listElement.textContent = "";
    const noHistory = document.createElement("div");
    noHistory.className = "no-history";
    noHistory.textContent = "履歴が見つかりません。";
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

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", isCollapsed ? "M9 6v12l9-6z" : "M6 9h12l-6 9z");
      svg.appendChild(path);
      glyph.appendChild(svg);

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

          const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg",
          );
          svg.setAttribute("viewBox", "0 0 24 24");
          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          path.setAttribute(
            "d",
            isCollapsed ? "M9 6v12l9-6z" : "M6 9h12l-6 9z",
          );
          svg.appendChild(path);
          glyph.appendChild(svg);

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

        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.setAttribute("viewBox", "0 0 24 24");
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute(
          "d",
          otherCollapsed ? "M9 6v12l9-6z" : "M6 9h12l-6 9z",
        );
        svg.appendChild(path);
        glyph.appendChild(svg);

        otherHeader.appendChild(glyph);

        const name = document.createElement("span");
        name.textContent = "other";
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
    ? "タブが開いています"
    : "タブは閉じています";

  const editIndicator = document.createElement("div");
  editIndicator.className = `indicator ${issue.isEditing ? "is-editing" : ""}`;
  editIndicator.title = issue.isEditing ? "編集中" : "";

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
    pBadge.title = `優先度: ${issue.priority}`;
    glyphs.appendChild(pBadge);
  }

  if (issue.status) {
    const sColor = STATUS_COLOR_MAP[issue.status] || "#7A869A";
    const sBadge = document.createElement("span");
    sBadge.className = "status-badge";
    sBadge.textContent = issue.status;
    sBadge.style.color = sColor;
    sBadge.style.backgroundColor = sColor + "15";
    sBadge.style.border = `1px solid ${sColor}44`;
    sBadge.title = `ステータス: ${issue.status}`;
    glyphs.appendChild(sBadge);
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
}

// 設定画面の制御ロジック
settingsBtn.addEventListener("click", async () => {
  settingsPanel.classList.remove("hidden");
  renderHostSettings();
  renderProjectSettings();
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
      "保持件数の変更",
      `最大保持件数を ${newCount} 件に変更すると、制限を超える古い履歴 (${
        currentIssues.length - newCount
      } 件) が削除されます。よろしいですか？`,
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
    "履歴の全削除",
    "現在保持されているすべての履歴エントリーを削除します。よろしいですか？",
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
    alert("履歴データをクリップボードにコピーしました (NDJSON形式)");
  } catch (err) {
    console.error("Failed to copy history", err);
  }
});

// 履歴のインポート
importHistoryBtn.addEventListener("click", async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert(
        "このブラウザではクリップボードからの読み取りがサポートされていないか、許可されていません。",
      );
      return;
    }
    const text = await navigator.clipboard.readText();
    const mode = document.querySelector(
      'input[name="history-import-mode"]:checked',
    ).value;
    await db.importIssues(text, mode);
    renderList();
    alert("履歴データをインポートしました");
  } catch (err) {
    console.error("Failed to import history", err);
    alert(
      "インポートに失敗しました。クリップボードに正しいデータがあるか確認してください。",
    );
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
    alert("設定データをクリップボードにコピーしました (JSON形式)");
  } catch (err) {
    console.error("Failed to copy settings", err);
  }
});

// 設定のインポート
importSettingsBtn.addEventListener("click", async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      alert(
        "このブラウザではクリップボードからの読み取りがサポートされていないか、許可されていません。",
      );
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
    alert("設定データをインポートしました");
  } catch (err) {
    console.error("Failed to import settings", err);
    alert(
      "インポートに失敗しました。クリップボードに正しいデータがあるか確認してください。",
    );
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
    const dragSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    dragSvg.setAttribute("viewBox", "0 -960 960 960");
    const dragPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    dragPath.setAttribute(
      "d",
      "M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z",
    );
    dragSvg.appendChild(dragPath);
    dragHandle.appendChild(dragSvg);

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
    const deleteSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    deleteSvg.setAttribute("viewBox", "0 -960 960 960");
    const deletePath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    deletePath.setAttribute(
      "d",
      "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T760-120H280Zm480-600H280v520h480v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z",
    );
    deleteSvg.appendChild(deletePath);
    deleteBtn.appendChild(deleteSvg);

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
    const dragSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    dragSvg.setAttribute("viewBox", "0 -960 960 960");
    const dragPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    dragPath.setAttribute(
      "d",
      "M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z",
    );
    dragSvg.appendChild(dragPath);
    dragHandle.appendChild(dragSvg);

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
    toggle.title = host.visible ? "表示中" : "非表示";
    const toggleSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    toggleSvg.setAttribute("viewBox", "0 -960 960 960");
    const togglePath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    if (host.visible) {
      togglePath.setAttribute(
        "d",
        "M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z",
      );
    } else {
      togglePath.setAttribute(
        "d",
        "m644-428-58-58q9-47-27-83t-83-27l-58-58q17-8 37-12t40-4q75 0 127.5 52.5T660-500q0 20-4 40t-12 32ZM162-80l-58-58 84-84q-36-22-67.5-49T61-329q53-111 156-180.5T441-579l-44-44q-20 6-40.5 13T318-592l-62-62q25-15 52.5-27t57.5-20l-34-34q-50 10-97.5 30.5T144-651l-62-62 58-58 642 642-58 58-88-88q-35 23-74 41.5T482-201q-158 0-280-101.5T40-501q23-49 55-91.5t75-76.5l84 84q-13 15-24.5 32T215-519q48 94 138 152t199 58q19 0 38-2.5t37-7.5l88 88q-36 17-74.5 28T452-201l192 121ZM480-320q-17 0-33-4.5t-31-11.5l112-112q7 15 11.5 31t4.5 33q0 47-33 80t-31 14ZM880-429q-22 47-53.5 89T755-263l-58-58q26-25 48.5-53.5T785-438q-49-94-138.5-152T447-648q-19 0-37.5 2.5T372-638l-62-62q41-16 85-24t89-8q158 0 280 101.5T920-429q-10 22-22.5 43t-17.5 40Z",
      );
    }
    toggleSvg.appendChild(togglePath);
    toggle.appendChild(toggleSvg);

    toggle.addEventListener("click", async (e) => {
      e.stopPropagation();
      host.visible = !host.visible;
      await db.setSettings(settings);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    const deleteSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    deleteSvg.setAttribute("viewBox", "0 -960 960 960");
    const deletePath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    deletePath.setAttribute(
      "d",
      "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T760-120H280Zm480-600H280v520h480v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z",
    );
    deleteSvg.appendChild(deletePath);
    deleteBtn.appendChild(deleteSvg);
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newSettings = settings.filter((_, i) => i !== index);
      await db.setSettings(newSettings);
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
  let url = hostUrlInput.value.trim();
  if (name && url) {
    try {
      if (url.includes("://")) {
        const parsedUrl = new URL(url);
        // /browse/ や /issues/ より前のパスを保持する
        const pathMatch = parsedUrl.pathname.match(/^(.*?)\/(?:browse|issues)/);
        const contextPath = pathMatch ? pathMatch[1] : "";
        url = parsedUrl.hostname + contextPath;
      }
    } catch (e) {
      // パース失敗時はトリミングした入力をそのまま使用
    }

    const settings = await db.getSettings();
    settings.push({
      id: Date.now().toString(),
      name,
      url,
      visible: true,
    });
    await db.setSettings(settings);
    addHostDialog.classList.add("hidden");
  }
});

// バージョン情報の表示
const versionSpan = document.getElementById("extension-version");
if (versionSpan) {
  versionSpan.textContent = chrome.runtime.getManifest().version;
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

renderList();
