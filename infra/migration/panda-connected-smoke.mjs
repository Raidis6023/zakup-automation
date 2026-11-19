/**
 * Fully isolated integration check: Panda Next.js web container talking
 * to the real self-hosted Auth/REST/Storage gateway on the private network.
 *
 * Only unauthenticated or intentionally invalid requests; no marketplace
 * import route is ever invoked with a valid cron/service token.
 */
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:3000";
async function request(path) {
  return fetch(origin+path,{
    method:"GET",redirect:"manual",signal:AbortSignal.timeout(20000),
    headers:{"Accept":"text/html, application/json"},
  });
}
async function checkRedirect(path) {
  const response=await request(path);
  assert.ok([301,302,303,307,308].includes(response.status),
    path+": expected redirect for unauthenticated user, got "+response.status);
  const target=new URL(response.headers.get("location")||"/",origin);
  assert.equal(target.origin,origin,"Unauthorized redirect to external host");
  assert.equal(target.pathname,"/login",path+": unauthorized user not sent to login");
  await response.body?.cancel();
}
const login=await request("/login");
assert.equal(login.status,200,"Panda login unavailable while connected to real Auth");
const html=await login.text();
assert.ok(html.includes("<html"),"Login did not render HTML");
console.log("PASS: Panda login rendered with a real private Supabase stack");

await checkRedirect("/");
await checkRedirect("/registry");
console.log("PASS: unauthenticated Panda dashboard and VED registry redirect to login");

const admin=await request("/api/admin/integrations");
assert.equal(admin.status,401,"Unauthenticated user could access marketplace key management");
const data=await admin.json();
assert.equal(data.ok,false);
console.log("PASS: admin marketplace key management denied to guests");

const integration=await request("/api/v1/1c/export?dataset=catalog");
assert.ok([401,403].includes(integration.status),"Unauthenticated user could open 1C export endpoint");
await integration.body?.cancel();
console.log("PASS: 1C integration endpoint denied without its secret");

const cron=await request("/api/ozon/daily-sync");
assert.ok([401,403].includes(cron.status),"Ozon daily cron route executed without its token");
await cron.body?.cancel();
console.log("PASS: daily Ozon scheduler route denied without cron secret");
console.log("PASS: Panda Next.js + official Supabase end-to-end access controls");
