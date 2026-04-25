# Security Policy

## Supported Versions
We currently provide security updates for the following versions.

| Version | Supported |
| ------- | --------- |
| 0.12.x  | ✅        |
| < 0.12.0| ❌        |

## Reporting a Vulnerability
If you discover a security vulnerability, please report it by creating a new issue using the **Bug Report** template.

### How to report:
1. Navigate to the **Issues** tab of the repository on GitHub.com.
1. Click **New issue**.
1. Locate **Bug Report / 不具合報告** and click **Get started**.
1. Fill out the required fields in the template, such as version, reproduction steps, and diagnostic information.
1. Click **Submit new issue**.

## Our Security & Privacy Philosophy
Issues-Solo is designed with user privacy and security as the top priority, following the principles outlined in our [Privacy Policy](https://masanori-satake.github.io/Issues-Solo/privacy.html).

### 1. Local-Only Architecture
All data (issue keys, titles, and editing states) is stored exclusively in the browser's IndexedDB. No data is ever transmitted to external servers. This ensures that sensitive JIRA information never leaves your device.

### 2. No Tracking or Analytics
We do not use any tracking tools like Google Analytics, nor do we include any advertisements or third-party scripts that could monitor your activity.

### 3. Zero Dependencies (Vanilla JS)
By avoiding external frameworks and libraries, we eliminate the risk of dependency vulnerabilities and supply chain attacks. The code is transparent and easy to audit.

### 4. Supply Chain Security
To prevent accidental inclusion of scripts or unnecessary libraries by AI agents or other tools, we enforce a strict root directory cleanliness policy in our CI/CD workflows.

## Disclaimer
For detailed information, please refer to [README.md](README.md) and [LICENSE](LICENSE).
This software is a personal open-source project and is provided "AS IS" without warranty of any kind. The developer assumes no responsibility for any damages (data loss, business interruption, etc.) resulting from the use of this software. Use at your own risk under the MIT License.

---

# セキュリティポリシー

## サポート対象バージョン
現在、以下のバージョンについてセキュリティアップデートをサポートしています。

| バージョン | サポート |
| ---------- | -------- |
| 0.12.x     | ✅       |
| < 0.12.0   | ❌       |

## 脆弱性の報告方法
セキュリティ上の脆弱性を発見された場合は、**不具合報告（Bug Report）テンプレート**を使用してIssueを作成し、報告してください。

### 報告手順:
1. GitHub.comで、リポジトリの **Issues** タブに移動します。
1. **New issue** ボタンをクリックします。
1. **Bug Report / 不具合報告** の横にある **Get started** をクリックします。
1. テンプレートに従って、バージョン、再現手順、調査用情報などの必要事項を記入します。
1. **Submit new issue** をクリックします。

## セキュリティとプライバシーの設計指針
Issues-Solo は、[プライバシーポリシー](https://masanori-satake.github.io/Issues-Solo/privacy.html) に基づき、ユーザーのプライバシーとセキュリティを最優先に設計されています。

### 1. 完全ローカル動作 (Local-Only)
すべてのデータ（課題キー、タイトル、編集状態）は、利用者のブラウザ内（IndexedDB）にのみ保存されます。外部サーバーへの通信は一切行われないため、機密性の高いJIRAの情報が外部に漏れることはありません。

### 2. トラッキング・解析なし
Google Analytics などのアクセス解析ツールや広告、ユーザーの行動を監視するサードパーティ製スクリプトなどは一切使用していません。

### 3. Vanilla JS (Zero Dependencies)
外部のフレームワークやライブラリに依存しないことで、依存関係の脆弱性やサプライチェーン攻撃のリスクを排除しています。コードの透明性が高く、セキュリティ監査も容易です。

### 4. サプライチェーンの安全性
AIエージェント等による意図しないスクリプトの混入や不要なライブラリの追加を防ぐため、CI/CDワークフローにおいてルートディレクトリのクリーンネス・ポリシーを厳格に強制しています。

## 免責事項
詳細な免責事項については、[README.md](README.md) および [LICENSE](LICENSE) を参照してください。
本ソフトウェアは個人によるオープンソースプロジェクトであり、現状のまま（AS IS）提供されます。本ソフトウェアの使用によって生じた損害（データ消失、業務中断等）について、開発者は一切の責任を負いません。MITライセンスに基づき、自己責任でご利用ください。
