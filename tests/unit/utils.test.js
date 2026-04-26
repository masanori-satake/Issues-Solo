import {
  normalizeHostInput,
  compareIssueKeys,
  getPriorityWeight,
  compareStatus,
} from "../../projects/app/utils.js";

describe("utils.js", () => {
    test("normalizeHostInput", () => {
        expect(normalizeHostInput("test.atlassian.net")).toEqual({
            storedUrl: "test.atlassian.net",
            permissionOrigin: "https://test.atlassian.net/*"
        });
        expect(normalizeHostInput("https://myjira.com/jira/browse/PROJ-1")).toEqual({
            storedUrl: "myjira.com/jira",
            permissionOrigin: "https://myjira.com/*"
        });
        expect(() => normalizeHostInput("")).toThrow("empty-host");
        expect(() => normalizeHostInput("http://unsafe.com")).toThrow("https-only");
    });

    test("compareIssueKeys (natural sort)", () => {
        const keys = ["PROJ-10", "PROJ-2", "PROJ-1", "OTHER-1"];
        keys.sort(compareIssueKeys);
        expect(keys).toEqual(["OTHER-1", "PROJ-1", "PROJ-2", "PROJ-10"]);
    });

    test("getPriorityWeight", () => {
        expect(getPriorityWeight("Highest")).toBe(0);
        expect(getPriorityWeight("最高")).toBe(0);
        expect(getPriorityWeight("Lowest")).toBe(4);
        expect(getPriorityWeight("Unknown")).toBe(99);
    });

    test("compareStatus", () => {
        const done = { status: "Done" };
        const todo = { status: "To Do" };
        const unknown = { status: "Unknown" };

        // Desc: Done(3) > To Do(1) > Unknown(0)
        expect(compareStatus(done, todo, "desc")).toBeLessThan(0);
        expect(compareStatus(todo, done, "desc")).toBeGreaterThan(0);

        // Asc: To Do(1) < Done(3) < Unknown(0)
        expect(compareStatus(todo, done, "asc")).toBeLessThan(0);
        expect(compareStatus(done, unknown, "asc")).toBeLessThan(0);
        expect(compareStatus(unknown, todo, "asc")).toBeGreaterThan(0);
    });
});
