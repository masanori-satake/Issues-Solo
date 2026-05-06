export const M3_COLORS = [
  "#0061A4", // Blue
  "#006D39", // Green
  "#695F00", // Yellow
  "#B3261E", // Red
  "#6750A4", // Purple
  "#006A60", // Teal
];

export const OTHER_COLOR = "#79747E"; // Material 3 Outline color

// 優先度のマッピングと色設定 (Material 3 パレット準拠)
export const PRIORITY_MAP = {
  Highest: { glyph: "↑↑", color: "#DE350B" }, // Jira Red
  High: { glyph: "↑", color: "#FF5630" }, // Jira Orange-Red
  Medium: { glyph: "•", color: "#FFAB00" }, // Jira Yellow/Orange
  Low: { glyph: "↓", color: "#0052CC" }, // Jira Blue
  Lowest: { glyph: "↓↓", color: "#00B8D9" }, // Jira Sky Blue
  最高: { glyph: "↑↑", color: "#DE350B" },
  高: { glyph: "↑", color: "#FF5630" },
  中: { glyph: "•", color: "#FFAB00" },
  低: { glyph: "↓", color: "#0052CC" },
  最低: { glyph: "↓↓", color: "#00B8D9" },
};

// ステータスの色設定
export const STATUS_COLOR_MAP = {
  // 未着手系 (Grey)
  "To Do": "#7A869A",
  未着手: "#7A869A",
  Open: "#7A869A",
  Reopened: "#7A869A",
  // 進行中系 (Blue)
  "In Progress": "#0052CC",
  進行中: "#0052CC",
  "In Review": "#0052CC",
  レビュー中: "#0052CC",
  // 完了系 (Green)
  Done: "#36B37E",
  完了: "#36B37E",
  Resolved: "#36B37E",
  解決済: "#36B37E",
  Closed: "#36B37E",
};

/**
 * 優先度の標準的な並び順（内部キー）
 * ソートの重み付けに使用します。
 */
export const PRIORITY_ORDER = ["Highest", "High", "Medium", "Low", "Lowest"];

/**
 * 優先度の標準的な並び順（日本語表示名）
 */
export const PRIORITY_ORDER_JA = ["最高", "高", "中", "低", "最低"];

/**
 * ステータスの重み付け定義
 * 数値が大きいほどソート順で上位（または完了に近い）とみなします。
 */
export const STATUS_ORDER_MAP = {
  // 完了系 (最高重み)
  Done: 3,
  完了: 3,
  Resolved: 3,
  解決済: 3,
  Closed: 3,
  // 進行中系
  "In Progress": 2,
  進行中: 2,
  "In Review": 2,
  レビュー中: 2,
  // 未着手系
  "To Do": 1,
  未着手: 1,
  Open: 1,
  Reopened: 1,
};

/**
 * ユーザー入力されたホスト情報を正規化します。
 * プロトコルの補完、不要なパス（/browse/ 等）の除去を行い、
 * 保存用のURL文字列と権限要求用のオリジンパターンを生成します。
 *
 * 背景：JiraのURLをブラウザからそのままコピーして貼り付けた場合でも
 * 正しく動作するように、柔軟なパースを行います。
 *
 * @param {string} rawValue 入力文字列
 * @returns {Object} { storedUrl, permissionOrigin }
 * @throws {Error} 空入力や非HTTPSプロトコルの場合にスロー
 */
export function normalizeHostInput(rawValue) {
  let candidate = rawValue.trim();
  if (!candidate) {
    throw new Error("empty-host");
  }

  if (!/^[a-z]+:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  const parsedUrl = new URL(candidate);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("https-only");
  }

  const pathMatch = parsedUrl.pathname.match(
    /^(.*?)\/(?:browse|issues)(?:\/|$)/,
  );
  const contextPath = pathMatch
    ? pathMatch[1]
    : parsedUrl.pathname.replace(/\/+$/, "");
  const normalizedPath = contextPath === "/" ? "" : contextPath;

  return {
    storedUrl: `${parsedUrl.hostname}${normalizedPath}`,
    permissionOrigin: `https://${parsedUrl.hostname}/*`,
  };
}

/**
 * 保存されたホストURLから許可オリジンを取得します。
 *
 * @param {string} hostUrl 保存されたホストURL
 * @returns {string|null} 許可オリジン、失敗時は null
 */
export function getPermissionOriginFromStoredHost(hostUrl) {
  try {
    const parsedUrl = new URL(`https://${hostUrl}`);
    return `https://${parsedUrl.hostname}/*`;
  } catch (error) {
    return null;
  }
}

/**
 * 指定されたオリジンが組み込みのホストパターンであるかを判定します。
 *
 * @param {string} origin 判定対象のオリジン
 * @returns {boolean}
 */
export function isBuiltinHostOrigin(origin) {
  return /^https:\/\/(?:[^/]+\.)?atlassian\.net\/\*$/.test(origin);
}

/**
 * JiraのURLから課題キーを抽出するための正規表現です。
 * 1. /browse/KEY-123 (標準的な個別課題表示)
 * 2. /issues/KEY-123 (リストビューや新UIでの表示)
 *
 * 正規表現の解説:
 * - \/(?:browse|issues)\/ : "browse" または "issues" というディレクトリ名にマッチ
 * - ([A-Z0-9]+-[0-9]+) : プロジェクトキー（英数字）+ ハイフン + 課題番号（数字）をキャプチャ
 */
export const ISSUE_KEY_REGEX = /\/(?:browse|issues)\/([A-Z0-9]+-[0-9]+)/;

/**
 * 指定されたURLから課題キー（例: KAN-1）を抽出します。
 * @param {string} urlString 抽出対象のURL文字列
 * @returns {string|null} 抽出された課題キー、見つからない場合は null
 */
export function extractIssueKeyFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(ISSUE_KEY_REGEX);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

/**
 * 課題キー（Issue Key）を自然な順序で比較します (例: PROJ-2 < PROJ-10)。
 *
 * 背景：単純な文字列比較では "PROJ-10" < "PROJ-2" となってしまいますが、
 * ユーザーにとって自然な、ハイフン以降の数値を考慮したソートを実現します。
 *
 * @param {string} a 課題キーA
 * @param {string} b 課題キーB
 * @returns {number} 比較結果
 */
export function compareIssueKeys(a, b) {
  const partsA = a.split("-");
  const partsB = b.split("-");
  if (partsA[0] !== partsB[0]) return partsA[0].localeCompare(partsB[0] || "");

  const numA = parseInt(partsA[1], 10);
  const numB = parseInt(partsB[1], 10);

  if (isNaN(numA) && isNaN(numB)) return 0;
  if (isNaN(numA)) return 1;
  if (isNaN(numB)) return -1;

  return numA - numB;
}

/**
 * 優先度（Priority）のソート用重みを取得します。
 *
 * @param {string} priority 優先度名
 * @returns {number} 重み（値が小さいほど高優先度）
 */
export function getPriorityWeight(priority) {
  let idx = PRIORITY_ORDER.indexOf(priority);
  if (idx === -1) idx = PRIORITY_ORDER_JA.indexOf(priority);
  return idx === -1 ? 99 : idx;
}

/**
 * ステータス（Status）のソート用重みを取得します。
 *
 * @param {string} status ステータス名
 * @returns {number} 重み
 */
export function getStatusWeight(status) {
  return STATUS_ORDER_MAP[status] || 0;
}

/**
 * 特定のURLが、設定されたJiraホスト（ドメインおよびコンテキストパス）に
 * 合致するかどうかを判定します。
 *
 * 背景：Cloud版（xxx.atlassian.net）だけでなく、
 * サブパス配下で運用されるData Center版（jira.example.com/jira）にも
 * 対応するためにパスの比較を含んでいます。
 *
 * @param {string} urlString 判定対象のURL文字列
 * @param {string} hostUrl 登録されているホスト設定のURL
 * @returns {boolean}
 */
export function isUrlMatchHost(urlString, hostUrl) {
  try {
    const url = new URL(urlString);
    const hostUrlLower = hostUrl.toLowerCase();
    const issueHostname = url.hostname.toLowerCase();
    const issuePathname = url.pathname.toLowerCase();

    if (hostUrlLower.includes("/")) {
      const [hostPart, ...pathParts] = hostUrlLower.split("/");
      const pathPart = "/" + pathParts.join("/");
      const isCorrectPath =
        issuePathname === pathPart || issuePathname.startsWith(pathPart + "/");
      return (
        (issueHostname === hostPart ||
          issueHostname.endsWith("." + hostPart)) &&
        isCorrectPath
      );
    }
    return (
      issueHostname === hostUrlLower ||
      issueHostname.endsWith("." + hostUrlLower)
    );
  } catch (e) {
    return false;
  }
}

/**
 * ステータスの比較
 */
export function compareStatus(a, b, direction) {
  const weightA = getStatusWeight(a.status);
  const weightB = getStatusWeight(b.status);

  if (direction === "desc") {
    return weightB - weightA;
  } else {
    if (weightA === 0 && weightB !== 0) return 1;
    if (weightA !== 0 && weightB === 0) return -1;
    return weightA - weightB;
  }
}
