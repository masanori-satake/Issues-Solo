import { IssueRenderer } from "../../projects/app/modules/issue-renderer.js";
import { IssuesDB } from "../../projects/app/db.js";

/**
 * 脆弱性と異常系に関するユニットテスト。
 * XSS 対策や IndexedDB のエラーハンドリング、インポートデータバリデーションを検証します。
 */
describe("Vulnerability and Edge Case Tests", () => {
  let listElement;
  let db;
  let renderer;

  beforeEach(() => {
    listElement = document.createElement("div");
    db = {
      getAllIssues: jest.fn(),
      getSortSettings: jest
        .fn()
        .mockResolvedValue({ type: "lastAccessed", direction: "desc" }),
      getSettings: jest.fn(),
      getProjectSettings: jest.fn().mockResolvedValue([]),
      getOtherCollapsed: jest.fn().mockResolvedValue(false),
    };
    renderer = new IssueRenderer(listElement, db, () => {});

    global.chrome = {
      i18n: { getMessage: jest.fn().mockImplementation((key) => key) },
    };
  });

  test("XSS protection: should escape issue title and summary", async () => {
    const maliciousTitle = "<img src=x onerror=alert(1)>";
    const issues = [
      {
        url: "https://test.atlassian.net/browse/XSS-1",
        issueKey: "XSS-1",
        title: maliciousTitle,
        lastAccessed: Date.now(),
      },
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([
      { id: "1", name: "Jira", url: "atlassian.net", visible: true },
    ]);

    await renderer.render();

    const titleSpan = listElement.querySelector(".issue-title");
    expect(titleSpan.textContent).toBe(maliciousTitle);
    expect(titleSpan.innerHTML).not.toContain("<img");
  });

  test("IndexedDB malicious data: handle unexpected data structure", async () => {
    const issues = [
      {
        url: "invalid-url", // 不正なURL形式
        issueKey: null, // キーが欠落
        title: undefined, // タイトルが欠落
        lastAccessed: "not-a-number", // 数値ではないアクセス時刻
      },
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([
      { id: "1", name: "Jira", url: "atlassian.net", visible: true },
    ]);

    // 不正なデータが含まれていても例外を投げずにレンダリングを継続することを確認
    await expect(renderer.render()).resolves.not.toThrow();
  });

  test("Disk full / DB error: handle DB failure gracefully", async () => {
    // ディスクフル等によるデータベースエラーをシミュレート
    db.getAllIssues.mockRejectedValue(new Error("QuotaExceededError"));

    // エラーが上位に伝播することを確認
    await expect(renderer.render()).rejects.toThrow("QuotaExceededError");
  });

  test("Import validation: reject non-HTTP/HTTPS URI schemes in history import", async () => {
    const issuesDB = new IssuesDB();
    const maliciousSchemes = [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com/file",
    ];

    for (const url of maliciousSchemes) {
      const ndjson = JSON.stringify({ url, issueKey: "BAD-1" });
      await expect(issuesDB.importIssues(ndjson, "add")).rejects.toThrow(
        "Invalid NDJSON data",
      );
    }
  });

  test("Import validation: reject host settings missing a valid url string", async () => {
    const issuesDB = new IssuesDB();
    const invalidSettings = [
      { id: "1", name: "Jira", visible: true }, // url missing
      { id: "2", name: "Jira", url: "", visible: true }, // url empty
      { id: "3", name: "Jira", url: 123, visible: true }, // url not a string
    ];

    for (const setting of invalidSettings) {
      const json = JSON.stringify({ settings: [setting] });
      await expect(
        issuesDB.processSettingsImport(json, "add"),
      ).rejects.toThrow("Invalid settings JSON");
    }
  });
});
