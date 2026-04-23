# Issues-Solo

[![version](https://img.shields.io/badge/version-0.5.0-blue)](manifest.json)
[![Privacy-Local Only](https://img.shields.io/badge/Privacy-Local%20Only-brightgreen)](AGENTS.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)](manifest.json)

〜JIRA閲覧履歴と編集状態を管理するローカル完結型Chrome拡張機能〜

## プロジェクト概要

Issues-Soloは、プライバシーを最優先に設計された、JIRA専用の閲覧履歴・編集状態管理ツールです。
JIRAで多くのタスクを並行して進める際に、「どのタスクをいつ見たか」「どこまでコメントを書き込んだか」という文脈の喪失を防ぎ、スムーズな作業復帰をサポートします。

設計思想や行動指針については [AGENTS.md](AGENTS.md) を参照してください。

## 特徴

- **JIRA閲覧履歴の自動記録**:
  atlassian.net ドメインの課題ページを表示すると、自動的に課題キーとタイトルを抽出して履歴に保存します。
- **編集状態（書きかけ）の保存**:
  コメントや説明文の入力・編集を検知し、その状態を保存します。タブを閉じたりブラウザを再起動したりしても、「書きかけ」のタスクを即座に特定できます。
- **完全ローカル実行**:
  すべてのデータはブラウザ内の IndexedDB に保存されます。外部サーバーへの送信は一切行われず、機密性の高いJIRAの情報を安全に管理できます。
- **Vanilla JS & ゼロ依存**:
  外部ライブラリを一切使用せず、ブラウザ標準のAPIのみで構築されています。OSSのEOLリスクを排除し、長期にわたる安定動作を保証します。
- **Material 3 デザイン**:
  Google Material 3 (M3) に準拠したUI。サイドパネルに常駐し、作業を妨げることなくクイックにアクセス可能です。

## インストール方法

### 🛠️ 開発版 (Zip)

1. このリポジトリからソースコードをダウンロードまたはクローンします。
2. ブラウザで拡張機能管理ページを開きます（Chrome: `chrome://extensions`）。
3. 「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックし、解凍したフォルダを選択します。
5. ツールバーの拡張機能アイコンをクリックし、Issues-Solo をピン留めして使用します。

## 使用方法

1. **履歴の記録**: 普段通りJIRA（atlassian.net）を使用するだけで、閲覧した課題が自動的にリスト化されます。
2. **サイドパネルの活用**: ブラウザ右側のサイドパネルから Issues-Solo を開くと、履歴の一覧が表示されます。
3. **作業の復元**: 履歴をクリックすると該当の課題ページに移動します。「編集中」のバッジがついているものは、書きかけのコメントがあることを示しています。

## プライバシーとセキュリティ

- **Local Only**: 本アプリは、外部への通信を一切行わないことが保証されています。
- **トラッキングなし**: アクセス解析や広告、外部サービスへのデータ送信は一切行いません。
- **透明性**: プログラムは Vanilla JS で記述されており、依存関係によるブラックボックスがありません。

## 開発者向け情報

ディレクトリ構成やビルド方法などの詳細は [AGENTS.md](AGENTS.md) を参照してください。

---

This project uses Material Design 3, an open-source design system by Google.

## 免責事項 (Disclaimer)

本ソフトウェアは、個人によって開発されたオープンソース・プロジェクトであり、無保証 (AS IS) です。
利用に際して生じたいかなる損害についても、開発者は一切の責任を負いません。 MIT ライセンスの規定に基づき、自己責任でご利用ください。

This software is a personal open-source project and is provided "AS IS" without warranty of any kind. Use at your own risk, as per the MIT License.
