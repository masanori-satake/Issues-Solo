import {
  compareIssueKeys,
  getPriorityWeight,
  compareStatus,
  PRIORITY_MAP,
  STATUS_COLOR_MAP,
  OTHER_COLOR,
} from "../utils.js";

/**
 * 課題リストの表示に関わるレンダリング処理を担当するクラスです。
 */
export class IssueRenderer {
  /**
   * @param {HTMLElement} listElement リストを表示するコンテナ要素
   * @param {Object} db IssuesDB インスタンス
   * @param {Function} onIssueClick 課題クリック時のコールバック
   */
  constructor(listElement, db, onIssueClick) {
    this.listElement = listElement;
    this.db = db;
    this.onIssueClick = onIssueClick;
  }

  /**
   * 課題リストをレンダリングします。
   * 保存されている課題を取得し、現在のソート設定に従って表示します。
   */
  async render() {
    const issues = await this.db.getAllIssues();
    const sortSettings = await this.db.getSortSettings();
    const settings = await this.db.getSettings();
    const projectSettings = await this.db.getProjectSettings();
    const otherCollapsed = await this.db.getOtherCollapsed();

    // ソートの適用
    issues.sort((a, b) => {
      const { type, direction } = sortSettings;
      if (type === "lastAccessed") {
        const result = (a.lastAccessed || 0) - (b.lastAccessed || 0);
        return direction === "desc" ? -result : result;
      }
      if (type === "issueKey") {
        const result = compareIssueKeys(a.issueKey, b.issueKey);
        return direction === "desc" ? -result : result;
      }
      if (type === "priority") {
        const result =
          getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
        return direction === "desc" ? -result : result;
      }
      if (type === "status") {
        return compareStatus(a, b, direction);
      }
      return 0;
    });

    if (issues.length === 0) {
      this.listElement.textContent = "";
      const noHistory = document.createElement("div");
      noHistory.className = "no-history";
      noHistory.textContent = chrome.i18n.getMessage("noHistory");
      this.listElement.appendChild(noHistory);
      return;
    }

    this.listElement.textContent = "";
    const visibleSettings = settings.filter((s) => s.visible);

    // ホストごとのグルーピング
    const hostGroups = visibleSettings
      .map((host) => {
        const hostIssues = issues.filter((issue) =>
          this._isIssueInHost(issue, host.url),
        );
        return { host, issues: hostIssues };
      })
      .filter((group) => group.issues.length > 0);

    const useAccordion = hostGroups.length > 1;

    hostGroups.forEach(({ host, issues: hostIssues }) => {
      if (useAccordion) {
        this.listElement.appendChild(this._createHostHeader(host, settings));
      }

      if (!useAccordion || !host.isCollapsed) {
        this._renderProjectGroups(hostIssues, projectSettings, otherCollapsed);
      }
    });
  }

  /**
   * URLが指定されたホスト設定に合致するか判定します。
   * @private
   */
  _isIssueInHost(issue, hostUrl) {
    try {
      const url = new URL(issue.url);
      const hostUrlLower = hostUrl.toLowerCase();
      const issueHostname = url.hostname.toLowerCase();
      const issuePathname = url.pathname.toLowerCase();

      if (hostUrlLower.includes("/")) {
        const [hostPart, ...pathParts] = hostUrlLower.split("/");
        const pathPart = "/" + pathParts.join("/");
        const isCorrectPath =
          issuePathname === pathPart ||
          issuePathname.startsWith(pathPart + "/");
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
   * ホストグループのヘッダーを作成します。
   * @private
   */
  _createHostHeader(host, allSettings) {
    const header = document.createElement("div");
    header.className = "host-group-header clickable";

    const glyph = document.createElement("span");
    glyph.className = "collapse-glyph";
    const isCollapsed = !!host.isCollapsed;

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.textContent = isCollapsed ? "arrow_right" : "arrow_drop_down";
    glyph.appendChild(icon);

    header.appendChild(glyph);
    header.addEventListener("click", async () => {
      host.isCollapsed = !host.isCollapsed;
      await this.db.setSettings(allSettings);
    });

    const name = document.createElement("span");
    name.textContent = host.name;
    header.appendChild(name);
    return header;
  }

  /**
   * プロジェクトごとのグルーピング表示を行います。
   * @private
   */
  _renderProjectGroups(hostIssues, projectSettings, otherCollapsed) {
    let remainingIssues = [...hostIssues];

    projectSettings.forEach((proj) => {
      const projIssues = remainingIssues.filter((i) => {
        const parts = i.issueKey.split("-");
        return parts.length > 1 && parts[0] === proj.key;
      });

      if (projIssues.length > 0) {
        remainingIssues = remainingIssues.filter(
          (i) => !projIssues.includes(i),
        );
        this.listElement.appendChild(
          this._createProjectHeader(proj, projectSettings),
        );
        if (!proj.isCollapsed) {
          projIssues.forEach((issue) => {
            this.listElement.appendChild(this._createIssueItem(issue));
          });
        }
      }
    });

    if (remainingIssues.length > 0) {
      this.listElement.appendChild(this._createOtherHeader(otherCollapsed));
      if (!otherCollapsed) {
        remainingIssues.forEach((issue) => {
          this.listElement.appendChild(this._createIssueItem(issue));
        });
      }
    }
  }

  /**
   * プロジェクトグループのヘッダーを作成します。
   * @private
   */
  _createProjectHeader(proj, allProjectSettings) {
    const projHeader = document.createElement("div");
    projHeader.className = "project-group-header";
    projHeader.style.backgroundColor = proj.color + "22";
    projHeader.style.color = proj.color;
    projHeader.style.borderLeft = `4px solid ${proj.color}`;

    const glyph = document.createElement("span");
    glyph.className = "collapse-glyph";
    const isCollapsed = !!proj.isCollapsed;

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.textContent = isCollapsed ? "arrow_right" : "arrow_drop_down";
    glyph.appendChild(icon);

    projHeader.appendChild(glyph);
    const name = document.createElement("span");
    name.textContent = proj.key;
    projHeader.appendChild(name);

    projHeader.addEventListener("click", async () => {
      proj.isCollapsed = !proj.isCollapsed;
      await this.db.setProjectSettings(allProjectSettings);
    });

    return projHeader;
  }

  /**
   * "その他"グループのヘッダーを作成します。
   * @private
   */
  _createOtherHeader(otherCollapsed) {
    const otherHeader = document.createElement("div");
    otherHeader.className = "project-group-header";
    otherHeader.style.backgroundColor = OTHER_COLOR + "22";
    otherHeader.style.color = OTHER_COLOR;
    otherHeader.style.borderLeft = `4px solid ${OTHER_COLOR}`;

    const glyph = document.createElement("span");
    glyph.className = "collapse-glyph";
    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.textContent = otherCollapsed ? "arrow_right" : "arrow_drop_down";
    glyph.appendChild(icon);

    otherHeader.appendChild(glyph);
    const name = document.createElement("span");
    name.textContent = chrome.i18n.getMessage("other") || "other";
    otherHeader.appendChild(name);

    otherHeader.addEventListener("click", async () => {
      await this.db.setOtherCollapsed(!otherCollapsed);
    });

    return otherHeader;
  }

  /**
   * 課題1件分のアイテム要素を作成します。
   * @private
   */
  _createIssueItem(issue) {
    const item = document.createElement("div");
    item.className = "issue-item";
    item.title = issue.title;

    const indicators = document.createElement("div");
    indicators.className = "status-indicators";

    const openIndicator = document.createElement("div");
    openIndicator.className = `indicator ${issue.isOpened ? "is-opened" : ""}`;
    openIndicator.title = issue.isOpened
      ? chrome.i18n.getMessage("tabOpened")
      : chrome.i18n.getMessage("tabClosed");

    indicators.appendChild(openIndicator);

    const content = document.createElement("div");
    content.className = "issue-content";

    const keySpan = document.createElement("span");
    keySpan.className = "issue-key";
    keySpan.textContent = issue.issueKey;

    const titleSpan = document.createElement("span");
    titleSpan.className = "issue-title";
    titleSpan.textContent = issue.title;

    content.appendChild(keySpan);
    content.appendChild(titleSpan);

    const glyphs = document.createElement("div");
    glyphs.className = "issue-glyphs";

    if (issue.status) {
      const sColor = STATUS_COLOR_MAP[issue.status] || "#7A869A";
      const sBadge = document.createElement("span");
      sBadge.className = "status-badge";
      sBadge.textContent = issue.status;
      sBadge.style.color = sColor;
      sBadge.style.backgroundColor = sColor + "15";
      sBadge.style.border = `1px solid ${sColor}44`;
      sBadge.title = chrome.i18n.getMessage("statusLabel", [issue.status]);
      glyphs.appendChild(sBadge);
    }

    if (issue.priority) {
      const pInfo = PRIORITY_MAP[issue.priority] || {
        glyph: "•",
        color: "#7A869A",
      };
      const pBadge = document.createElement("span");
      pBadge.className = "priority-badge";
      pBadge.textContent = pInfo.glyph;
      pBadge.style.color = pInfo.color;
      pBadge.style.backgroundColor = pInfo.color + "15";
      pBadge.style.border = `1px solid ${pInfo.color}44`;
      pBadge.title = chrome.i18n.getMessage("priorityLabel", [issue.priority]);
      glyphs.appendChild(pBadge);
    }

    item.appendChild(indicators);
    item.appendChild(content);
    item.appendChild(glyphs);

    item.addEventListener("click", () => {
      this.onIssueClick(issue);
    });

    return item;
  }
}
