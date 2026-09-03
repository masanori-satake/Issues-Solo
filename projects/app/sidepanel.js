import { IssuesDB } from "./db.js";
import { IssueRenderer } from "./modules/issue-renderer.js";
import { SettingsManager } from "./modules/settings-manager.js";
import { isUrlMatchHost, extractIssueKeyFromUrl } from "./utils.js";

/**
 * SidePanel クラスは、拡張機能のサイドパネル全体のライフサイクルと
 * イベントハンドリングを管理するメインエントリーポイントです。
 */
class SidePanel {
  constructor() {
    this.db = new IssuesDB();
    this.loadingUrls = new Set();
    this.renderer = new IssueRenderer(
      document.getElementById("issue-list"),
      this.db,
      this.handleIssueClick.bind(this),
      this.loadingUrls,
    );
    this.settings = new SettingsManager(this.db, this.renderer);

    this.init();
  }

  /**
   * 初期化処理を行います。
   */
  async init() {
    this.applyTranslations();
    this.setupEventListeners();
    await this.renderer.render();
  }

  /**
   * i18n対応: data-i18n属性を持つ要素のテキストを更新します。
   */
  applyTranslations() {
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
      const { i18n, i18nTitle, i18nPlaceholder } = el.dataset;
      if (i18n) {
        const msg = chrome.i18n.getMessage(i18n);
        if (msg) el.textContent = msg;
      }
      if (i18nTitle) {
        const msg = chrome.i18n.getMessage(i18nTitle);
        if (msg) el.setAttribute("title", msg);
      }
      if (i18nPlaceholder) {
        const msg = chrome.i18n.getMessage(i18nPlaceholder);
        if (msg) el.setAttribute("placeholder", msg);
      }
    });
  }

  /**
   * イベントリスナーを設定します。
   */
  setupEventListeners() {
    // ソートボタン
    const sortBtns = {
      lastAccessed: document.getElementById("sort-lastAccessed"),
      issueKey: document.getElementById("sort-issueKey"),
      priority: document.getElementById("sort-priority"),
      status: document.getElementById("sort-status"),
    };

    Object.keys(sortBtns).forEach((type) => {
      sortBtns[type].addEventListener("click", async () => {
        const current = await this.db.getSortSettings();
        const newDirection =
          current.type === type && current.direction === "desc"
            ? "asc"
            : "desc";
        await this.db.setSortSettings({ type, direction: newDirection });
        this.updateSortUI({ type, direction: newDirection });
        await this.renderer.render();
      });
    });

    // 初期状態のソートUI反映
    this.db.getSortSettings().then((settings) => this.updateSortUI(settings));

    // 設定ボタン
    document
      .getElementById("settings-btn")
      .addEventListener("click", () => this.settings.open());
    document
      .getElementById("close-settings")
      .addEventListener("click", () => this.settings.close());

    // パネル外クリックで閉じる
    const settingsPanel = document.getElementById("settings-panel");
    settingsPanel.addEventListener("click", (e) => {
      if (e.target === settingsPanel) this.settings.close();
    });

    const importDialog = document.getElementById("import-dialog");
    if (importDialog) {
      importDialog.addEventListener("click", (e) => {
        if (e.target === importDialog) this.settings.closeImportDialog();
      });
    }

    // タブ切り替え
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.toggle("active", b === btn));
        document
          .querySelectorAll(".tab-content")
          .forEach((c) =>
            c.classList.toggle("hidden", c.id !== `${tabName}-tab`),
          );
        if (tabName === "about") this.settings.updateAboutStats();
      });
    });

    // 履歴上限変更
    const range = document.getElementById("max-history-range");
    range.addEventListener("change", async () => {
      const counts = [20, 50, 100];
      const newCount = counts[range.value];
      const currentIssues = await this.db.getAllIssues();

      if (
        newCount < this.settings.previousMaxHistoryCount &&
        currentIssues.length > newCount
      ) {
        this.settings.showConfirm(
          chrome.i18n.getMessage("changeHistoryLimit"),
          chrome.i18n.getMessage("changeHistoryLimitConfirm", [
            newCount.toString(),
            (currentIssues.length - newCount).toString(),
          ]),
          async () => {
            await this.db.setMaxHistoryCount(newCount);
            await this.db.pruneIssues(newCount);
            this.settings.previousMaxHistoryCount = newCount;
            this.settings.updateMaxHistoryUI(newCount);
            await this.renderer.render();
          },
          () =>
            this.settings.updateMaxHistoryUI(
              this.settings.previousMaxHistoryCount,
            ),
        );
      } else {
        await this.db.setMaxHistoryCount(newCount);
        this.settings.previousMaxHistoryCount = newCount;
        this.settings.updateMaxHistoryUI(newCount);
      }
    });

    // 履歴・設定の管理
    document
      .getElementById("clear-history-btn")
      .addEventListener("click", () => {
        this.settings.showConfirm(
          chrome.i18n.getMessage("clearHistoryTitle"),
          chrome.i18n.getMessage("clearHistoryConfirm"),
          async () => {
            await this.db.clearAllIssues();
            await this.renderer.render();
          },
        );
      });

    document
      .getElementById("export-history-btn")
      .addEventListener("click", async () => {
        const issues = await this.db.getAllIssues();
        const ndjson = issues.map((i) => JSON.stringify(i)).join("\n");
        try {
          await navigator.clipboard.writeText(ndjson);
          alert(chrome.i18n.getMessage("historyExportSuccess"));
        } catch (err) {
          console.error(err);
        }
      });

    document
      .getElementById("import-history-btn")
      .addEventListener("click", () => {
        this.settings.openImportDialog("history", async (text) => {
          const mode = document.querySelector(
            'input[name="history-import-mode"]:checked',
          ).value;
          await this.db.importIssues(text, mode);
          await this.renderer.render();
          alert(chrome.i18n.getMessage("historyImportSuccess"));
        });
      });

    document
      .querySelectorAll('input[name="history-import-mode"]')
      .forEach((radio) => {
        radio.addEventListener("change", () =>
          this.db.setHistoryImportMode(radio.value),
        );
      });

    document
      .getElementById("export-settings-btn")
      .addEventListener("click", async () => {
        const data = {
          settings: await this.db.getSettings(),
          projectSettings: await this.db.getProjectSettings(),
          otherCollapsed: await this.db.getOtherCollapsed(),
          maxHistoryCount: await this.db.getMaxHistoryCount(),
        };
        try {
          await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
          alert(chrome.i18n.getMessage("settingsExportSuccess"));
        } catch (err) {
          console.error(err);
        }
      });

    document
      .getElementById("import-settings-btn")
      .addEventListener("click", () => {
        this.settings.openImportDialog("settings", async (text) => {
          const mode = document.querySelector(
            'input[name="settings-import-mode"]:checked',
          ).value;
          await this.settings.handleSettingsImport(text, mode);
          await this.renderer.render();
        });
      });

    document
      .querySelectorAll('input[name="settings-import-mode"]')
      .forEach((radio) => {
        radio.addEventListener("change", () =>
          this.db.setSettingsImportMode(radio.value),
        );
      });

    // プロジェクト追加
    document.getElementById("add-project-btn").addEventListener("click", () => {
      this.settings.openProjectDialog();
    });

    document.getElementById("cancel-project").addEventListener("click", () => {
      document.getElementById("project-dialog").classList.add("hidden");
    });

    document
      .getElementById("confirm-project")
      .addEventListener("click", async () => {
        const key = document
          .getElementById("project-key-input")
          .value.trim()
          .toUpperCase();
        if (key) {
          const dialog = document.getElementById("project-dialog");
          const editKey = dialog.dataset.editKey;
          if (editKey) {
            await this.settings.updateProject(editKey, key);
          } else {
            await this.settings.addProject(key);
          }
        }
      });

    // ホスト追加
    document.getElementById("add-host-btn").addEventListener("click", () => {
      this.settings.openHostDialog();
    });

    document.getElementById("cancel-host").addEventListener("click", () => {
      document.getElementById("host-dialog").classList.add("hidden");
    });

    document.getElementById("confirm-host").addEventListener("click", () => {
      const dialog = document.getElementById("host-dialog");
      const editId = dialog.dataset.editId;
      const name = document.getElementById("host-name").value.trim();
      const url = document.getElementById("host-url").value.trim();

      if (editId) {
        this.settings.updateHost(editId, name, url);
      } else {
        this.settings.addHost(name, url);
      }
    });

    // メッセージ受信
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "DB_UPDATED") {
        this.handleDbUpdated();
      }
    });

    // ストレージ変更監視
    chrome.storage.onChanged.addListener((changes) => {
      if (
        changes.settings ||
        changes.projectSettings ||
        changes.otherCollapsed
      ) {
        this.renderer.render();
        if (
          !document
            .getElementById("settings-panel")
            .classList.contains("hidden")
        ) {
          this.settings.renderHostSettings();
          this.settings.renderProjectSettings();
        }
      }
    });
  }

  /**
   * 課題クリック時の動作。タブ切り替えまたは新規作成を行います。
   * 重複を避けるため、同じ課題キーを開いている既存のタブがあればそれをアクティブにします。
   * @param {Object} issue 課題オブジェクト
   */
  async handleIssueClick(issue) {
    // すでに読み込み中の場合は、重複して開かないようにガードする
    if (this.loadingUrls.has(issue.url)) {
      return;
    }

    // ホスト設定がない場合は追加を促す
    const settings = await this.db.getSettings();
    const isConfigured = settings.some((host) =>
      isUrlMatchHost(issue.url, host.url),
    );

    if (!isConfigured) {
      try {
        const url = new URL(issue.url);
        const host = url.hostname;
        this.settings.showConfirm(
          chrome.i18n.getMessage("confirm"),
          chrome.i18n.getMessage("addHostConfirm", [host]),
          () => {
            this.settings.open();
            // 一般タブ（ホスト設定）を表示
            const generalBtn = document.querySelector(
              '.tab-btn[data-tab="general"]',
            );
            if (generalBtn) generalBtn.click();
            this.settings.openHostDialog({ name: "", url: host });
          },
        );
      } catch (e) {
        console.error("Invalid issue URL", e);
      }
      return;
    }

    // 重複して開かないよう、既存のタブから同じ課題キーを持つものを探す。
    // JiraのURLは /browse/KEY-1 や /issues/KEY-1 など複数の形式があるため、
    // 課題キー（ISSUE_KEY）に基づいて判定を行う。
    const issueKey = extractIssueKeyFromUrl(issue.url);
    let targetTab = null;

    if (issueKey) {
      // 現在クリックされたIssueに対応するホスト設定を特定する
      const targetHost = settings.find((host) =>
        isUrlMatchHost(issue.url, host.url),
      );

      // パフォーマンスとプライバシーのため、全タブではなくIssueに関連する可能性のあるタブに絞って検索する
      const tabs = await chrome.tabs.query({
        url: ["*://*.atlassian.net/*", "*://*/*"],
      });

      const matchingTabs = tabs
        .filter((t) => {
          // 1. 課題キーが一致すること
          const k = extractIssueKeyFromUrl(t.url);
          if (k !== issueKey) return false;

          // 2. ホスト設定が一致すること（異なるJiraインスタンスで同じキーを持つ別課題への誤遷移を防ぐ）
          // ホスト設定が見つからない（未設定ホスト）の場合は、ホスト名の一致で判定する。
          if (targetHost) {
            return isUrlMatchHost(t.url, targetHost.url);
          } else {
            try {
              return new URL(t.url).hostname === new URL(issue.url).hostname;
            } catch (e) {
              return false;
            }
          }
        })
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      if (matchingTabs.length > 0) {
        targetTab = matchingTabs[0];
      }
    }

    if (targetTab) {
      // 既存のタブをアクティブにする
      try {
        await chrome.tabs.update(targetTab.id, { active: true });
        await chrome.windows.update(targetTab.windowId, { focused: true });

        // タブグループに入っていて折りたたまれている場合は、ユーザーが見えるように展開する。
        // chrome.tabGroups API が利用可能であることを確認してから実行する。
        if (
          chrome.tabGroups &&
          targetTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
        ) {
          try {
            const group = await chrome.tabGroups.get(targetTab.groupId);
            if (group.collapsed) {
              await chrome.tabGroups.update(targetTab.groupId, {
                collapsed: false,
              });
            }
          } catch (groupError) {
            console.warn("Failed to update tab group state:", groupError);
          }
        }
      } catch (e) {
        // 何らかの理由で失敗した場合は新規タブで開く
        this._startLoading(issue.url);
        chrome.tabs.create({ url: issue.url });
      }
    } else {
      // 既存タブが見つからない場合は、新規タブで開く
      this._startLoading(issue.url);
      chrome.tabs.create({ url: issue.url });
    }

    // 最終アクセス時刻の更新。
    await this._updateLastAccessed(issue);
  }

  /**
   * データベース更新メッセージ受信時の処理を行います。
   * 読み込み中状態のURLが「開いている」状態に変わったかを確認し、必要に応じて解除します。
   * @private
   */
  async handleDbUpdated() {
    if (this.loadingUrls.size > 0) {
      const issues = await this.db.getAllIssues();
      for (const url of this.loadingUrls) {
        const issue = issues.find((i) => i.url === url);
        // タブが開かれ、content.js から background.js 経由で DB が更新されると
        // isOpened が true になるため、それを検知して読み込み中を解除する。
        if (issue && issue.isOpened) {
          this.loadingUrls.delete(url);
        }
      }
    }
    await this.renderer.render();
  }

  /**
   * 指定したURLの読み込み状態を開始します。
   * 5秒後に自動的に解除されます。
   * @private
   * @param {string} url
   */
  _startLoading(url) {
    this.loadingUrls.add(url);
    // 即座に見た目を反映させる
    this.renderer.render();

    // ネットワークエラーや読み込み失敗に備え、一定時間で強制解除する。
    setTimeout(() => {
      if (this.loadingUrls.has(url)) {
        this.loadingUrls.delete(url);
        this.renderer.render();
      }
    }, 5000);
  }

  /**
   * 課題クリック時の動作（共通）。
   * @private
   */
  async _updateLastAccessed(issue) {
    const sortSettings = await this.db.getSortSettings();
    if (sortSettings.type === "lastAccessed") {
      // upsertIssue は background.js で DB_UPDATED メッセージを送信する。
      await this.db.upsertIssue({ ...issue, lastAccessed: Date.now() });
      // render() は handleDbUpdated で呼ばれるためここでは明示的に呼ばない
    }
  }

  /**
   * ソートUI（アイコンの向き）を更新します。
   * @param {Object} sortSettings ソート設定
   */
  updateSortUI(sortSettings) {
    const types = ["lastAccessed", "issueKey", "priority", "status"];
    types.forEach((type) => {
      const btn = document.getElementById(`sort-${type}`);
      const isActive = sortSettings.type === type;
      btn.classList.toggle("active", isActive);
      const dirIcon = btn.querySelector(".dir-icon");
      if (isActive) {
        dirIcon.textContent =
          sortSettings.direction === "desc" ? "arrow_downward" : "arrow_upward";
      } else {
        dirIcon.textContent = "arrow_downward";
      }
    });
  }
}

// ページロード時にインスタンス化
new SidePanel();
