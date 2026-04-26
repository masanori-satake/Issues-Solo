import { IssueRenderer } from '../../projects/app/modules/issue-renderer.js';

/**
 * 脆弱性と異常系に関するユニットテスト。
 * XSS 対策や IndexedDB のエラーハンドリングを検証します。
 */
describe('Vulnerability and Edge Case Tests', () => {
  let listElement;
  let db;
  let renderer;

  beforeEach(() => {
    listElement = document.createElement('div');
    db = {
      getAllIssues: jest.fn(),
      getSortSettings: jest.fn().mockResolvedValue({ type: 'lastAccessed', direction: 'desc' }),
      getSettings: jest.fn(),
      getProjectSettings: jest.fn().mockResolvedValue([]),
      getOtherCollapsed: jest.fn().mockResolvedValue(false),
    };
    renderer = new IssueRenderer(listElement, db, () => {});

    global.chrome = {
      i18n: { getMessage: jest.fn().mockImplementation(key => key) }
    };
  });

  test('XSS protection: should escape issue title and summary', async () => {
    const maliciousTitle = '<img src=x onerror=alert(1)>';
    const issues = [{
      url: 'https://test.atlassian.net/browse/XSS-1',
      issueKey: 'XSS-1',
      title: maliciousTitle,
      lastAccessed: Date.now(),
    }];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([{ id: '1', name: 'Jira', url: 'atlassian.net', visible: true }]);

    await renderer.render();

    const titleSpan = listElement.querySelector('.issue-title');
    expect(titleSpan.textContent).toBe(maliciousTitle);
    expect(titleSpan.innerHTML).not.toContain('<img');
  });

  test('IndexedDB malicious data: handle unexpected data structure', async () => {
    const issues = [{
      url: 'invalid-url', // 不正なURL形式
      issueKey: null,     // キーが欠落
      title: undefined,   // タイトルが欠落
      lastAccessed: 'not-a-number', // 数値ではないアクセス時刻
    }];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([{ id: '1', name: 'Jira', url: 'atlassian.net', visible: true }]);

    // 不正なデータが含まれていても例外を投げずにレンダリングを継続することを確認
    await expect(renderer.render()).resolves.not.toThrow();
  });

  test('Disk full / DB error: handle DB failure gracefully', async () => {
    // ディスクフル等によるデータベースエラーをシミュレート
    db.getAllIssues.mockRejectedValue(new Error('QuotaExceededError'));

    // エラーが上位に伝播することを確認
    await expect(renderer.render()).rejects.toThrow('QuotaExceededError');
  });
});
