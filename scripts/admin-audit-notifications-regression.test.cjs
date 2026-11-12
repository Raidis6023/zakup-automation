"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const get = file => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
const migration = get("supabase/migrations/20261112_audit_notifications_v1.sql");
const logs = get("app/admin/logs/LogsClient.tsx");
const page = get("app/admin/logs/page.tsx");
const notifications = get("app/SyncNotificationsClient.ts");
const header = get("app/HomeHeaderActions.tsx");
const sidebar = get("app/HomeRightPanel.tsx");
const sync = get("app/api/home/sync-notifications/route.ts");

for (const table of ["app_audit_events", "app_notifications"]) {
  assert.ok(migration.includes("create table if not exists public." + table), table);
  assert.ok(migration.includes("alter table public." + table + " enable row level security"), table + ": RLS");
  assert.ok(migration.includes("revoke all on public." + table + " from public, anon, authenticated"), table + ": protected");
}
for (const action of ["app_audit_feed", "app_notifications_snapshot", "app_notification_action"]) {
  assert.ok(migration.includes("function public." + action + "("), action);
}
assert.ok(migration.includes("v_admin_level not in ('admin','senior_admin')"), "Only admins may query history");
assert.ok(migration.includes("where id=p_id and recipient_id=auth.uid()"), "Notification state must be own-only");
assert.ok(migration.includes("unique(recipient_id,dedupe_key)"), "No duplicate user notifications");
assert.ok(migration.includes("app-personal-notes-v1"), "Reminders need a scheduled producer");
assert.ok(migration.includes("app_track_task"), "New task events need audit");
assert.ok(migration.includes("app_track_sync"), "Sync failures need audit");
assert.ok(migration.includes("app_track_user_access"), "Role changes need audit");
assert.ok(!migration.includes("n.title,'/tasks'"), "Private note titles must not enter notifications");
assert.ok(page.includes("<LogsClient />"), "Logs page must render real feed");
assert.ok(logs.includes('rpc("app_audit_feed"'), "Log data must be server filtered");
assert.ok(logs.includes("PAGE_SIZE = 40"), "Logs must be paginated");
assert.ok(logs.includes("Asia/Krasnoyarsk"), "Log timestamps use workspace timezone");
assert.ok(logs.includes("Данные и расчёты"), "Historical business log group present");
assert.ok(notifications.includes('rpc("app_notifications_snapshot"'), "The header/panel share server inbox");
assert.ok(notifications.includes('rpc("app_notification_action"'), "Server backs read and dismissal");
assert.ok(notifications.includes('id: "server:" + row.id'), "Source scoped notification IDs");
assert.ok(header.includes("markSyncNotificationRead(notification.id)"), "Bell must mark opened notices");
assert.ok(sidebar.includes("markSyncNotificationRead(notification.id)"), "Sidebar must mark opened notices");
assert.ok(header.includes("notification.unread !== false"), "Bell counts unread server notifications");
assert.ok(!sync.includes("test-stock-zero:"), "Fake stock notifications removed");
console.log("PASS Admin audit and notifications: RLS, log feed, dedup, reminders, shared inbox and no fake alerts");
