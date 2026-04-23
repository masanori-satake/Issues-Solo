(function() {
  /**
   * 現在のURLから課題キー（例: KAN-1）を抽出する
   */
  const getIssueKey = () => {
    const match = window.location.pathname.match(/\/browse\/([A-Z0-9]+-[0-9]+)/);
    return match ? match[1] : null;
  };

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
    // Cloud
    const cloudPriority = document.querySelector('[data-testid="issue.views.issue-base.foundation.priority.priority-view"]');
    if (cloudPriority) {
      const img = cloudPriority.querySelector('img');
      if (img && img.getAttribute('alt')) return img.getAttribute('alt');
      return cloudPriority.innerText.trim();
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
    // Cloud
    const cloudStatus = document.querySelector('[data-testid="issue.views.issue-base.foundation.status.status-button-item"]');
    if (cloudStatus && cloudStatus.innerText.trim()) {
      return cloudStatus.innerText.trim();
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
        // ただし、Jiraのグローバルなボタンと混同しないよう、特定のコンテナ内にあるか等のチェックが必要な場合がある
        // ここではシンプルに、編集可能な要素が存在し、かつ保存ボタンがある場合に限定する
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
  // 他のPCで編集が終わった後にページをリロードした場合などを考慮し、DOMから現在の状態を推測する
  notifyChange();

  let lastUrl = location.href;
  let lastInfo = '';
  let debounceTimer = null;

  /**
   * 課題情報の変更をチェックし、変化があれば通知する
   */
  const checkInfoChange = () => {
    const info = JSON.stringify({
      s: getSummary(),
      p: getPriority(),
      st: getStatus(),
      e: detectEditingStateFromDOM()
    });
    if (info !== lastInfo) {
      lastInfo = info;
      notifyChange();
    }
  };

  // DOMの変化を監視してリアルタイムに更新（デバウンス処理付きで負荷を軽減）
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // ページ遷移（SPA）時は即座に再判定
      notifyChange();
    } else {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkInfoChange, 200);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });

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
        // Escapeはキャンセル扱いで編集終了とみなす
        stopEditing();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+Enter / Cmd+Enter は保存扱いで編集終了とみなす
        stopEditing();
      }
    }
  }, true);

  // 保存・キャンセルボタンのクリックを検知
  document.addEventListener('click', (e) => {
    if (!isEditingState) return;
    if (isSaveOrCancelButton(e.target)) {
      // JiraがDOMを更新するのを待つ必要はなく、ユーザーの意図として編集終了を即座に反映
      stopEditing();
    }
  }, true);

})();
