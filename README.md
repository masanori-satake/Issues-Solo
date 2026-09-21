# Issues-Solo - Jira Issues Side Panel Viewer

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Extension-blue?logo=googlechrome)](#)
[![version](https://img.shields.io/badge/version-1.0.6-blue)](projects/app/manifest.json)
[![Coverage](https://img.shields.io/badge/coverage-51%25-orange)](#)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen)](AGENTS.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)](projects/app/manifest.json)

> **View and manage assigned Jira Issues instantly in Chrome Side Panel with zero context switching for maximum developer velocity.**

## 💡 Overview & Problem Solved

Managing multiple Jira tabs during software development often leads to tab overload, lost context, and wasted time searching for recently viewed issues.

**Issues-Solo** is a privacy-first `chrome-extension` designed for developers. Operating directly within the Chrome `side-panel`, it automatically captures your browsing history for Jira tickets, allowing you to instantly reopen, filter, and organize your `jira-issues` without interrupting your workflow.

## ✨ Key Features

- **Automatic Jira History Tracking**: Effortlessly records viewed Jira issue keys and titles from registered Cloud and self-hosted Jira instances.
- **Side Panel Integration**: Access your active tasks and recently opened `jira-issues` at any time directly from the Chrome `side-panel`.
- **Flexible Sorting & Organization**: Group and sort issues by last accessed time, issue key, priority, or status.
- **Multi-Host & Custom Project Support**: Track issues across multiple Jira hosts and customize project color tags.
- **Import & Export**: Backup and transfer history and settings data via clean NDJSON/JSON format.

## 🔒 Privacy & Security

- **100% Local Execution**: All issue details and browsing history are stored exclusively in your browser's IndexedDB. Zero external servers, zero telemetry, and zero network tracking.
- **Pure Vanilla JS (Zero Dependencies)**: Built entirely with standard Web APIs without external third-party libraries, eliminating supply chain security risks and EOL issues.
- **Zero User Data Collection**: We do not collect, transmit, or monetize any user data.

## 🚀 Installation & Usage

### 🛠️ Developer Mode Setup

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `projects/app` directory (or root folder containing `manifest.json`).
5. Open the Chrome Side Panel, select **Issues-Solo**, and pin it to your toolbar for quick access.

---

## 🇯🇵 日本語

# Issues-Solo - Jira Issueをサイドパネルで一括管理

JiraのIssueや閲覧履歴をタブを切り替えずにChromeサイドパネルで素早く確認・管理。開発作業の手を止めずに、アサインされた課題や進捗を一目で把握できます。

### 💡 課題と解決策
複数のJiraタブを行き来する開発作業では、「どの課題を見ていたか」の文脈が見失われがちです。Issues-Soloは閲覧したJiraの課題を自動的にサイドパネルに記録し、ワンクリックで元の作業に復帰できるようにします。

### ✨ 主な機能
- **Jira閲覧履歴の自動追跡**: クラウド・オンプレミスのJira課題ページを閲覧するだけでキーとタイトルを自動保存。
- **サイドパネル常駐**: 作業の邪魔にならないサイドパネル上で、いつでも課題を確認可能。
- **ソート＆グループ化**: 最終アクセス日時・課題ID・優先度・ステータス別に並び替え可能。
- **完全ローカル保存**: IndexedDBにデータを保存し、外部サーバーへのデータ送信は一切行いません。

---

## 📄 Disclaimer

This software is a personal open-source project and is provided "AS IS" without warranty of any kind. Use at your own risk, as per the MIT License.
