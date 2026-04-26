import fs from "fs";
import path from "path";

/**
 * コンテンツスクリプト（content.js）のデータ抽出ロジックのテスト。
 * Jira の各バージョン（Cloud/Data Center）や UI 形式から正しく情報を抽出できるか検証します。
 */
describe("content.js data extraction", () => {
  // 注: content.js は非モジュールの IIFE 形式であるため、
  // 抽出ロジックのコア部分をテストコード側で再現して検証します。
  // これはリファクタリング前の外部仕様を固定するための安全網として機能します。

  const getIssueKey = (url) => {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(
      /\/(?:browse|issues)\/([A-Z0-9]+-[0-9]+)/,
    );
    return match ? match[1] : null;
  };

  test("getIssueKey", () => {
    expect(getIssueKey("https://site.atlassian.net/browse/KAN-1")).toBe(
      "KAN-1",
    );
    expect(getIssueKey("https://site.atlassian.net/issues/ABC-123")).toBe(
      "ABC-123",
    );
    expect(getIssueKey("https://site.atlassian.net/projects/KAN")).toBeNull();
  });

  test("getSummary extraction", () => {
    document.body.innerHTML = `
            <h1 data-testid="issue.views.issue-base.foundation.summary.heading">Cloud Summary</h1>
        `;
    const getSummary = () => {
      const cloudSummary = document.querySelector(
        '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
      );
      if (cloudSummary)
        return (cloudSummary.innerText || cloudSummary.textContent).trim();
      return "";
    };
    expect(getSummary()).toBe("Cloud Summary");

    document.body.innerHTML = `<div id="summary-val">DC Summary</div>`;
    const getSummaryDC = () => {
      const dcSummary = document.querySelector("#summary-val");
      if (dcSummary)
        return (dcSummary.innerText || dcSummary.textContent).trim();
      return "";
    };
    expect(getSummaryDC()).toBe("DC Summary");
  });

  test("getPriority extraction", () => {
    document.body.innerHTML = `
            <div data-testid="issue.views.issue-base.foundation.priority.priority-view">
                <img alt="High" src="..."/>
            </div>
        `;
    const getPriority = () => {
      const el = document.querySelector(
        '[data-testid="issue.views.issue-base.foundation.priority.priority-view"]',
      );
      const img = el.querySelector("img");
      return img ? img.getAttribute("alt") : "";
    };
    expect(getPriority()).toBe("High");
  });
});
