import { SettingsManager } from '../../projects/app/modules/settings-manager.js';

/**
 * SettingsManager クラスのユニットテスト。
 * 設定パネルの表示、操作、統計情報の更新を検証します。
 */
describe('SettingsManager', () => {
  let db;
  let renderer;
  let manager;

  beforeEach(() => {
    // テスト用の DOM 構造を構築
    document.body.innerHTML = `
      <div id="settings-panel" class="hidden">
        <ul id="host-list"></ul>
        <ul id="project-list"></ul>
        <input type="range" id="max-history-range">
        <span id="max-history-value"></span>
        <div id="add-host-dialog" class="hidden"></div>
        <div id="add-project-dialog" class="hidden"></div>
        <div id="confirm-dialog" class="hidden">
          <span id="confirm-title"></span>
          <p id="confirm-message"></p>
          <button id="confirm-ok"></button>
          <button id="confirm-cancel"></button>
        </div>
        <div id="extension-version"></div>
        <div id="stat-hosts"></div>
        <div id="stat-projects"></div>
        <div id="stat-history"></div>
      </div>
    `;

    db = {
      getSettings: jest.fn().mockResolvedValue([]),
      setSettings: jest.fn().mockResolvedValue(undefined),
      getProjectSettings: jest.fn().mockResolvedValue([]),
      setProjectSettings: jest.fn().mockResolvedValue(undefined),
      getMaxHistoryCount: jest.fn().mockResolvedValue(50),
      setMaxHistoryCount: jest.fn().mockResolvedValue(undefined),
      getIssueCount: jest.fn().mockResolvedValue(0),
      getHistoryImportMode: jest.fn().mockResolvedValue('add'),
      getSettingsImportMode: jest.fn().mockResolvedValue('add'),
    };
    renderer = { render: jest.fn() };

    global.chrome = {
      i18n: { getMessage: jest.fn().mockImplementation(key => key) },
      runtime: {
        getManifest: jest.fn().mockReturnValue({ version: '1.0.0' }),
        sendMessage: jest.fn().mockReturnValue({ catch: jest.fn() })
      },
      permissions: { request: jest.fn().mockResolvedValue(true) }
    };

    manager = new SettingsManager(db, renderer);
  });

  test('should open panel and render settings', async () => {
    await manager.open();
    expect(document.getElementById('settings-panel').classList.contains('hidden')).toBe(false);
    expect(db.getSettings).toHaveBeenCalled();
    expect(db.getProjectSettings).toHaveBeenCalled();
  });

  test('should update stats', async () => {
    db.getSettings.mockResolvedValue([{ id: '1' }]);
    db.getProjectSettings.mockResolvedValue([{ key: 'P1' }, { key: 'P2' }]);
    db.getIssueCount.mockResolvedValue(10);

    await manager.updateAboutStats();

    expect(document.getElementById('stat-hosts').textContent).toBe('1');
    expect(document.getElementById('stat-projects').textContent).toBe('2');
    expect(document.getElementById('stat-history').textContent).toBe('10');
  });

  test('should show confirm dialog', () => {
    const onOk = jest.fn();
    manager.showConfirm('Title', 'Message', onOk);

    expect(document.getElementById('confirm-title').textContent).toBe('Title');
    expect(document.getElementById('confirm-message').textContent).toBe('Message');
    expect(document.getElementById('confirm-dialog').classList.contains('hidden')).toBe(false);

    document.getElementById('confirm-ok').click();
    expect(onOk).toHaveBeenCalled();
    expect(document.getElementById('confirm-dialog').classList.contains('hidden')).toBe(true);
  });

  test('should render host settings', async () => {
    const mockSettings = [
      { id: '1', name: 'Jira Cloud', url: 'atlassian.net', visible: true }
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();

    const items = document.querySelectorAll('.host-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.host-name').textContent).toBe('Jira Cloud');
  });

  test('should toggle host visibility', async () => {
    const mockSettings = [
      { id: '1', name: 'Jira', url: 'atlassian.net', visible: true }
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();
    const toggle = document.querySelector('.visibility-toggle');
    await toggle.click();

    expect(mockSettings[0].visible).toBe(false);
    expect(db.setSettings).toHaveBeenCalledWith(mockSettings);
  });

  test('should delete host', async () => {
    const mockSettings = [
      { id: '1', name: 'Jira', url: 'atlassian.net', visible: true }
    ];
    db.getSettings.mockResolvedValue(mockSettings);

    await manager.renderHostSettings();
    const deleteBtn = document.querySelector('.delete-btn');
    await deleteBtn.click();

    expect(db.setSettings).toHaveBeenCalledWith([]);
  });

  test('should render project settings', async () => {
    const mockProj = [{ key: 'PROJ', color: '#0061A4' }];
    db.getProjectSettings.mockResolvedValue(mockProj);

    await manager.renderProjectSettings();

    expect(document.querySelectorAll('.project-item').length).toBe(1);
    expect(document.querySelector('.project-key-label').textContent).toBe('PROJ');
  });

  test('should change project color', async () => {
    const mockProj = [{ key: 'PROJ', color: '#0061A4' }];
    db.getProjectSettings.mockResolvedValue(mockProj);

    await manager.renderProjectSettings();
    const colorOption = document.querySelectorAll('.color-option')[1];
    await colorOption.click();

    expect(mockProj[0].color).not.toBe('#0061A4');
    expect(db.setProjectSettings).toHaveBeenCalled();
  });

  test('should add host', async () => {
    db.getSettings.mockResolvedValue([]);
    const mockName = 'New Jira';
    const mockUrl = 'new.atlassian.net';

    // addHost 内部で utils.js の normalizeHostInput が呼ばれる
    await manager.addHost(mockName, mockUrl);

    expect(db.setSettings).toHaveBeenCalled();
    expect(document.getElementById('add-host-dialog').classList.contains('hidden')).toBe(true);
  });
});
