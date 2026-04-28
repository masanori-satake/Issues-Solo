# Technical Specification: Issues-Solo

## 1. 概要

JIRAの閲覧履歴をサイドパネルに一覧表示し、タブの生存確認、クイックジャンプを可能にするChrome拡張機能。外部ライブラリを一切使用せず、Vanilla JSで構築する。プライバシーを最優先し、すべてのデータはローカル（IndexedDBおよびchrome.storage.local）に保存される。

## 2. 構成要素 (Zero-Dependency)

- **Manifest**: V3
- **Logic**: Vanilla JavaScript (ES6+)
- **UI**: CSS Variables, Material Design 3 (M3) 準拠のHTML/CSS
- **Storage**:
  - `chrome.storage.local`: 設定値、プロジェクト設定、ソート設定などの小規模データ。
  - `IndexedDB`: 課題の閲覧履歴などの大規模データ。
- **Icons**: SVGソースからビルド時にPNGを生成。

## 3. データ構造

### 3.1. 課題データ (IndexedDB)

- `url`: string (KeyPath, e.g., "https://xxx.atlassian.net/browse/PROJ-1")
- `issueKey`: string (e.g., "PROJ-123")
- `title`: string (要約)
- `priority`: string (優先度)
- `status`: string (ステータス)
- `lastAccessed`: timestamp (最終アクセス時刻)
- `isOpened`: boolean (現在タブとして存在するか)
- `tabId`: number (紐付けられているタブのID)

### 3.2. ホスト設定 (chrome.storage.local)

- `id`: string (タイムスタンプ)
- `name`: string (表示名)
- `url`: string (正規化されたホストURL, e.g., "xxx.atlassian.net")
- `visible`: boolean (表示/非表示)
- `isCollapsed`: boolean (サイドパネルでの折り畳み状態)

### 3.3. プロジェクト設定 (chrome.storage.local)

- `key`: string (プロジェクトキー, e.g., "PROJ")
- `color`: string (M3カラーコード)
- `isCollapsed`: boolean (サイドパネルでの折り畳み状態)

## 4. 主要機能の詳細仕様

### 4.1. 閲覧検知と情報抽出 (`content.js`)

- **対応バージョン**: Jira Cloud版および Data Center版に対応。
- **抽出ロジック**:
  - `issueKey`: URLパスから抽出 (`/browse/KEY` または `/issues/KEY`)。
  - `title`: `data-testid` 属性、`#summary-val` ID、または `h1` タグから優先順に抽出。
  - `priority/status`: アイコンの `alt` 属性、`aria-label`、またはテキスト内容から抽出。
- **SPA対応**: `MutationObserver` を用い、URL遷移や動的なDOM更新を検知して情報を再取得する。

### 4.2. 履歴管理 (`db.js`)

- **上限設定**: デフォルト50件（20, 50, 100から選択可能）。上限を超えると `lastAccessed` が古いものから自動削除される。
- **同期ロジック**: 拡張機能起動時やタブの開閉時に実在するタブとDBの状態を同期させる。
- **インポート/エクスポート**:
  - 履歴は NDJSON 形式でコピー＆ペーストによる入出力が可能。
  - インポート時は常に `isOpened: false`, `tabId: null` として整合性を保つ。

### 4.3. 設定管理 (`settings-manager.js`)

- **ホストの追加**: URL入力時にプロトコルの補完やパスの除去を行う。非Cloudドメインの場合は `chrome.permissions` を用いて任意権限を要求する。
- **並べ替え**: ドラッグ＆ドロップによる手動並べ替えに対応。
- **インポートモード**:
  - `Add (Merge)`: 既存設定を維持し、新しい項目を追加。IDやキーの重複は自動回避される。
  - `Overwrite`: 既存設定を削除し、インポートデータで上書きする。

### 4.4. UI/UX (`sidepanel.js`, `issue-renderer.js`)

- **ソート**: 最終アクセス順、課題キー順、優先度順、ステータス順に対応。
- **グルーピング**: ホスト別、プロジェクト別に階層表示。
- **未登録ホスト**: 設定されていないドメインの履歴は「Unconfigured Hosts」としてグレースケールで表示され、クリック時に設定追加を促す。

## 5. セキュリティ・プライバシー

- **Local Only**: 外部ドメインへの `fetch` や `XMLHttpRequest` は一切行わない。
- **XSS対策**: DOM生成時に `innerHTML` を避け、`textContent` または `createElement` を徹底する。
- **最小権限**: デフォルトでは `atlassian.net` のみ許可し、それ以外はユーザーの明示的な許可（Optional Permissions）に基づいて動作する。

## 免責事項 (Disclaimer)

【免責事項】
本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。

[Disclaimer]
This software is a personal open-source project and is provided "AS IS" without warranty of any kind. Use at your own risk, as per the MIT License.
