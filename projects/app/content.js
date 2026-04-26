(function () {
  if (window.__ISSUES_SOLO_CONTENT_SCRIPT_LOADED__) {
    return;
  }
  window.__ISSUES_SOLO_CONTENT_SCRIPT_LOADED__ = true;

  /**
   * Data Center版のコンテキストパスやCloud新UIに対応するため、
   * 広範なURLパターンで実行されるが、冒頭で課題キーの有無をチェックし
   * 該当しないページでは即座に終了することで負荷を最小限に抑える。
   */

  /**
   * 現在のURLから課題キー（例: KAN-1）を抽出する
   */
  const getIssueKey = () => {
    // /browse/KEY or /issues/KEY に対応 (Data CenterやCloudの新UIに対応)
    const match = window.location.pathname.match(
      /\/(?:browse|issues)\/([A-Z0-9]+-[0-9]+)/,
    );
    return match ? match[1] : null;
  };

  /**
   * 抽出時に除外するラベル（フィールド名自体が取得された場合のフィルタリング用）
   */
  const EXCLUDED_LABELS = ["優先度", "Priority", "ステータス", "Status"];

  /**
   * DOMから課題の要約（Summary）を取得する
   * Cloud版とData Center版の両方に対応
   */
  const getSummary = () => {
    // Cloud
    const cloudSummary = document.querySelector(
      '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
    );
    if (cloudSummary && cloudSummary.innerText.trim()) {
      return cloudSummary.innerText.trim();
    }
    // Data Center
    const dcSummary = document.querySelector("#summary-val");
    if (dcSummary && dcSummary.innerText.trim()) {
      return dcSummary.innerText.trim();
    }
    // フォールバック: h1タグ (多くのJiraビューでサマリーに使用される)
    const h1 = document.querySelector("h1");
    if (h1 && h1.innerText.trim()) {
      return h1.innerText.trim();
    }
    // 最終フォールバック: titleタグからサイト名やキーを除去
    const titleTag = document.querySelector("title");
    if (titleTag) {
      return titleTag.innerText
        .replace(/ - Jira$/, "")
        .replace(/^\[[^\]]+\]\s*/, "");
    }
    return "";
  };

  /**
   * 優先度のキーワード一覧 (長いキーワードから順に判定)
   */
  const PRIORITY_KEYWORDS = [
    "Highest",
    "Lowest",
    "Medium",
    "High",
    "Low",
    "最高",
    "最低",
    "高",
    "中",
    "低",
  ];

  /**
   * DOMから優先度を取得する
   */
  const getPriority = () => {
    // Cloud: 複数のセレクタ候補を試行
    const cloudPrioritySelectors = [
      '[data-testid="issue.views.issue-base.foundation.priority.priority-view"]',
      '[data-testid="issue-field-priority.ui.priority-view.priority-wrapper"]',
      '[data-testid*="priority-view"]',
      '[data-testid*="priority-field"]',
      '[data-testid*="priority.wrapper"]',
    ];

    for (const selector of cloudPrioritySelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // 1. <img>タグのalt属性を確認
        const img = el.querySelector("img");
        if (img && img.getAttribute("alt")) return img.getAttribute("alt");

        // 2. <img>タグのsrcから推測 (altが空の場合の対応)
        if (img && img.getAttribute("src")) {
          const src = img.getAttribute("src").toLowerCase();
          // 長いキーワードから順に判定することで「low」が「lowest」に部分一致するのを防ぐ
          for (const kw of ["highest", "lowest", "medium", "high", "low"]) {
            if (src.includes(kw)) {
              return kw.charAt(0).toUpperCase() + kw.slice(1);
            }
          }
        }

        // 3. <svg>タグのaria-labelを確認
        const svg = el.querySelector("svg");
        if (svg && svg.getAttribute("aria-label"))
          return svg.getAttribute("aria-label");

        // 4. テキスト内容からキーワードを抽出
        let text = el.innerText || "";
        // 不要なラベルを除去 (大文字小文字を区別せず、全て置換)
        for (const label of EXCLUDED_LABELS) {
          text = text.replace(new RegExp(label, "gi"), "");
        }
        text = text.trim();

        if (text) {
          // キーキーワードがそのまま含まれているか確認 (大文字小文字を区別しない)
          for (const kw of PRIORITY_KEYWORDS) {
            if (new RegExp(kw, "i").test(text)) return kw;
          }
          // 特殊ケース：改行などで区切られている場合、最後の行が値である可能性が高い
          const lines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l);
          if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            if (PRIORITY_KEYWORDS.includes(lastLine)) return lastLine;
          }

          if (!EXCLUDED_LABELS.includes(text)) return text;
        }
      }
    }

    // Data Center
    const dcPriority = document.querySelector("#priority-val");
    if (dcPriority) {
      const img = dcPriority.querySelector("img");
      if (img && img.getAttribute("alt")) return img.getAttribute("alt");
      return dcPriority.innerText.trim();
    }
    return "";
  };

  /**
   * DOMからステータスを取得する
   */
  const getStatus = () => {
    // Cloud: 複数のセレクタ候補を試行（ステータスボタン、ピッカーなど）
    const cloudStatusSelectors = [
      '[data-testid="issue.views.issue-base.foundation.status.status-button-item"]',
      '[data-testid="issue-field-status.ui.status-view.status-wrapper"]',
      '[data-testid*="status.status-button-item"]',
      '[data-testid*="status-view"]',
      'button[aria-label*="Status"]',
      'button[aria-label*="ステータス"]',
    ];

    for (const selector of cloudStatusSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        let text = el.innerText || "";
        // 不要なラベルを除去 (大文字小文字を区別せず、全て置換)
        for (const label of EXCLUDED_LABELS) {
          text = text.replace(new RegExp(label, "gi"), "");
        }
        text = text.trim();

        // Jiraのステータスボタンなどは改行を含んで「ステータス\n完了」のようになっていることがある
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l);
        if (lines.length > 0) {
          // 最も長い行か、最後の行をステータス名として採用する可能性が高い
          // ここでは最後の行を採用（Jiraの一般的な構造に準拠）
          const statusCandidate = lines[lines.length - 1];
          if (statusCandidate && !EXCLUDED_LABELS.includes(statusCandidate)) {
            return statusCandidate;
          }
        }

        if (text && !EXCLUDED_LABELS.includes(text)) return text;
      }
    }

    // Data Center
    const dcStatus = document.querySelector("#status-val");
    if (dcStatus && dcStatus.innerText.trim()) {
      return dcStatus.innerText.trim();
    }
    return "";
  };

  let isEditingState = false;
  let isExtensionContextAlive = true;
  let observer = null;
  let debounceTimer = null;
  let lastNotifyTime = 0;
  let lastUrl = location.href;
  let lastInfo = "";

  /**
   * 監視を停止し、リソースを解放する
   */
  const stopExtensionMonitoring = () => {
    // MutationObserverの停止
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // デバウンスタイマーのクリア
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // イベントリスナーの削除
    document.removeEventListener("focusin", startEditing);
    document.removeEventListener("focusout", handleFocusOut);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleVisibilityChange);
    document.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("click", handleClick, true);
  };

  /**
   * コンテキストの無効化を処理する
   */
  const invalidateContext = () => {
    if (!isExtensionContextAlive) return;
    isExtensionContextAlive = false;
    stopExtensionMonitoring();
  };

  /**
   * 安全にメッセージをバックグラウンドに送信する
   */
  const safeSendMessage = (message) => {
    if (!isExtensionContextAlive) return false;

    try {
      if (
        !chrome?.runtime?.id ||
        typeof chrome.runtime.sendMessage !== "function"
      ) {
        invalidateContext();
        return false;
      }

      chrome.runtime.sendMessage(message).catch(() => {
        invalidateContext();
      });
      return true;
    } catch (error) {
      invalidateContext();
      return false;
    }
  };

  /**
   * 要素が保存またはキャンセルボタンかどうかを判定する
   */
  const isSaveOrCancelButton = (el) => {
    if (!el) return false;
    const button = el.closest('button, [role="button"]');
    if (!button) return false;

    // ヘッダーやナビゲーション内のボタン（検索など）は除外する
    if (
      button.closest(
        'header, [data-testid="global-pages.header.pushed-navigation-header"]',
      )
    ) {
      return false;
    }

    const text = button.innerText.trim().toLowerCase();
    const testId = (button.getAttribute("data-testid") || "").toLowerCase();
    const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();

    // 保存・作成・更新系キーワード
    const saveKeywords = [
      "save",
      "保存",
      "create",
      "作成",
      "update",
      "更新",
      "add",
      "追加",
    ];
    // キャンセル系キーワード
    const cancelKeywords = ["cancel", "キャンセル"];

    const matchKeywords = (keywords, target) =>
      keywords.some((kw) => target.includes(kw));

    const isSave =
      matchKeywords(saveKeywords, text) ||
      matchKeywords(saveKeywords, testId) ||
      matchKeywords(saveKeywords, ariaLabel);

    const isCancel =
      matchKeywords(cancelKeywords, text) ||
      matchKeywords(cancelKeywords, testId) ||
      matchKeywords(cancelKeywords, ariaLabel);

    return isSave || isCancel;
  };

  /**
   * DOMの状態から現在の編集状態を推測する
   */
  const detectEditingStateFromDOM = () => {
    // 保存・キャンセルボタンが存在する場合は、編集中である可能性が高い（Jiraの仕様）
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (isSaveOrCancelButton(btn)) {
        // ボタンの近傍（同じフォームやコンテナ内）に編集可能要素があるか確認する。
        // Jira Cloudの新UIではボタンが ak-editor-secondary-toolbar などに分離されているため、
        // より広い範囲（editor-container等）を探索対象とする。
        const container =
          btn.closest(
            "form, [role='dialog'], [data-testid*='editor-container'], [data-component='editor'], .inline-edit-section",
          ) ||
          btn.closest("[data-testid*='editor']")?.parentElement ||
          document.body;

        const hasEditable = !!Array.from(
          container.querySelectorAll(
            'textarea, input, [contenteditable="true"], [role="textbox"]',
          ),
        ).some((el) => isEditableElement(el));
        if (hasEditable) return true;
      }
    }
    return false;
  };

  /**
   * 変更をバックグラウンドに通知する
   */
  const notifyChange = (isEditing = null) => {
    if (!isExtensionContextAlive) return;

    const issueKey = getIssueKey();

    // キーが取得できない場合は、まだページロード中（または課題ページ以外）とみなして通知をスキップする
    // ただし、既に課題ページとして認識されている状態でキーが消えた場合は、タブ関連付け解除を通知する
    if (!issueKey) {
      if (lastNotifyTime > 0) {
        safeSendMessage({ type: "CLEAR_TAB_ASSOCIATION" });
      }
      return;
    }

    lastNotifyTime = Date.now();

    if (isEditing === null) {
      isEditing = detectEditingStateFromDOM();
    }

    const summary = getSummary();
    const priority = getPriority();
    const status = getStatus();

    // 内部状態を更新し、checkInfoChangeとの二重通知を防ぐ
    lastInfo = JSON.stringify({
      k: issueKey,
      s: summary,
      p: priority,
      st: status,
      e: isEditing,
    });

    if (
      !safeSendMessage({
        type: "ISSUE_UPDATED",
        data: {
          issueKey,
          title: summary,
          priority: priority,
          status: status,
          isEditing,
          url: window.location.href,
        },
      })
    ) {
      return;
    }
    isEditingState = isEditing;
  };

  /**
   * 課題情報の変更をチェックし、変化があれば通知する
   */
  const checkInfoChange = () => {
    if (!isExtensionContextAlive) return;

    const issueKey = getIssueKey();
    if (!issueKey) return;

    const isEditing = detectEditingStateFromDOM();
    const info = JSON.stringify({
      k: issueKey,
      s: getSummary(),
      p: getPriority(),
      st: getStatus(),
      e: isEditing,
    });
    if (info !== lastInfo) {
      lastInfo = info;
      // 既に編集状態を取得済みなので、notifyChangeに渡して二重実行を避ける
      notifyChange(isEditing);
    }
  };

  /**
   * 監視対象のルート要素を取得する
   * パフォーマンスのため監視範囲をメインコンテンツに絞り込む
   */
  const getObserverTarget = () => {
    return (
      document.getElementById("jira-frontend") ||
      document.querySelector('[role="main"]') ||
      document.getElementById("content") ||
      document.body
    );
  };

  /**
   * MutationObserverを再接続する
   */
  const reconnectObserver = () => {
    if (!isExtensionContextAlive || !observer) return;

    observer.disconnect();
    observer.observe(getObserverTarget(), {
      subtree: true,
      childList: true,
      characterData: true,
    });
  };

  const isEditableElement = (el) => {
    if (!el) return false;
    const tagName = el.tagName;
    const role = el.getAttribute("role");
    const isContentEditable = el.isContentEditable;

    return (
      tagName === "TEXTAREA" ||
      (tagName === "INPUT" &&
        !["button", "submit", "checkbox", "radio", "hidden"].includes(
          el.type,
        )) ||
      isContentEditable ||
      role === "textbox" ||
      role === "combobox"
    );
  };

  const startEditing = (e) => {
    if (isEditableElement(e.target)) {
      // フォーカスが入っただけでは即座に「編集中」とせず、
      // 実際に保存・キャンセルボタンが存在するかどうかを確認する。
      // JiraのDOM反映（ボタンの表示など）を待つため、少し遅延させてチェックを実行する。
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkInfoChange, 300);
    }
  };

  const handleFocusOut = (e) => {
    if (isEditableElement(e.target)) {
      // フォーカスが外れた際も、即座に解除せずDOM状態を確認する。
      // （ボタンをクリックしてフォーカスが外れた場合などを考慮）
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkInfoChange, 300);
    }
  };

  const stopEditing = () => {
    if (isEditingState) {
      notifyChange(false);
    }
  };

  /**
   * キー操作による編集終了（EnterやEscape）を処理する
   */
  const handleKeyDown = (e) => {
    if (isEditingState) {
      if (e.key === "Escape") {
        stopEditing();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        stopEditing();
      }
    }
  };

  /**
   * 保存・キャンセルボタンのクリックを処理する
   */
  const handleClick = (e) => {
    if (!isEditingState) return;
    if (isSaveOrCancelButton(e.target)) {
      // JiraのSPAでは、保存ボタン押下直後はまだDOMにボタンや入力欄が残っており、
      // 即座にdetectEditingStateFromDOMを実行すると「編集中」のままと誤判定されることがある。
      // そのため、少し遅延させて（非同期処理の完了を待って）再判定を行う。
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkInfoChange, 500);
    }
  };

  /**
   * タブの表示状態やウィンドウのフォーカスを監視して、最終表示時刻を更新する
   */
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && getIssueKey()) {
      const now = Date.now();
      // 短時間の重複通知（focusとvisibilitychangeの同時発生など）を抑制
      if (now - lastNotifyTime > 1000) {
        notifyChange();
      }
    }
  };

  // 1. 初回実行
  notifyChange();

  // 2. MutationObserverの初期化と開始
  observer = new MutationObserver(() => {
    if (!isExtensionContextAlive) return;

    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // ページ遷移（SPA）時は即座に再判定
      notifyChange();
      // SPA遷移後はターゲット要素が変わっている可能性があるため再接続を検討
      reconnectObserver();
    } else {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkInfoChange, 200);
    }
  });
  reconnectObserver();

  // 3. イベントリスナーの登録
  document.addEventListener("focusin", startEditing);
  document.addEventListener("focusout", handleFocusOut);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleVisibilityChange);
  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("click", handleClick, true);
})();
