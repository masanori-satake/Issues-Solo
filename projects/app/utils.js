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

export const PRIORITY_ORDER = ["Highest", "High", "Medium", "Low", "Lowest"];
export const PRIORITY_ORDER_JA = ["最高", "高", "中", "低", "最低"];

export const STATUS_ORDER_MAP = {
  // 完了系 (最高)
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
 * ホスト入力の正規化
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
 * 自然な順序でのIssue Keyソート (PROJ-2 < PROJ-10)
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
 * 優先度の重み取得
 */
export function getPriorityWeight(priority) {
  let idx = PRIORITY_ORDER.indexOf(priority);
  if (idx === -1) idx = PRIORITY_ORDER_JA.indexOf(priority);
  return idx === -1 ? 99 : idx;
}

/**
 * ステータスの重み取得
 */
export function getStatusWeight(status) {
  return STATUS_ORDER_MAP[status] || 0;
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
