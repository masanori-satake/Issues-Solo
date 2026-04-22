# Issues-Solo デザインシステム (DESIGN.md)

Issues-Solo は、Google Material Design 3 (M3) の原則に基づき、「Solo」シリーズ（QuickLog-Solo, Replace-Solo）との親和性を保ちながら、JIRA利用者の認知負荷を最小限に抑える清潔で機能的なインターフェースを提供します。

## 1. デザイン原則

- **Material 3 (M3) 準拠**: 最新のデザイン言語を採用し、一貫性のあるユーザー体験を提供します。
- **Zero-Dependency UI**: 外部のCSSフレームワークやアイコンライブラリを使用せず、標準のCSS/SVGのみで構成します。
- **Context-Centric**: ユーザーが「今何をしているか」「次にどこへ行くべきか」を一目で理解できる情報設計を行います。

## 2. カラーシステム (Color System)

M3のカラートークンに基づき、CSS変数として定義します。Issues-Soloでは、JIRAとの調和を考慮したブルー/ニュートラル基調のパレットを基本とします。

### 基本カラートークン

```css
:root {
  /* Primary: 主要なアクションやブランドカラー */
  --md-sys-color-primary: #005fb0;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #d6e3ff;
  --md-sys-color-on-primary-container: #001b3e;

  /* Surface: 背景やカード */
  --md-sys-color-surface: #fdfbff;
  --md-sys-color-on-surface: #1a1b1f;
  --md-sys-color-surface-variant: #e0e2ec;
  --md-sys-color-on-surface-variant: #44474e;

  /* Outline: 境界線 */
  --md-sys-color-outline: #74777f;
  --md-sys-color-outline-variant: #c4c6d0;

  /* Status: 状態表示（JIRAのステータスに準拠） */
  --status-opened: #36b37e; /* 実在タブ: 緑 */
  --status-editing: #ffab00; /* 編集状態: オレンジ */
}
```

## 3. タイポグラフィ (Typography)

可読性を重視し、システムフォントスタックを使用します。

- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Scale**:
  - **Title Large**: 22px / 28px (ヘッダー)
  - **Label Large**: 14px / 20px (強調テキスト、Issue Key)
  - **Body Medium**: 14px / 20px (標準テキスト、Issue Title)
  - **Label Small**: 11px / 16px (補助テキスト)

## 4. コンポーネント指針

### サイドパネル (Side Panel)
- パネル全体に `surface` カラーを適用。
- ヘッダーは `surface-variant` または `surface` に境界線（`outline-variant`）を配置。

### リストアイテム (List Item)
- **Padding**: 上下12px、左右16px。
- **Hover State**: `state-layer` を模した背景色（`surface-variant` の透過）の変化。
- **Separator**: `outline-variant` による1pxの線。

### ステータス・インジケーター
- **実在タブ (isOpened)**: M3のドットパターン、または `primary` / `status-opened` カラーの小さな円。
- **編集状態 (isEditing)**: SVGによる鉛筆アイコン（`status-editing` カラー）。

## 5. アイコンとグラフィック

- アイコンフォント（Material Icons等）は使用しません。
- 必要なアイコンはインラインSVG、または `mask-image` を用いたCSS描画で実装します。
- これにより、フォント読み込みによる遅延やプライバシーリスクを排除します。
