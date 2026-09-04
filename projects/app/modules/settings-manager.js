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
    this.draggingId = null;
    this.draggingProjectKey = null;

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
      importDialog: document.getElementById("import-dialog"),
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

    // 並べ替えボタン（↑ / ↓）
    const reorderBtns = document.createElement("div");
    reorderBtns.className = "reorder-btns";

    const upBtn = document.createElement("button");
    upBtn.className = "reorder-btn up-btn";
    upBtn.title = chrome.i18n.getMessage("moveUp") || "Move Up";
    upBtn.disabled = index === 0;
    const upIcon = document.createElement("span");
    upIcon.className = "material-symbols-outlined";
    upIcon.textContent = "arrow_upward";
    upBtn.appendChild(upIcon);
    upBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (index > 0) {
        await this.moveHost(index, index - 1);
      }
    });

    const downBtn = document.createElement("button");
    downBtn.className = "reorder-btn down-btn";
    downBtn.title = chrome.i18n.getMessage("moveDown") || "Move Down";
    downBtn.disabled = index === allSettings.length - 1;
    const downIcon = document.createElement("span");
    downIcon.className = "material-symbols-outlined";
    downIcon.textContent = "arrow_downward";
    downBtn.appendChild(downIcon);
    downBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (index < allSettings.length - 1) {
        await this.moveHost(index, index + 1);
      }
    });

    reorderBtns.appendChild(upBtn);
    reorderBtns.appendChild(downBtn);

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
    li.appendChild(reorderBtns);
    li.appendChild(info);
    li.appendChild(toggle);
    li.appendChild(deleteBtn);

    // ドラッグ＆ドロップ用イベント
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      this.draggingIndex = index;
      this.draggingType = "host";
      this.draggingId = host.id;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        // CI環境などでの互換性のため index を保持
        e.dataTransfer.setData("text/plain", index.toString());
        // より堅牢な識別のために ID を保持
        e.dataTransfer.setData("application/x-issues-solo-id", host.id);
      }
    });

    li.addEventListener("dragenter", (e) => {
      if (this.draggingType === "host") e.preventDefault();
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
      const items = this.elements.hostList.querySelectorAll(".host-item");
      items.forEach((el) =>
        el.classList.remove("dragging", "drag-over-top", "drag-over-bottom"),
      );
      // dropイベントの非同期処理に配慮し、短時間の猶予を持って状態をクリアする
      setTimeout(() => {
        this.draggingType = null;
        this.draggingId = null;
        this.draggingIndex = null;
      }, 50);
    });

    li.addEventListener("drop", async (e) => {
      // Capture all event-related data synchronously before any await calls.
      // The DataTransfer object and some other event properties may be cleared or inaccessible after an await.
      const dragType = this.draggingType;
      const dragId = this.draggingId;
      const dragIndex = this.draggingIndex;

      let dataTransferId = null;
      let dataTransferIndex = null;
      if (e.dataTransfer) {
        dataTransferId = e.dataTransfer.getData("application/x-issues-solo-id");
        const idxData = e.dataTransfer.getData("text/plain");
        if (idxData) dataTransferIndex = parseInt(idxData, 10);
      }

      const dropTargetId = li.dataset.id;
      const rect = li.getBoundingClientRect();
      const isTop = e.clientY < rect.top + rect.height / 2;

      if (dragType !== "host") return;
      e.preventDefault();
      li.classList.remove("drag-over-top", "drag-over-bottom");

      // Determine source ID from all available captured metadata
      let sourceId = dragId || dataTransferId;
      if (!sourceId) {
        const fromIdx =
          dataTransferIndex !== null ? dataTransferIndex : dragIndex;
        if (
          typeof fromIdx === "number" &&
          fromIdx >= 0 &&
          fromIdx < allSettings.length
        ) {
          sourceId = allSettings[fromIdx].id;
        }
      }

      if (!sourceId || sourceId === dropTargetId) return;

      const currentSettings = await this.db.getSettings();

      const fromIndex = currentSettings.findIndex((h) => h.id === sourceId);
      const toIndex = currentSettings.findIndex((h) => h.id === dropTargetId);

      if (fromIndex === -1 || toIndex === -1) return;

      const newSettings = [...currentSettings];
      const [movedItem] = newSettings.splice(fromIndex, 1);

      let targetIndex = newSettings.findIndex((h) => h.id === dropTargetId);
      if (!isTop) targetIndex++;

      newSettings.splice(targetIndex, 0, movedItem);

      await this.db.setSettings(newSettings);
      await this.renderHostSettings();
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

    // 1行目: ドラッグハンドル, 上下移動ボタン, プロジェクトキーラベル, 削除ボタン
    const mainRow = document.createElement("div");
    mainRow.className = "project-item-main";

    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    const dragIcon = document.createElement("span");
    dragIcon.className = "material-symbols-outlined";
    dragIcon.textContent = "drag_indicator";
    dragHandle.appendChild(dragIcon);

    const reorderBtns = document.createElement("div");
    reorderBtns.className = "reorder-btns";

    const upBtn = document.createElement("button");
    upBtn.className = "reorder-btn up-btn";
    upBtn.title = chrome.i18n.getMessage("moveUp") || "Move Up";
    upBtn.disabled = index === 0;
    const upIcon = document.createElement("span");
    upIcon.className = "material-symbols-outlined";
    upIcon.textContent = "arrow_upward";
    upBtn.appendChild(upIcon);
    upBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (index > 0) {
        await this.moveProject(index, index - 1);
      }
    });

    const downBtn = document.createElement("button");
    downBtn.className = "reorder-btn down-btn";
    downBtn.title = chrome.i18n.getMessage("moveDown") || "Move Down";
    downBtn.disabled = index === allSettings.length - 1;
    const downIcon = document.createElement("span");
    downIcon.className = "material-symbols-outlined";
    downIcon.textContent = "arrow_downward";
    downBtn.appendChild(downIcon);
    downBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (index < allSettings.length - 1) {
        await this.moveProject(index, index + 1);
      }
    });

    reorderBtns.appendChild(upBtn);
    reorderBtns.appendChild(downBtn);

    const keyLabel = document.createElement("span");
    keyLabel.className = "project-key-label";
    keyLabel.textContent = proj.key;
    keyLabel.addEventListener("click", () => {
      this.openProjectDialog(proj);
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

    mainRow.appendChild(dragHandle);
    mainRow.appendChild(reorderBtns);
    mainRow.appendChild(keyLabel);
    mainRow.appendChild(deleteBtn);

    // 2行目: カラーピッカー
    const subRow = document.createElement("div");
    subRow.className = "project-item-sub";

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

    subRow.appendChild(colorPicker);

    li.appendChild(mainRow);
    li.appendChild(subRow);

    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      this.draggingIndex = index;
      this.draggingType = "project";
      this.draggingProjectKey = proj.key;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
        e.dataTransfer.setData("application/x-issues-solo-key", proj.key);
      }
    });

    li.addEventListener("dragenter", (e) => {
      if (this.draggingType === "project") e.preventDefault();
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
      const items = this.elements.projectList.querySelectorAll(".project-item");
      items.forEach((el) =>
        el.classList.remove("dragging", "drag-over-top", "drag-over-bottom"),
      );
      setTimeout(() => {
        this.draggingType = null;
        this.draggingProjectKey = null;
        this.draggingIndex = null;
      }, 50);
    });

    li.addEventListener("drop", async (e) => {
      // Capture all event-related data synchronously before any await calls.
      const dragType = this.draggingType;
      const dragKey = this.draggingProjectKey;
      const dragIndex = this.draggingIndex;

      let dataTransferKey = null;
      let dataTransferIndex = null;
      if (e.dataTransfer) {
        dataTransferKey = e.dataTransfer.getData(
          "application/x-issues-solo-key",
        );
        const idxData = e.dataTransfer.getData("text/plain");
        if (idxData) dataTransferIndex = parseInt(idxData, 10);
      }

      const dropTargetKey = li.dataset.key;
      const rect = li.getBoundingClientRect();
      const isTop = e.clientY < rect.top + rect.height / 2;

      if (dragType !== "project") return;
      e.preventDefault();
      li.classList.remove("drag-over-top", "drag-over-bottom");

      // Determine source Key from all available captured metadata
      let sourceKey = dragKey || dataTransferKey;
      if (!sourceKey) {
        const fromIdx =
          dataTransferIndex !== null ? dataTransferIndex : dragIndex;
        if (
          typeof fromIdx === "number" &&
          fromIdx >= 0 &&
          fromIdx < allSettings.length
        ) {
          sourceKey = allSettings[fromIdx].key;
        }
      }

      if (!sourceKey || sourceKey === dropTargetKey) return;

      const currentSettings = await this.db.getProjectSettings();

      const fromIndex = currentSettings.findIndex((p) => p.key === sourceKey);
      const toIndex = currentSettings.findIndex((p) => p.key === dropTargetKey);

      if (fromIndex === -1 || toIndex === -1) return;

      const newSettings = [...currentSettings];
      const [movedItem] = newSettings.splice(fromIndex, 1);

      let targetIndex = newSettings.findIndex((p) => p.key === dropTargetKey);
      if (!isTop) targetIndex++;

      newSettings.splice(targetIndex, 0, movedItem);

      await this.db.setProjectSettings(newSettings);
      await this.renderProjectSettings();
    });

    return li;
  }

  /**
   * ホストの表示順序を移動します。
   */
  async moveHost(fromIndex, toIndex) {
    const settings = await this.db.getSettings();
    if (
      fromIndex < 0 ||
      fromIndex >= settings.length ||
      toIndex < 0 ||
      toIndex >= settings.length
    ) {
      return;
    }
    const [moved] = settings.splice(fromIndex, 1);
    settings.splice(toIndex, 0, moved);
    await this.db.setSettings(settings);
    await this.renderHostSettings();
  }

  /**
   * プロジェクトの表示順序を移動します。
   */
  async moveProject(fromIndex, toIndex) {
    const settings = await this.db.getProjectSettings();
    if (
      fromIndex < 0 ||
      fromIndex >= settings.length ||
      toIndex < 0 ||
      toIndex >= settings.length
    ) {
      return;
    }
    const [moved] = settings.splice(fromIndex, 1);
    settings.splice(toIndex, 0, moved);
    await this.db.setProjectSettings(settings);
    await this.renderProjectSettings();
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

    if (host && host.id) {
      dialog.dataset.editId = host.id;
      titleEl.textContent = chrome.i18n.getMessage("editHostTitle");
      titleEl.dataset.i18n = "editHostTitle";
      confirmBtn.textContent = chrome.i18n.getMessage("update");
      confirmBtn.dataset.i18n = "update";
      nameInput.value = host.name;
      urlInput.value = host.url;
    } else if (host) {
      // IDがない場合は新規追加だが初期値あり
      delete dialog.dataset.editId;
      titleEl.textContent = chrome.i18n.getMessage("addHostTitle");
      titleEl.dataset.i18n = "addHostTitle";
      confirmBtn.textContent = chrome.i18n.getMessage("add");
      confirmBtn.dataset.i18n = "add";
      nameInput.value = host.name || "";
      urlInput.value = host.url || "";
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

  /**
   * 設定データのインポートを実行し、必要に応じて権限の要求・削除を行います。
   *
   * @param {string} jsonText インポートするJSON文字列
   * @param {string} mode "add" または "overwrite"
   */
  async handleSettingsImport(jsonText, mode = "add") {
    try {
      const currentSettings = await this.db.getSettings();
      const processed = await this.db.processSettingsImport(jsonText, mode);
      const newSettings = processed.settings || [];

      // インポート後に必要となる権限オリジンのリスト
      const requiredOrigins = new Set();
      newSettings.forEach((h) => {
        const origin = getPermissionOriginFromStoredHost(h.url);
        if (origin && !isBuiltinHostOrigin(origin)) {
          requiredOrigins.add(origin);
        }
      });

      // 現在許可されている（任意）オリジンのリスト
      const { origins: grantedOrigins = [] } =
        await chrome.permissions.getAll();

      // 新たに要求が必要なオリジン
      const originsToRequest = [...requiredOrigins].filter(
        (o) => !grantedOrigins.includes(o),
      );

      // 権限の順次要求
      const finalSettings = [...newSettings];
      for (const origin of originsToRequest) {
        let granted = false;
        try {
          granted = await chrome.permissions.request({ origins: [origin] });
        } catch (e) {
          console.error(`Permission request failed for ${origin}`, e);
        }

        if (!granted) {
          // 拒否された場合、そのオリジンを使用するホスト設定をインポート対象から除外する
          for (let i = finalSettings.length - 1; i >= 0; i--) {
            if (
              getPermissionOriginFromStoredHost(finalSettings[i].url) === origin
            ) {
              finalSettings.splice(i, 1);
            }
          }
        } else {
          // 許可された場合、バックグラウンドに通知して既存タブにスクリプトを注入
          chrome.runtime
            .sendMessage({
              type: "HOST_PERMISSION_GRANTED",
              origin: origin,
            })
            .catch(() => {});
        }
      }

      // 上書きモードの場合、不要になった権限の削除
      if (mode === "overwrite") {
        const currentOrigins = new Set();
        currentSettings.forEach((h) => {
          const origin = getPermissionOriginFromStoredHost(h.url);
          if (origin && !isBuiltinHostOrigin(origin)) {
            currentOrigins.add(origin);
          }
        });

        for (const origin of currentOrigins) {
          if (!requiredOrigins.has(origin)) {
            try {
              await chrome.permissions.remove({ origins: [origin] });
            } catch (e) {}
          }
        }
      }

      // 最終的な設定を保存
      processed.settings = finalSettings;

      // 不要なプロジェクト設定のクリーンアップ (オプション: ホストが存在しないプロジェクトも維持する方針なら不要)
      // 今回は、ホストが削除されてもプロジェクト設定（キーと色）は共通設定として維持する仕様とする。

      await chrome.storage.local.set(processed);

      // UIの更新
      await this.renderHostSettings();
      await this.renderProjectSettings();
      this.updateMaxHistoryUI(await this.db.getMaxHistoryCount());

      alert(chrome.i18n.getMessage("settingsImportSuccess"));
    } catch (e) {
      console.error("Settings import failed", e);
      throw e;
    }
  }

  /**
   * インポートダイアログを閉じて、イベントリスナーのクリーンアップを行います。
   */
  closeImportDialog() {
    if (this.importDialogCleanup) {
      this.importDialogCleanup();
      this.importDialogCleanup = null;
    } else {
      const dialog =
        this.elements.importDialog || document.getElementById("import-dialog");
      if (dialog) {
        dialog.classList.add("hidden");
      }
    }
  }

  /**
   * インポートダイアログを開きます。
   * @param {"history" | "settings"} type インポートの種別
   * @param {Function} onConfirm 確認ボタン押下時のコールバック (text) => Promise<void>
   */
  openImportDialog(type, onConfirm) {
    this.closeImportDialog();

    const dialog =
      this.elements.importDialog || document.getElementById("import-dialog");
    const titleEl = document.getElementById("import-dialog-title");
    const textarea = document.getElementById("import-textarea");
    const errorMsg = document.getElementById("import-error-msg");
    const confirmBtn = document.getElementById("confirm-import");
    const cancelBtn = document.getElementById("cancel-import");

    if (type === "history") {
      titleEl.textContent =
        chrome.i18n.getMessage("importHistoryTitle") || "Import History";
    } else {
      titleEl.textContent =
        chrome.i18n.getMessage("importSettingsTitle") || "Import Settings";
    }

    textarea.value = "";
    errorMsg.classList.add("hidden");
    errorMsg.textContent = "";
    confirmBtn.disabled = false;

    if (!textarea.dataset.listenerAdded) {
      textarea.addEventListener("input", () => {
        errorMsg.classList.add("hidden");
      });
      textarea.dataset.listenerAdded = "true";
    }

    dialog.classList.remove("hidden");
    textarea.focus();

    const cleanup = () => {
      confirmBtn.disabled = false;
      dialog.classList.add("hidden");
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
      if (this.importDialogCleanup === cleanup) {
        this.importDialogCleanup = null;
      }
    };

    this.importDialogCleanup = cleanup;

    const handleConfirm = async () => {
      const text = textarea.value.trim();
      if (!text) {
        errorMsg.textContent = chrome.i18n.getMessage("importError");
        errorMsg.classList.remove("hidden");
        return;
      }

      confirmBtn.disabled = true;
      try {
        await onConfirm(text);
        if (this.importDialogCleanup === cleanup) {
          cleanup();
        }
      } catch (err) {
        if (this.importDialogCleanup === cleanup) {
          confirmBtn.disabled = false;
          errorMsg.textContent = chrome.i18n.getMessage("importError");
          errorMsg.classList.remove("hidden");
        }
      }
    };

    const handleCancel = () => {
      cleanup();
    };

    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
  }
}
