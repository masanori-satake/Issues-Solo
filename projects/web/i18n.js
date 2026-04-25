const translations = {
  en: {
    title:
      "Issues-Solo - Local-only Chrome extension to manage JIRA browsing history and editing status",
    usage: "Usage",
    privacy: "Privacy Policy",
    tagline:
      "〜Local-only Chrome extension to manage JIRA browsing history and editing status〜",
    cta: "Add to Chrome Web Store",
    projectOverview: "Project Overview",
    overviewText:
      "Issues-Solo is a JIRA-specific browsing history and editing status management tool designed with privacy as the top priority. It safely records 'which task you saw and when' and 'how much you have written' within your browser, supporting the restoration of your work context.",
    features: "Features",
    featureJira: "JIRA Specialized",
    featureJiraText:
      "Automatically extracts issue keys and titles on the atlassian.net domain and lists them as browsing history.",
    featureEditing: "Save Editing Status",
    featureEditingText:
      "Detects changes in comments or descriptions being entered and saves them. Even if you close the browser, you can restore the 'work-in-progress' state.",
    featureLocal: "Complete Local Execution",
    featureLocalText:
      "All data is saved in IndexedDB within the browser. No data is ever sent to external servers.",
    featureM3: "Material 3 UI",
    featureM3Text:
      "Adopts Google Material 3 (M3) design. Operates comfortably in the side panel without interfering with your work.",
    install: "How to Install",
    installStep1: "Access the Chrome Web Store.",
    installStep2: 'Click the "Add to Chrome" button.',
    installStep3:
      "Pinning the extension makes it easier to access from the side panel at any time.",
    copyright: "© 2026 Issues-Solo. All rights reserved.",
    privacyTitle: "Privacy Policy - Issues-Solo",
    usageTitle: "Usage - Issues-Solo",
    backToHome: "Back to Home",
    privacyPolicy: "Privacy Policy",
    usageGuide: "Usage Guide",
    langEn: "English",
    langJa: "日本語",
    privacyHeader1: "1. Data Collection and Use",
    privacyText1:
      "Issues-Solo collects JIRA issue keys, titles, and the editing status of input forms to improve user convenience. All of this data is stored within the user's browser (IndexedDB) and is used only to provide the functions of this extension.",
    privacyHeader2: "2. Data Transmission",
    privacyText2:
      "Collected data is never sent to external servers. This extension is designed (Local-Only) not to transmit data over the internet.",
    privacyHeader3: "3. Third-Party Measurement",
    privacyText3:
      "This extension and introduction website do not use any access analysis tools such as Google Analytics or advertising tracking.",
    privacyHeader4: "4. Data Deletion",
    privacyText4:
      "Users can delete all locally stored data by uninstalling the extension.",
    usageHeader1: "1. Automatic History Recording",
    usageText1:
      "When you display a JIRA (atlassian.net) issue page, the issue key and title are automatically saved as history.",
    usageHeader2: "2. Opening the Side Panel",
    usageText2:
      "Click the extension icon in the browser toolbar or select 'Issues-Solo' from the side panel to open the panel.",
    usageHeader3: "3. Checking History and Navigation",
    usageText3:
      "Clicking on a history entry in the side panel will switch to the corresponding JIRA issue tab or open it in a new tab.",
    usageHeader4: "4. Managing Editing Status (Work-in-Progress)",
    usageText4:
      "The 'Editing' status is detected when you are editing a JIRA comment field or description. This state is maintained even if you close or restart the browser and can be checked from the side panel.",
    top: "Top",
  },
  ja: {
    title:
      "Issues-Solo - JIRA閲覧履歴を記録するローカル完結型Chrome拡張機能",
    usage: "使い方",
    privacy: "プライバシーポリシー",
    tagline: "〜JIRA閲覧履歴を記録するローカル完結型Chrome拡張機能〜",
    cta: "Chrome ウェブストアで追加",
    projectOverview: "プロジェクト概要",
    overviewText:
      "Issues-Soloは、プライバシーを最優先に設計された、JIRA専用の閲覧履歴・編集状態管理ツールです。「どのタスクをいつ見たか」「どこまで書き込んだか」をブラウザ内に安全に記録し、あなたの作業の文脈復元をサポートします。",
    features: "特徴",
    featureJira: "JIRA特化",
    featureJiraText:
      "JIRAの課題キーとタイトルを自動抽出し、閲覧履歴としてリスト化します。",
    featureEditing: "編集中状態も記録",
    featureEditingText:
      "コメントが入力中かを検知し、保存。ブラウザを閉じても「書きかけ」の状態を把握できます。",
    featureLocal: "完全ローカル実行",
    featureLocalText:
      "すべてのデータはブラウザ内の IndexedDB に保存されます。外部サーバーへの送信は一切行われません。",
    featureM3: "Material 3 UI",
    featureM3Text:
      "Google Material 3 (M3) デザインを採用。サイドパネルで作業を邪魔せず快適に操作できます。",
    install: "インストール方法",
    installStep1: "Chrome ウェブストアにアクセスします。",
    installStep2: "「Chromeに追加」ボタンをクリックします。",
    installStep3:
      "拡張機能の固定をオンにすると、サイドパネルからいつでもアクセスしやすくなります。",
    copyright: "© 2026 Issues-Solo. All rights reserved.",
    privacyTitle: "プライバシーポリシー - Issues-Solo",
    usageTitle: "使い方 - Issues-Solo",
    backToHome: "ホームに戻る",
    privacyPolicy: "プライバシーポリシー",
    usageGuide: "使い方",
    langEn: "English",
    langJa: "日本語",
    privacyHeader1: "1. データの収集と利用",
    privacyText1:
      "Issues-Solo は、JIRAの課題キー、タイトル、および入力フォームの編集状態を収集します。これらのデータはすべて利用者のブラウザ内（IndexedDB）に保存され、本拡張機能の機能提供のためにのみ利用されます。",
    privacyHeader2: "2. データの送信",
    privacyText2:
      "収集されたデータが外部サーバーに送信されることは一切ありません。本拡張機能は、インターネット経由でのデータ送信を行わない設計（Local-Only）となっています。",
    privacyHeader3: "3. サードパーティによる計測",
    privacyText3:
      "本拡張機能および紹介用ウェブサイトでは、Google Analytics などのアクセス解析ツールや広告トラッキングなどは一切使用していません。",
    privacyHeader4: "4. データの削除",
    privacyText4:
      "利用者は、拡張機能をアンインストールすることで、ローカルに保存されたすべてのデータを削除することができます。",
    usageHeader1: "1. 履歴の自動記録",
    usageText1:
      "JIRAの課題ページを表示すると、自動的にその課題キーとタイトルが履歴として保存されます。",
    usageHeader2: "2. サイドパネルを開く",
    usageText2:
      "ブラウザのツールバーにある拡張機能アイコンをクリック、またはサイドパネルから「Issues-Solo」を選択してパネルを開きます。",
    usageHeader3: "3. 履歴の確認と移動",
    usageText3:
      "サイドパネルに表示された履歴リストをクリックすると、該当するJIRA課題のタブに切り替わるか、新しいタブで開きます。",
    usageHeader4: "4. 編集状態（書きかけ）の管理",
    usageText4:
      "JIRAのコメント欄や説明文を編集しているときに「編集中」の状態が検知されます。ブラウザを閉じたり再起動したりしても、その状態は保持され、サイドパネルから確認できます。",
    top: "トップ",
  },
};

function applyTranslations() {
  const userLang = navigator.language.startsWith("ja") ? "ja" : "en";
  const lang = localStorage.getItem("preferred-lang") || userLang;
  const t = translations[lang];

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = t[key];
      } else {
        el.textContent = t[key];
      }
    }
  });

  document.title = t.title || document.title;
  const titleEl = document.querySelector('meta[name="title"]');
  if (titleEl) titleEl.setAttribute("content", t.title);

  // Update language switcher active state if it exists
  document.querySelectorAll(".lang-switch").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();

  document.querySelectorAll(".lang-switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.setItem("preferred-lang", btn.dataset.lang);
      applyTranslations();
    });
  });
});
