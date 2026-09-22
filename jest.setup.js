// jest のグローバルセットアップ。
// 以前は jest-chrome を setupFiles に指定していたが、jest-chrome@0.8.0 の
// peerDependencies が jest@^26||^27 に固定されており、本プロジェクトの jest@29 と
// 競合して `npm ci` が ERESOLVE で失敗する。共通ワークフロー(base-ci/base-coverage)は
// `npm ci` を使うため、jest-chrome を除去し、テストが必要とする最小限の chrome API を
// ここで自前モックする。
//
// 各テストは beforeEach で `global.chrome = {...}` を上書きするものが多いが、
// db.test.js は chrome.storage.local.get/set を jest.fn として利用する（.mockImplementation）。
// そのため storage.local.get/set を中心に、テスト対象コードが参照する主要 API を提供する。

global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  i18n: {
    getMessage: jest.fn((key) => key),
  },
  runtime: {
    id: "test-extension-id",
    getManifest: jest.fn(() => ({ version: "0.0.0" })),
    sendMessage: jest.fn(),
  },
  permissions: {
    request: jest.fn(),
    remove: jest.fn(),
    getAll: jest.fn(),
  },
};
