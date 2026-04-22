# Security Policy / セキュリティポリシー

## Supported Versions / サポート対象バージョン

現在、以下のバージョンについてセキュリティアップデートをサポートしています。

| Version | Supported |
| ------- | --------- |
| Latest  | ✅        |
| < 0.1.0 | ❌        |

---

## Reporting a Vulnerability / 脆弱性の報告方法

セキュリティ上の脆弱性を発見された場合は、**GitHubのプライベート報告機能（Private Vulnerability Reporting）**を使用して報告してください。

### How to report / 報告手順:

1. GitHub.comで、リポジトリのメインページに移動します。
2. リポジトリ名の下にある「Security」をクリックします。
3. 左側のサイドバーで「Vulnerability reporting」をクリックします。
4. 「Report a vulnerability」をクリックします。
5. 詳細を記入し、「Submit report」をクリックします。

---

## Our Security Philosophy / セキュリティに関する設計指針

本プロジェクトでは、ユーザーのプライバシーとセキュリティを最優先し、以下の設計指針を採用しています。

### 1. Local-Only Architecture / 完全ローカル動作
Issues-Solo はブラウザ内で完結して動作します。すべてのデータはデバイス上の IndexedDB に保存され、外部サーバーへの通信は一切行われません。JIRAの機密情報が外部に漏れることはありません。

### 2. Vanilla JS (Zero Dependencies) / Vanilla JS の採用
外部のフレームワークやライブラリに依存しないことで、依存関係の脆弱性やサプライチェーン攻撃のリスクを排除しています。コードの透明性が高く、セキュリティ監査も容易です。

### 3. Supply Chain Security / サプライチェーンの安全性
AIエージェント等による一時的なスクリプトの混入や不要なライブラリの追加を防ぐため、CI/CDワークフローにおいてルートディレクトリのクリーンネス・ポリシーを厳格に強制しています。

---

## Disclaimer / 免責事項

詳細な免責事項については、[README.md](README.md) および [LICENSE](LICENSE) を参照してください。

本ソフトウェアは個人によるオープンソースプロジェクトであり、現状のまま（AS IS）提供されます。本ソフトウェアの使用によって生じた損害（データ消失、業務中断等）について、開発者は一切の責任を負いません。MITライセンスに基づき、自己責任でご利用ください。
