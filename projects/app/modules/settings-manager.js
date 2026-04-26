import { normalizeHostInput, M3_COLORS, getPermissionOriginFromStoredHost, isBuiltinHostOrigin } from "../utils.js";

/**
 * 設定パネルの表示と操作を担当するクラスです。
 */
export class SettingsManager {
  constructor(db, renderer) {
    this.db = db;
    this.renderer = renderer;
    this.previousMaxHistoryCount = 50;

    // UI要素のキャッシュ
    this.elements = {
      panel: document.getElementById("settings-panel"),
      hostList: document.getElementById("host-list"),
      projectList: document.getElementById("project-list"),
      maxHistoryRange: document.getElementById("max-history-range"),
      maxHistoryValue: document.getElementById("max-history-value"),
      addHostDialog: document.getElementById("add-host-dialog"),
      addProjectDialog: document.getElementById("add-project-dialog"),
      confirmDialog: document.getElementById("confirm-dialog"),
    };

  }

  /**
   * 設定パネルを開きます。
   */
  async open() {
    this.elements.panel.classList.remove("hidden");
    await this.renderHostSettings();
    await this.renderProjectSettings();
    this.updateAboutStats();
    const maxCount = await this.db.getMaxHistoryCount();
    this.previousMaxHistoryCount = maxCount;
    this.updateMaxHistoryUI(maxCount);
    this.initImportModes();
  }

  /**
   * 設定パネルを閉じます。
   */
  close() {
    this.elements.panel.classList.add("hidden");
  }

  /**
   * Jiraホスト設定をレンダリングします。
   */
  async renderHostSettings() {
    const settings = await this.db.getSettings();
    const list = this.elements.hostList;
    list.textContent = "";

    settings.forEach((host, index) => {
      const li = this._createHostItem(host, index, settings);
      list.appendChild(li);
    });
  }

  _createHostItem(host, index, allSettings) {
    const li = document.createElement("li");
    li.className = "host-item";
    li.dataset.id = host.id;
    li.draggable = true;

    // ドラッグハンドル
    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    const dragIcon = document.createElement("span");
    dragIcon.className = "material-symbols-outlined";
    dragIcon.textContent = "drag_indicator";
    dragHandle.appendChild(dragIcon);

    // ホスト情報
    // XSS対策のため innerHTML は使用せず、textContent を使用して要素を構築します。
    const info = document.createElement("div");
    info.className = "host-info";
    const nameSpan = document.createElement("span");
    nameSpan.className = "host-name";
    nameSpan.textContent = host.name;
    const urlSpan = document.createElement("span");
    urlSpan.className = "host-url-preview";
    urlSpan.textContent = host.url;
    info.appendChild(nameSpan);
    info.appendChild(urlSpan);

    // 表示切り替えトグル
    const toggle = document.createElement("div");
    toggle.className = "visibility-toggle";
    toggle.title = host.visible ? chrome.i18n.getMessage("visible") : chrome.i18n.getMessage("hidden");
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "material-symbols-outlined";
    toggleIcon.textContent = host.visible ? "visibility" : "visibility_off";
    toggle.appendChild(toggleIcon);
    toggle.addEventListener("click", async (e) => {
      e.stopPropagation();
      host.visible = !host.visible;
      await this.db.setSettings(allSettings);
      this.renderHostSettings();
    });

    // 削除ボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    const deleteIcon = document.createElement("span");
    deleteIcon.className = "material-symbols-outlined";
    deleteIcon.textContent = "delete";
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newSettings = allSettings.filter((_, i) => i !== index);
      const removedPermissionOrigin = getPermissionOriginFromStoredHost(host.url);
      await this.db.setSettings(newSettings);

      if (removedPermissionOrigin && !isBuiltinHostOrigin(removedPermissionOrigin)) {
        const stillNeeded = newSettings.some(h => getPermissionOriginFromStoredHost(h.url) === removedPermissionOrigin);
        if (!stillNeeded) {
          try { await chrome.permissions.remove({ origins: [removedPermissionOrigin] }); } catch (e) {}
        }
      }
      this.renderHostSettings();
    });

    li.appendChild(dragHandle);
    li.appendChild(info);
    li.appendChild(toggle);
    li.appendChild(deleteBtn);

    // ドラッグ＆ドロップ用イベント
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", index);
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));

    return li;
  }

  /**
   * プロジェクト設定をレンダリングします。
   */
  async renderProjectSettings() {
    const settings = await this.db.getProjectSettings();
    const list = this.elements.projectList;
    list.textContent = "";

    settings.forEach((proj, index) => {
      const li = this._createProjectItem(proj, index, settings);
      list.appendChild(li);
    });
  }

  _createProjectItem(proj, index, allSettings) {
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
      option.className = `color-option ${proj.color === color ? "selected" : ""}`;
      option.style.backgroundColor = color;
      option.addEventListener("click", async () => {
        proj.color = color;
        await this.db.setProjectSettings(allSettings);
        this.renderProjectSettings();
      });
      colorPicker.appendChild(option);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    const deleteIcon = document.createElement("span");
    deleteIcon.className = "material-symbols-outlined";
    deleteIcon.textContent = "delete";
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.addEventListener("click", async (e) => {
      const newSettings = allSettings.filter((_, i) => i !== index);
      await this.db.setProjectSettings(newSettings);
      this.renderProjectSettings();
    });

    li.appendChild(dragHandle);
    li.appendChild(keyLabel);
    li.appendChild(colorPicker);
    li.appendChild(deleteBtn);

    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", index);
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));

    return li;
  }

  /**
   * 履歴上限のUIを更新します。
   */
  updateMaxHistoryUI(count) {
    this.elements.maxHistoryValue.textContent = count;
    const index = [20, 50, 100].indexOf(count);
    if (index !== -1) {
      this.elements.maxHistoryRange.value = index;
    }
  }

  /**
   * インポートモードの初期状態を設定します。
   */
  async initImportModes() {
    const hMode = await this.db.getHistoryImportMode();
    const hRadio = document.querySelector(`input[name="history-import-mode"][value="${hMode}"]`);
    if (hRadio) hRadio.checked = true;

    const sMode = await this.db.getSettingsImportMode();
    const sRadio = document.querySelector(`input[name="settings-import-mode"][value="${sMode}"]`);
    if (sRadio) sRadio.checked = true;
  }

  /**
   * 統計情報を更新します。
   */
  async updateAboutStats() {
    const versionSpan = document.getElementById("extension-version");
    if (versionSpan) versionSpan.textContent = "v" + chrome.runtime.getManifest().version;

    const hosts = await this.db.getSettings();
    const projects = await this.db.getProjectSettings();
    const issueCount = await this.db.getIssueCount();

    const elHosts = document.getElementById("stat-hosts");
    const elProjects = document.getElementById("stat-projects");
    const elHistory = document.getElementById("stat-history");

    if (elHosts) elHosts.textContent = hosts.length;
    if (elProjects) elProjects.textContent = projects.length;
    if (elHistory) elHistory.textContent = issueCount;
  }

  /**
   * 確認ダイアログを表示します。
   */
  showConfirm(title, message, onOk, onCancel) {
    const dialog = this.elements.confirmDialog;
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;
    dialog.classList.remove("hidden");

    const okBtn = document.getElementById("confirm-ok");
    const cancelBtn = document.getElementById("confirm-cancel");

    const cleanup = () => {
      dialog.classList.add("hidden");
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
    };

    const handleOk = () => {
      onOk();
      cleanup();
    };

    const handleCancel = () => {
      if (onCancel) onCancel();
      cleanup();
    };

    okBtn.addEventListener("click", handleOk);
    cancelBtn.addEventListener("click", handleCancel);
  }

  /**
   * 新しいJiraホストを追加します。
   */
  async addHost(name, rawUrl) {
    if (!name || !rawUrl) return;

    let normalized;
    try {
      normalized = normalizeHostInput(rawUrl);
    } catch (e) {
      alert(chrome.i18n.getMessage("invalidHost"));
      return;
    }

    if (!isBuiltinHostOrigin(normalized.permissionOrigin)) {
      let granted = false;
      try {
        granted = await chrome.permissions.request({
          origins: [normalized.permissionOrigin],
        });
      } catch (e) {}
      if (!granted) {
        alert(chrome.i18n.getMessage("permissionDenied"));
        return;
      }
    }

    const nextSettings = await this.db.getSettings();
    nextSettings.push({
      id: Date.now().toString(),
      name,
      url: normalized.storedUrl,
      visible: true,
    });
    await this.db.setSettings(nextSettings);
    this.elements.addHostDialog.classList.add("hidden");
    await this.renderHostSettings();

    chrome.runtime.sendMessage({
      type: "HOST_PERMISSION_GRANTED",
      origin: normalized.permissionOrigin,
    }).catch(() => {});
  }
}
