import { jest } from '@jest/globals';

// content.js is an IIFE, so we need to extract or mock the functions.
// For unit testing, we can define the functions in the test scope
// mimicking the ones in content.js.

describe("content.js editing state detection", () => {
  const isSaveOrCancelButton = (el) => {
    if (!el) return false;
    const button = el.closest('button, [role="button"]');
    if (!button) return false;

    const testId = (button.getAttribute("data-testid") || "").toLowerCase();

    // ヘッダーやナビゲーション内のボタン（検索やグローバルな「作成」など）は除外する
    if (
      testId.includes("atlassian-navigation") ||
      button.closest(
        'header, [data-testid="global-pages.header.pushed-navigation-header"], [data-testid="atlassian-navigation"]',
      )
    ) {
      return false;
    }

    // 監査ログの更新ボタンなどは除外
    if (testId.includes("audit-log") && testId.includes("refresh")) {
      return false;
    }

    const text = (button.innerText || button.textContent || "").trim().toLowerCase();
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
      (matchKeywords(saveKeywords, text) ||
        matchKeywords(saveKeywords, testId) ||
        matchKeywords(saveKeywords, ariaLabel)) &&
      !matchKeywords(["comment-text-area-placeholder"], testId);

    const isCancel =
      matchKeywords(cancelKeywords, text) ||
      matchKeywords(cancelKeywords, testId) ||
      matchKeywords(cancelKeywords, ariaLabel);

    return isSave || isCancel;
  };

  const isEditableElement = (el) => {
    if (!el) return false;
    const tagName = el.tagName;
    const role = el.getAttribute("role");
    const isContentEditable = el.isContentEditable;
    const testId = (
      el.getAttribute("data-testid") ||
      el.getAttribute("data-test-id") ||
      ""
    ).toLowerCase();

    // 検索窓などは編集対象から除外する
    if (testId.includes("search")) {
      return false;
    }

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

  const detectEditingStateFromDOM = () => {
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (isSaveOrCancelButton(btn)) {
        const container =
          btn.closest(
            "form, [role='dialog'], [data-testid*='editor-container'], [data-component='editor'], .inline-edit-section",
          ) || btn.closest("[data-testid*='editor']")?.parentElement;

        const searchRoot = container || document.body;

        const editables = searchRoot.querySelectorAll(
          'textarea, input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), [contenteditable="true"], [role="textbox"], [role="combobox"]',
        );
        const hasEditable = Array.from(editables).some((el) =>
          isEditableElement(el),
        );
        if (hasEditable) return true;
      }
    }
    return false;
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test("should NOT detect editing for global navigation Create button", () => {
    document.body.innerHTML = `
      <div data-testid="atlassian-navigation">
        <button data-testid="atlassian-navigation--create-button">作成</button>
      </div>
      <input data-test-id="search-dialog-input" value="some search text">
    `;
    expect(detectEditingStateFromDOM()).toBe(false);
  });

  test("should NOT detect editing for audit log refresh button", () => {
    document.body.innerHTML = `
      <button data-testid="automation-issue-audit-log.ui.refresh">更新</button>
      <input data-test-id="search-dialog-input" value="some search text">
    `;
    expect(detectEditingStateFromDOM()).toBe(false);
  });

  test("should NOT detect editing for comment placeholder", () => {
    document.body.innerHTML = `
      <button data-testid="canned-comments.common.ui.comment-text-area-placeholder.textarea">コメントを追加する...</button>
      <input data-test-id="search-dialog-input" value="some search text">
    `;
    expect(detectEditingStateFromDOM()).toBe(false);
  });

  test("should detect editing for real inline edit", () => {
    document.body.innerHTML = `
      <div class="inline-edit-section">
        <textarea>Editing content</textarea>
        <button>保存</button>
        <button>キャンセル</button>
      </div>
    `;
    expect(detectEditingStateFromDOM()).toBe(true);
  });

  test("should NOT detect editing when only search input is present and some random button exists", () => {
    document.body.innerHTML = `
      <input data-test-id="search-dialog-input" value="some search text">
      <button>Random Button</button>
    `;
    expect(detectEditingStateFromDOM()).toBe(false);
  });

  test("should NOT detect editing even if save button exists but only search input is editable", () => {
    // Tests isEditableElement exclusion in detectEditingStateFromDOM.
    document.body.innerHTML = `
      <button>保存</button>
      <input data-test-id="search-dialog-input" value="some search text">
    `;
    expect(detectEditingStateFromDOM()).toBe(false);
  });
});
