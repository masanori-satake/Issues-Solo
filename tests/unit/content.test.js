import fs from "fs";
import path from "path";
import { TextEncoder, TextDecoder } from "util";

/**
 * content.js の実ロジックを読み込んでテストします。
 */
describe("content.js real logic extraction", () => {
  let document;

  const contentJsCode = fs.readFileSync(
    path.resolve(__dirname, "../../projects/app/content.js"),
    "utf8"
  );

  function setupDOM(url = "https://test.atlassian.net/browse/PROJ-1") {
    delete global.window.location;
    global.window.location = new URL(url);

    document = global.document;

    // Mock chrome API
    global.chrome = {
      runtime: {
        id: "test-id",
        sendMessage: jest.fn().mockReturnValue(Promise.resolve({ catch: jest.fn() })),
        onMessage: { addListener: jest.fn() }
      }
    };

    if (typeof global.TextEncoder === "undefined") {
      global.TextEncoder = TextEncoder;
    }
    if (typeof global.TextDecoder === "undefined") {
      global.TextDecoder = TextDecoder;
    }

    // JSDOM elements don't have innerText by default, but content.js uses it.
    // We should use textContent or mock innerText.
    Object.defineProperty(global.HTMLElement.prototype, 'innerText', {
      get() { return this.textContent; },
      configurable: true
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
    delete global.window.__ISSUES_SOLO_CONTENT_SCRIPT_LOADED__;
  });

  test("getIssueKey from real logic", () => {
    setupDOM("https://test.atlassian.net/browse/KAN-1");
    document.body.innerHTML = '<div id="jira-frontend"></div>';

    const script = new Function(contentJsCode);
    script();

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ISSUE_UPDATED",
        data: expect.objectContaining({ issueKey: "KAN-1" })
      })
    );
  });

  test("getSummary from real logic (Cloud)", () => {
    setupDOM("https://test.atlassian.net/browse/KAN-1");
    document.body.innerHTML = `
      <div id="jira-frontend">
        <h1 data-testid="issue.views.issue-base.foundation.summary.heading">Real Cloud Summary</h1>
      </div>
    `;
    const script = new Function(contentJsCode);
    script();

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Real Cloud Summary" })
      })
    );
  });

  test("getPriority and getStatus from real logic (DC)", () => {
    setupDOM("https://jira.example.com/browse/DC-123");
    document.body.innerHTML = `
      <div id="content">
        <h1 id="summary-val">DC Summary</h1>
        <div id="priority-val"><img alt="Highest" src="..."></div>
        <div id="status-val">In Progress</div>
      </div>
    `;
    const script = new Function(contentJsCode);
    script();

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issueKey: "DC-123",
          title: "DC Summary",
          priority: "Highest",
          status: "In Progress"
        })
      })
    );
  });
});
