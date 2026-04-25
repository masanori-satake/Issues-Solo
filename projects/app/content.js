(function () {
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
          // キーワードがそのまま含まれているか確認 (大文字小文字を区別しない)
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

  /**
   * 要素が保存またはキャンセルボタンかどうかを判定する
   */
  const isSaveOrCancelButton = (el) => {
    if (!el) return false;
    const button = el.closest('button, [role="button"]');
    if (!button) return false;

    const text = button.innerText.trim().toLowerCase();
    const testId = button.getAttribute("data-testid");

    const isSave =
      text.includes("save") ||
      text.includes("保存") ||
      (testId && testId.includes("save")) ||
      button.type === "submit";
    const isCancel =
      text.includes("cancel") ||
      text.includes("キャンセル") ||
      (testId && testId.includes("cancel"));
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
        // ボタンが表示されている＝編集フォームが開いているとみなす
        const hasEditable = !!document.querySelector(
          'textarea, [contenteditable="true"], [role="textbox"]',
        );
        if (hasEditable) return true;
      }
    }
    return false;
  };

  /**
   * 変更をバックグラウンドに通知する
   */
  const notifyChange = (isEditing = null) => {
    const issueKey = getIssueKey();
    if (!issueKey) {
      // 課題ページでない場合は、タブの関連付けを解除する
      chrome.runtime.sendMessage({ type: "CLEAR_TAB_ASSOCIATION" });
      return;
    }

    if (isEditing === null) {
      isEditing = detectEditingStateFromDOM();
    }

    chrome.runtime.sendMessage({
      type: "ISSUE_UPDATED",
      data: {
        issueKey,
        title: getSummary(),
        priority: getPriority(),
        status: getStatus(),
        isEditing,
        url: window.location.href,
      },
    });
    isEditingState = isEditing;
  };

  // 初回実行
  notifyChange();

  let lastUrl = location.href;
  let lastInfo = "";
  let debounceTimer = null;

  /**
   * 課題情報の変更をチェックし、変化があれば通知する
   */
  const checkInfoChange = () => {
    const isEditing = detectEditingStateFromDOM();
    const info = JSON.stringify({
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

  // DOMの変化を監視してリアルタイムに更新（デバウンス処理と範囲絞り込みで負荷を軽減）
  const observer = new MutationObserver(() => {
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

  const reconnectObserver = () => {
    observer.disconnect();
    observer.observe(getObserverTarget(), {
      subtree: true,
      childList: true,
      characterData: true,
    });
  };

  reconnectObserver();

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
      if (!isEditingState) {
        notifyChange(true);
      }
    }
  };

  const stopEditing = () => {
    if (isEditingState) {
      notifyChange(false);
    }
  };

  // 編集状態の監視
  document.addEventListener("focusin", startEditing);

  // タブの表示状態やウィンドウのフォーカスを監視して、最終表示時刻を更新する
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      notifyChange();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleVisibilityChange);

  // キー操作による編集終了（EnterやEscape）の検知
  document.addEventListener(
    "keydown",
    (e) => {
      if (isEditingState) {
        if (e.key === "Escape") {
          stopEditing();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          stopEditing();
        }
      }
    },
    true,
  );

  // 保存・キャンセルボタンのクリックを検知
  document.addEventListener(
    "click",
    (e) => {
      if (!isEditingState) return;
      if (isSaveOrCancelButton(e.target)) {
        stopEditing();
      }
    },
    true,
  );
})();
