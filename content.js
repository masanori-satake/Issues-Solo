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
  notifyChange();

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      isEditingState = false; // ページ遷移でリセット
      notifyChange();
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

  const checkEditingState = () => {
    const activeElement = document.activeElement;
    const isEditing = isEditableElement(activeElement);

    if (isEditing !== isEditingState) {
      notifyChange(isEditing);
    }
  };

  // 編集状態の監視
  document.addEventListener('focusin', checkEditingState);
  document.addEventListener('focusout', () => {
    // フォーカスが外れた直後は次の要素にフォーカスが移る前なので、少し待ってから確認
    setTimeout(checkEditingState, 200);
  });

  // キー操作による編集終了（EnterやEscape）の検知
  document.addEventListener('keydown', (e) => {
    if (isEditingState) {
      if (e.key === 'Escape') {
        // Escapeはキャンセル扱いで編集終了とみなす
        setTimeout(checkEditingState, 200);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+Enter / Cmd+Enter は保存扱いで編集終了とみなす
        setTimeout(checkEditingState, 200);
      }
    }
  }, true);

  // 保存・キャンセルボタンのクリックを検知
  document.addEventListener('click', (e) => {
    const target = e.target;
    // Jiraの保存・キャンセルボタンは button か span/div で構成されていることが多い
    const isButton = target.closest('button') ||
                     target.tagName === 'BUTTON' ||
                     (target.getAttribute('role') === 'button');

    if (isButton) {
      // ボタンクリック時は編集状態が変わる可能性が高い
      setTimeout(checkEditingState, 500);
    }
  }, true);

})();
