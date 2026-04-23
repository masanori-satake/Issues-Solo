(function() {
  /**
   * 現在のURLから課題キー（例: KAN-1）を抽出する
   */
  const getIssueKey = () => {
    const match = window.location.pathname.match(/\/browse\/([A-Z0-9]+-[0-9]+)/);
    return match ? match[1] : null;
  };

  /**
   * 抽出時に除外するラベル（フィールド名自体が取得された場合のフィルタリング用）
   */
  const EXCLUDED_LABELS = ['優先度', 'Priority', 'ステータス', 'Status'];

  /**
   * DOMから課題の要約（Summary）を取得する
   * Cloud版とData Center版の両方に対応
   */
  const getSummary = () => {
    // Cloud
    const cloudSummary = document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]');
    if (cloudSummary && cloudSummary.innerText.trim()) {
      return cloudSummary.innerText.trim();
    }
    // Data Center
    const dcSummary = document.querySelector('#summary-val');
    if (dcSummary && dcSummary.innerText.trim()) {
      return dcSummary.innerText.trim();
    }
    // フォールバック: h1タグ (多くのJiraビューでサマリーに使用される)
    const h1 = document.querySelector('h1');
    if (h1 && h1.innerText.trim()) {
      return h1.innerText.trim();
    }
    // 最終フォールバック: titleタグからサイト名やキーを除去
    const titleTag = document.querySelector('title');
    if (titleTag) {
      return titleTag.innerText.replace(/ - Jira$/, '').replace(/^\[[^\]]+\]\s*/, '');
    }
    return '';
  };

  /**
   * DOMから優先度を取得する
   */
  const getPriority = () => {
    // Cloud: 複数のセレクタ候補を試行（チーム管理対象プロジェクト等への対応）
    const cloudPrioritySelectors = [
      '[data-testid="issue.views.issue-base.foundation.priority.priority-view"]',
      '[data-testid="issue-field-priority.ui.priority-view.priority-wrapper"]',
      '[data-testid*="priority-view"]',
      '[data-testid*="priority-field"]'
    ];

    for (const selector of cloudPrioritySelectors) {
      const el = document.querySelector(selector);
      if (el) {
        // <img>タグのalt属性を確認
        const img = el.querySelector('img');
        if (img && img.getAttribute('alt')) return img.getAttribute('alt');

        // <svg>タグのaria-labelを確認（Jira Cloudの新しいUI対応）
        const svg = el.querySelector('svg');
        if (svg && svg.getAttribute('aria-label')) return svg.getAttribute('aria-label');

        const text = el.innerText.trim();
        if (text && !EXCLUDED_LABELS.includes(text)) return text;
      }
    }

    // Data Center
    const dcPriority = document.querySelector('#priority-val');
    if (dcPriority) {
      const img = dcPriority.querySelector('img');
      if (img && img.getAttribute('alt')) return img.getAttribute('alt');
      return dcPriority.innerText.trim();
    }
    return '';
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
      'button[aria-label*="ステータス"]'
    ];

    for (const selector of cloudStatusSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText.trim();
        if (text) return text;
      }
    }

    // Data Center
    const dcStatus = document.querySelector('#status-val');
    if (dcStatus && dcStatus.innerText.trim()) {
      return dcStatus.innerText.trim();
    }
    return '';
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
    const testId = button.getAttribute('data-testid');

    const isSave = text.includes('save') || text.includes('保存') ||
                   (testId && testId.includes('save')) ||
                   button.type === 'submit';
    const isCancel = text.includes('cancel') || text.includes('キャンセル') ||
                     (testId && testId.includes('cancel'));
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
        const hasEditable = !!document.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
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
    if (!issueKey) return;

    if (isEditing === null) {
      isEditing = detectEditingStateFromDOM();
    }

    chrome.runtime.sendMessage({
      type: 'ISSUE_UPDATED',
      data: {
        issueKey,
        title: getSummary(),
        priority: getPriority(),
        status: getStatus(),
        isEditing,
        url: window.location.href
      }
    });
    isEditingState = isEditing;
  };

  // 初回実行
  notifyChange();

  let lastUrl = location.href;
  let lastInfo = '';
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
      e: isEditing
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
    return document.getElementById('jira-frontend') ||
           document.querySelector('[role="main"]') ||
           document.getElementById('content') ||
           document.body;
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
    observer.observe(getObserverTarget(), { subtree: true, childList: true, characterData: true });
  };

  reconnectObserver();

  const isEditableElement = (el) => {
    if (!el) return false;
    const tagName = el.tagName;
    const role = el.getAttribute('role');
    const isContentEditable = el.isContentEditable;

    return (
      tagName === 'TEXTAREA' ||
      (tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio', 'hidden'].includes(el.type)) ||
      isContentEditable ||
      role === 'textbox' ||
      role === 'combobox'
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
  document.addEventListener('focusin', startEditing);

  // キー操作による編集終了（EnterやEscape）の検知
  document.addEventListener('keydown', (e) => {
    if (isEditingState) {
      if (e.key === 'Escape') {
        stopEditing();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        stopEditing();
      }
    }
  }, true);

  // 保存・キャンセルボタンのクリックを検知
  document.addEventListener('click', (e) => {
    if (!isEditingState) return;
    if (isSaveOrCancelButton(e.target)) {
      stopEditing();
    }
  }, true);

})();
