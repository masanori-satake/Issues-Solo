import { IssueRenderer } from '../../projects/app/modules/issue-renderer.js';

/**
 * IssueRenderer クラスのユニットテスト。
 * 課題リストの DOM レンダリングロジックを検証します。
 */
describe('IssueRenderer', () => {
  let listElement;
  let db;
  let onIssueClick;
  let renderer;

  beforeEach(() => {
    listElement = document.createElement('div');
    // データベース操作をモック化
    db = {
      getAllIssues: jest.fn().mockResolvedValue([]),
      getSortSettings: jest.fn().mockResolvedValue({ type: 'lastAccessed', direction: 'desc' }),
      getSettings: jest.fn().mockResolvedValue([]),
      getProjectSettings: jest.fn().mockResolvedValue([]),
      getOtherCollapsed: jest.fn().mockResolvedValue(false),
      setSettings: jest.fn().mockResolvedValue(undefined),
      setProjectSettings: jest.fn().mockResolvedValue(undefined),
      setOtherCollapsed: jest.fn().mockResolvedValue(undefined),
    };
    onIssueClick = jest.fn();
    renderer = new IssueRenderer(listElement, db, onIssueClick);

    // Chrome 拡張機能の i18n API をモック化
    global.chrome = {
      i18n: {
        getMessage: jest.fn().mockImplementation((key) => key),
      },
    };
  });

  test('should render empty state when no issues', async () => {
    await renderer.render();
    expect(listElement.querySelector('.no-history')).toBeTruthy();
  });

  test('should render issue items', async () => {
    const issues = [
      {
        url: 'https://test.atlassian.net/browse/PROJ-1',
        issueKey: 'PROJ-1',
        title: 'Test Issue',
        lastAccessed: Date.now(),
        isOpened: true,
        isEditing: false,
        status: 'To Do',
        priority: 'High',
      }
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([
      { id: '1', name: 'Jira', url: 'atlassian.net', visible: true }
    ]);

    await renderer.render();

    const items = listElement.querySelectorAll('.issue-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.issue-key').textContent).toBe('PROJ-1');
    expect(items[0].querySelector('.issue-title').textContent).toBe('Test Issue');
  });

  test('should call onIssueClick when item is clicked', async () => {
    const issue = {
      url: 'https://test.atlassian.net/browse/PROJ-1',
      issueKey: 'PROJ-1',
      title: 'Test Issue',
      lastAccessed: Date.now(),
    };
    db.getAllIssues.mockResolvedValue([issue]);
    db.getSettings.mockResolvedValue([
      { id: '1', name: 'Jira', url: 'atlassian.net', visible: true }
    ]);

    await renderer.render();
    listElement.querySelector('.issue-item').click();
    expect(onIssueClick).toHaveBeenCalledWith(issue);
  });

  test('should sort issues by lastAccessed desc by default', async () => {
    const issues = [
      { url: 'https://h1.atlassian.net/browse/K1', issueKey: 'K1', title: 'T1', lastAccessed: 1000 },
      { url: 'https://h1.atlassian.net/browse/K2', issueKey: 'K2', title: 'T2', lastAccessed: 2000 },
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([{ id: '1', name: 'Jira', url: 'h1.atlassian.net', visible: true }]);

    await renderer.render();

    const keys = Array.from(listElement.querySelectorAll('.issue-key')).map(el => el.textContent);
    expect(keys).toEqual(['K2', 'K1']);
  });

  test('should group issues by host', async () => {
    const issues = [
      { url: 'https://h1.atlassian.net/browse/K1', issueKey: 'K1', title: 'T1' },
      { url: 'https://h2.atlassian.net/browse/K2', issueKey: 'K2', title: 'T2' },
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([
      { id: '1', name: 'Host 1', url: 'h1.atlassian.net', visible: true },
      { id: '2', name: 'Host 2', url: 'h2.atlassian.net', visible: true },
    ]);

    await renderer.render();

    const headers = listElement.querySelectorAll('.host-group-header');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('Host 1');
    expect(headers[1].textContent).toContain('Host 2');
  });

  test('should handle host with path', async () => {
    const issues = [
      { url: 'https://jira.com/context/browse/K1', issueKey: 'K1', title: 'T1' },
      { url: 'https://jira.com/other/browse/K2', issueKey: 'K2', title: 'T2' },
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([
      { id: '1', name: 'Jira', url: 'jira.com/context', visible: true },
    ]);

    await renderer.render();

    const items = listElement.querySelectorAll('.issue-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.issue-key').textContent).toBe('K1');
  });

  test('should handle collapsed host', async () => {
    const issues = [
      { url: 'https://h1.atlassian.net/browse/K1', issueKey: 'K1', title: 'T1' },
      { url: 'https://h2.atlassian.net/browse/K2', issueKey: 'K2', title: 'T2' }
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([
      { id: '1', name: 'H1', url: 'h1.atlassian.net', visible: true, isCollapsed: true },
      { id: '2', name: 'H2', url: 'h2.atlassian.net', visible: true, isCollapsed: false }, // アコーディオン表示をトリガーするため2つ目のホストを追加
    ]);

    await renderer.render();

    // H1 が折りたたまれているため、K1 は表示されず、H2 の K2 のみ表示されることを確認
    const keys = Array.from(listElement.querySelectorAll('.issue-key')).map(el => el.textContent);
    expect(keys).not.toContain('K1');
    expect(keys).toContain('K2');
    const header = listElement.querySelector('.host-group-header');
    header.click();
    expect(db.setSettings).toHaveBeenCalled();
  });

  test('should group by project key', async () => {
    const issues = [
      { url: 'https://h1.atlassian.net/browse/PROJA-1', issueKey: 'PROJA-1', title: 'T1' },
      { url: 'https://h1.atlassian.net/browse/PROJB-1', issueKey: 'PROJB-1', title: 'T2' },
    ];
    db.getAllIssues.mockResolvedValue(issues);
    db.getSettings.mockResolvedValue([{ id: '1', name: 'H1', url: 'h1.atlassian.net', visible: true }]);
    db.getProjectSettings.mockResolvedValue([
      { key: 'PROJA', color: '#ff0000', isCollapsed: false },
    ]);

    await renderer.render();

    const projectHeaders = listElement.querySelectorAll('.project-group-header');
    expect(projectHeaders.length).toBe(2); // PROJA グループと other グループ
    expect(projectHeaders[0].textContent).toContain('PROJA');
    expect(projectHeaders[1].textContent).toContain('other');
  });
});
