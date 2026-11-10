"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "app/HomeTasksData.ts");
const js = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(js, sourcePath);

const {
  buildAdminWorkspaceTasks, buildAdminActiveWorkspaceTasks,
  buildAdminUnacceptedWorkspaceTasks, buildMyWorkspaceTasks
} = loaded.exports;

const task = (id, target, status, takenBy = null) => ({
  id, title: id, urgency: "current", created_by: "author",
  created_department: "analyst", target_department: target,
  assignee_id: takenBy, taken_by: takenBy, status,
  created_at: "2026-11-10T07:00:00Z", creator_name: "Автор",
  assignee_name: takenBy ? "Имя конкретного исполнителя" : null
});
const snapshot = {
  user_id: "admin1", department: "analyst", mode: "work", is_admin: true,
  tasks: [task("working", "analyst", "in_progress", "admin1")],
  admin_tasks: [
    task("admin-active", "admin", "in_progress", "admin2"),
    task("admin-pending", "admin", "not_started"),
    task("admin-done", "admin", "completed", "admin1")
  ],
  notes: []
};
const all = buildAdminWorkspaceTasks(snapshot);
assert.equal(all.length, 2, "badge should count accepted and pending admin tasks");
assert.deepEqual(all.map(x => x.action), ["finish", "take"]);
assert.ok(all.every(x => x.assignee === "Администраторы"));
assert.deepEqual(all.map(x => x.status), ["in_progress", "not_started"]);
assert.equal(buildAdminActiveWorkspaceTasks(snapshot).length, 1);
assert.equal(buildAdminUnacceptedWorkspaceTasks(snapshot).length, 1);
assert.equal(buildMyWorkspaceTasks(snapshot).length, 1);
assert.equal(buildMyWorkspaceTasks(snapshot)[0].id, "working");
assert.equal(buildAdminWorkspaceTasks({ ...snapshot, is_admin: false }).length, 0);
const right = fs.readFileSync(path.join(root, "app/HomeRightPanel.tsx"), "utf8");
assert.ok(right.includes("? adminAllTasks"), "work-mode Admin tab must use all admin tasks");
assert.ok(right.includes("tab.id === \"admin\" && adminTasksCount > 0"), "zero badge must disappear");
const board = fs.readFileSync(path.join(root, "app/tasks/TasksBoard.tsx"), "utf8");
assert.ok(board.includes('task.target_department === "admin" ? "Администраторы"'));
const css = fs.readFileSync(path.join(root, "app/tasks/tasks.css"), "utf8");
assert.match(css, /thead th:nth-child\(n\+6\):nth-child\(-n\+9\)/);
assert.match(css, /\.tasks-finish-button \{ background: #11865d/);
console.log("PASS Admin queue: mixed statuses, badge, anonymous department assignment, work separation and styles");
