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

    // 状態が変わった時だけ送信して負荷を軽減
    if (isEditing === isEditingState && !isEditing) {
       // 初期ロード時などは常に送信したいので、初回は通す
    }

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

  // デバウンス用のタイマー
  let inputTimeout;

  const handleInput = (e) => {
    const target = e.target;
    if (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox') {

      if (!isEditingState) {
        notifyChange(true);
      }

      // 一定時間入力がなければ編集終了とみなす（簡易的な判定）
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        // 実際にはフォーカスが外れるまで維持したほうが安全かもしれないが
        // PRコメントの「妥当性」を考慮し、過剰な通知を抑制する。
      }, 5000);
    }
  };

  document.addEventListener('focusin', handleInput);
  document.addEventListener('input', handleInput);

})();
