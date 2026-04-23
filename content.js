(function() {
  const getIssueKey = () => {
    const match = window.location.pathname.match(/\/browse\/([A-Z0-9]+-[0-9]+)/);
    return match ? match[1] : null;
  };

  const getTitle = () => {
    const titleTag = document.querySelector('title');
    if (titleTag) {
      return titleTag.innerText.replace(/ - Jira$/, '');
    }
    return '';
  };

  let isEditingState = false;

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

  const notifyChange = (isEditing = false) => {
    const issueKey = getIssueKey();
    if (!issueKey) return;

    chrome.runtime.sendMessage({
      type: 'ISSUE_UPDATED',
      data: {
        issueKey,
        title: getTitle(),
        isEditing,
        url: window.location.href
      }
    });
    isEditingState = isEditing;
  };

  // 初回実行
  // 他のPCで編集が終わった後にページをリロードした場合などを考慮し、DOMから現在の状態を推測する
  notifyChange(detectEditingStateFromDOM());

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // ページ遷移（SPA）時は、まず現在のDOM状態から編集状態を再判定する
      notifyChange(detectEditingStateFromDOM());
    }
  }).observe(document, { subtree: true, childList: true });

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
