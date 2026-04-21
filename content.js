(function() {
  const getIssueKey = () => {
    const match = window.location.pathname.match(/\/browse\/([A-Z0-9]+-[0-9]+)/);
    return match ? match[1] : null;
  };

  const getTitle = () => {
    const titleTag = document.querySelector('title');
    if (titleTag) {
      // JIRAのタイトルは通常 "[PROJ-123] Title - Jira" の形式
      return titleTag.innerText.replace(/ - Jira$/, '');
    }
    return '';
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
  };

  // 初回実行
  notifyChange();

  // URL変更の検知 (SPA対策)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      notifyChange();
    }
  }).observe(document, { subtree: true, childList: true });

  // 編集状態の検知
  // コメント入力欄や課題編集フィールドのフォーカス/入力を監視
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox') {
      notifyChange(true);
    }
  });

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox') {
      // 入力がある場合は編集中とみなす
      notifyChange(true);
    }
  });

  document.addEventListener('focusout', (e) => {
    // 実際には入力が残っている場合もあるが、シンプルにするため
    // 完全に編集が終わったかどうかを判定するのは難しいため、
    // 入力が空になったか、一定時間経過などでリセットするロジックも検討可能。
    // ここではフォーカスアウトだけでは isEditing=false にせず、
    // ページ遷移時や明示的な保存を検知するのが望ましい。
    // 現状はシンプルに維持。
  });

})();
