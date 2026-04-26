import {
  normalizeHostInput,
  M3_COLORS,
  getPermissionOriginFromStoredHost,
  isBuiltinHostOrigin,
} from "../utils.js";

/**
 * 設定パネルの表示と操作を担当するクラスです。
 */
export class SettingsManager {
  constructor(db, renderer) {
    this.db = db;
    this.renderer = renderer;
    this.previousMaxHistoryCount = 50;
    this.draggingIndex = null;
    this.draggingType = null;

    // UI要素のキャッシュ
    this.elements = {
      panel: document.getElementById("settings-panel"),
      hostList: document.getElementById("host-list"),
      projectList: document.getElementById("project-list"),
      maxHistoryRange: document.getElementById("max-history-range"),
      maxHistoryValue: document.getElementById("max-history-value"),
      hostDialog: document.getElementById("host-dialog"),
      projectDialog: document.getElementById("project-dialog"),
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

    // クリックで編集
    info.addEventListener("click", () => {
      this.openHostDialog(host);
    });

    // 表示切り替えトグル
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
      const removedPermissionOrigin = getPermissionOriginFromStoredHost(
        host.url,
      );
      await this.db.setSettings(newSettings);

      if (
        removedPermissionOrigin &&
        !isBuiltinHostOrigin(removedPermissionOrigin)
      ) {
        const stillNeeded = newSettings.some(
          (h) =>
            getPermissionOriginFromStoredHost(h.url) ===
            removedPermissionOrigin,
        );
        if (!stillNeeded) {
          try {
            await chrome.permissions.remove({
              origins: [removedPermissionOrigin],
            });
          } catch (e) {}
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
      this.draggingIndex = index;
      this.draggingType = "host";
      e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragover", (e) => {
      if (this.draggingType !== "host") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = li.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        li.classList.add("drag-over-top");
        li.classList.remove("drag-over-bottom");
      } else {
        li.classList.add("drag-over-bottom");
        li.classList.remove("drag-over-top");
      }
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over-top", "drag-over-bottom");
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
      this.draggingIndex = null;
      this.draggingType = null;
    });

    li.addEventListener("drop", async (e) => {
      if (this.draggingType !== "host") return;
      e.preventDefault();
      li.classList.remove("drag-over-top", "drag-over-bottom");

      const fromIndex = this.draggingIndex;
      const toIndex = index;

      if (fromIndex === toIndex) return;

      const rect = li.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const dropPosition = e.clientY < midpoint ? "top" : "bottom";

      let finalToIndex = toIndex;
      if (dropPosition === "bottom" && fromIndex > toIndex) finalToIndex++;
      if (dropPosition === "top" && fromIndex < toIndex) finalToIndex--;

      const newSettings = [...allSettings];
      const [movedItem] = newSettings.splice(fromIndex, 1);
      newSettings.splice(finalToIndex, 0, movedItem);

      await this.db.setSettings(newSettings);
      this.renderHostSettings();
    });

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
    keyLabel.addEventListener("click", () => {
      this.openProjectDialog(proj);
    });

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
      this.draggingIndex = index;
      this.draggingType = "project";
      e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragover", (e) => {
      if (this.draggingType !== "project") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = li.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        li.classList.add("drag-over-top");
        li.classList.remove("drag-over-bottom");
      } else {
        li.classList.add("drag-over-bottom");
        li.classList.remove("drag-over-top");
      }
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over-top", "drag-over-bottom");
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
      this.draggingIndex = null;
      this.draggingType = null;
    });

    li.addEventListener("drop", async (e) => {
      if (this.draggingType !== "project") return;
      e.preventDefault();
      li.classList.remove("drag-over-top", "drag-over-bottom");

      const fromIndex = this.draggingIndex;
      const toIndex = index;

      if (fromIndex === toIndex) return;

      const rect = li.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const dropPosition = e.clientY < midpoint ? "top" : "bottom";

      let finalToIndex = toIndex;
      if (dropPosition === "bottom" && fromIndex > toIndex) finalToIndex++;
      if (dropPosition === "top" && fromIndex < toIndex) finalToIndex--;

      const newSettings = [...allSettings];
      const [movedItem] = newSettings.splice(fromIndex, 1);
      newSettings.splice(finalToIndex, 0, movedItem);

      await this.db.setProjectSettings(newSettings);
      this.renderProjectSettings();
    });

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
    const hRadio = document.querySelector(
      `input[name="history-import-mode"][value="${hMode}"]`,
    );
    if (hRadio) hRadio.checked = true;

    const sMode = await this.db.getSettingsImportMode();
    const sRadio = document.querySelector(
      `input[name="settings-import-mode"][value="${sMode}"]`,
    );
    if (sRadio) sRadio.checked = true;
  }

  /**
   * 統計情報を更新します。
   */
  async updateAboutStats() {
    const versionSpan = document.getElementById("extension-version");
    if (versionSpan)
      versionSpan.textContent = "v" + chrome.runtime.getManifest().version;

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
   * ホストダイアログを開きます。
   */
  openHostDialog(host = null) {
    const dialog = this.elements.hostDialog;
    const titleEl = document.getElementById("host-dialog-title");
    const confirmBtn = document.getElementById("confirm-host");
    const nameInput = document.getElementById("host-name");
    const urlInput = document.getElementById("host-url");

    if (host) {
      dialog.dataset.editId = host.id;
      titleEl.textContent = chrome.i18n.getMessage("editHostTitle");
      titleEl.dataset.i18n = "editHostTitle";
      confirmBtn.textContent = chrome.i18n.getMessage("update");
      confirmBtn.dataset.i18n = "update";
      nameInput.value = host.name;
      urlInput.value = host.url;
    } else {
      delete dialog.dataset.editId;
      titleEl.textContent = chrome.i18n.getMessage("addHostTitle");
      titleEl.dataset.i18n = "addHostTitle";
      confirmBtn.textContent = chrome.i18n.getMessage("add");
      confirmBtn.dataset.i18n = "add";
      nameInput.value = "";
      urlInput.value = "";
    }

    dialog.classList.remove("hidden");
    nameInput.focus();
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
    this.elements.hostDialog.classList.add("hidden");
    await this.renderHostSettings();

    chrome.runtime
      .sendMessage({
        type: "HOST_PERMISSION_GRANTED",
        origin: normalized.permissionOrigin,
      })
      .catch(() => {});
  }

  /**
   * Jiraホスト設定を更新します。
   */
  async updateHost(id, name, rawUrl) {
    if (!name || !rawUrl) return;

    let normalized;
    try {
      normalized = normalizeHostInput(rawUrl);
    } catch (e) {
      alert(chrome.i18n.getMessage("invalidHost"));
      return;
    }

    const settings = await this.db.getSettings();
    const index = settings.findIndex((h) => h.id === id);
    if (index === -1) return;

    const oldHost = settings[index];
    const urlChanged = oldHost.url !== normalized.storedUrl;

    if (urlChanged) {
      // 権限の処理
      const oldOrigin = getPermissionOriginFromStoredHost(oldHost.url);
      const newOrigin = normalized.permissionOrigin;

      // 古い権限の解放（他で使われていない場合）
      if (oldOrigin && !isBuiltinHostOrigin(oldOrigin)) {
        const stillNeeded = settings.some(
          (h, i) =>
            i !== index &&
            getPermissionOriginFromStoredHost(h.url) === oldOrigin,
        );
        if (!stillNeeded) {
          try {
            await chrome.permissions.remove({ origins: [oldOrigin] });
          } catch (e) {}
        }
      }

      // 新しい権限の要求
      if (!isBuiltinHostOrigin(newOrigin)) {
        let granted = false;
        try {
          granted = await chrome.permissions.request({ origins: [newOrigin] });
        } catch (e) {}
        if (!granted) {
          alert(chrome.i18n.getMessage("permissionDenied"));
          return;
        }
      }
    }

    settings[index] = {
      ...oldHost,
      name,
      url: normalized.storedUrl,
    };

    await this.db.setSettings(settings);
    this.elements.hostDialog.classList.add("hidden");
    await this.renderHostSettings();

    if (urlChanged) {
      chrome.runtime
        .sendMessage({
          type: "HOST_PERMISSION_GRANTED",
          origin: normalized.permissionOrigin,
        })
        .catch(() => {});
    }
  }

  /**
   * プロジェクトダイアログを開きます。
   */
  openProjectDialog(proj = null) {
    const dialog = this.elements.projectDialog;
    const titleEl = document.getElementById("project-dialog-title");
    const confirmBtn = document.getElementById("confirm-project");
    const keyInput = document.getElementById("project-key-input");
    const errorMsg = document.getElementById("project-error-msg");

    errorMsg.classList.add("hidden");
    errorMsg.textContent = "";

    if (proj) {
      dialog.dataset.editKey = proj.key;
      titleEl.textContent = chrome.i18n.getMessage("editProjectTitle");
      titleEl.dataset.i18n = "editProjectTitle";
      confirmBtn.textContent = chrome.i18n.getMessage("save");
      confirmBtn.dataset.i18n = "save";
      keyInput.value = proj.key;
    } else {
      delete dialog.dataset.editKey;
      titleEl.textContent = chrome.i18n.getMessage("addProjectTitle");
      titleEl.dataset.i18n = "addProjectTitle";
      confirmBtn.textContent = chrome.i18n.getMessage("ok");
      confirmBtn.dataset.i18n = "ok";
      keyInput.value = "";
    }

    // 入力開始時にエラーメッセージを非表示にする
    if (!keyInput.dataset.listenerAdded) {
      keyInput.addEventListener("input", () => {
        errorMsg.classList.add("hidden");
      });
      keyInput.dataset.listenerAdded = "true";
    }

    dialog.classList.remove("hidden");
    keyInput.focus();
  }

  /**
   * 新しいプロジェクトを追加します。
   */
  async addProject(key) {
    const settings = await this.db.getProjectSettings();
    if (settings.some((p) => p.key === key)) {
      this._showProjectError(chrome.i18n.getMessage("duplicateProjectKey"));
      return false;
    }

    settings.push({ key, color: "#0061A4", isCollapsed: false });
    await this.db.setProjectSettings(settings);
    this.elements.projectDialog.classList.add("hidden");
    await this.renderProjectSettings();
    return true;
  }

  /**
   * プロジェクト設定を更新します。
   */
  async updateProject(oldKey, newKey) {
    const settings = await this.db.getProjectSettings();
    const index = settings.findIndex((p) => p.key === oldKey);
    if (index === -1) {
      this.elements.projectDialog.classList.add("hidden");
      return true;
    }

    if (oldKey !== newKey) {
      // 重複チェック
      if (settings.some((p) => p.key === newKey)) {
        this._showProjectError(chrome.i18n.getMessage("duplicateProjectKey"));
        return false;
      }
      settings[index].key = newKey;
      await this.db.setProjectSettings(settings);
      await this.renderProjectSettings();
    }
    this.elements.projectDialog.classList.add("hidden");
    return true;
  }

  _showProjectError(message) {
    const errorMsg = document.getElementById("project-error-msg");
    errorMsg.textContent = message;
    errorMsg.classList.remove("hidden");
  }
}
