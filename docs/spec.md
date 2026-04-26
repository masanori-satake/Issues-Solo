# Technical Specification: Issues-Solo

## 1.概要

JIRAの閲覧履歴をサイドパネルに一覧表示し、タブの生存確認、クイックジャンプを可能にするChrome拡張機能。外部ライブラリを一切使用せず、Vanilla JSで構築する。

## 2.構成要素 (Zero-Dependency)

- Manifest: V3
- Logic: Vanilla JavaScript (ES6+)
- UI: CSS Variables, Web Components (必要に応じて), HTML/CSS
- Storage: chrome.storage.local (設定・簡易履歴用) および IndexedDB (大量の履歴・キャッシュ用)

## 3.データ構造

- issueKey: string (e.g., "PROJ-123")
- title: string
- project: string
- lastAccessed: timestamp
- isOpened: boolean (現在タブとして存在するか)
- tabId: number (生存中の場合)

## 4.主要機能のロジック

- 閲覧検知: chrome.tabs.onUpdated 等でJIRAのURLパターンを検知。
- タブ同期: 拡張機能の起動時およびタブ削除時に、chrome.tabs.query を使用してメモリ上の実在タブとDBの整合性を取る。

## 5. UI/UX

- サイドパネル内のスタイリングは標準CSSで行い、フレームワーク由来の脆弱性リスクをゼロにする。
- ステータス（実在タブの点灯）をアイコンフォントを使わず、SVGまたはCSS drawingで表現する。

## 免責事項 (Disclaimer)

【免責事項】
本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。

[Disclaimer]
This software is a personal open-source project and is provided "AS IS" without warranty of any kind. Use at your own risk, as per the MIT License.
