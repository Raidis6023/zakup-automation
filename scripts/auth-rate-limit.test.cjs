"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const moduleValue={exports:{}};
new Function("module","exports",ts.transpileModule(read("lib/supabase/auth-rate-limit.ts"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText)(moduleValue,moduleValue.exports);
const {isTemporaryAuthFailure}=moduleValue.exports;
test("429 and upstream Auth failures retain the user's session",()=>{
 for(const e of [{status:429},{status:503},{status:502},{status:504},
  {code:"over_request_rate_limit"},{code:"request_timeout"}])
  assert.equal(isTemporaryAuthFailure(e),true,JSON.stringify(e));
 for(const e of [null,undefined,{}, {status:401},{status:403},{code:"invalid_credentials"}])
  assert.equal(isTemporaryAuthFailure(e),false,JSON.stringify(e));
});
test("Proxy verifies signed claims, does not hit GoTrue on every request",()=>{
 const proxy=read("lib/supabase/proxy.ts");
 assert.match(proxy,/auth\.getClaims\(\)/);
 assert.doesNotMatch(proxy,/auth\s*\.getUser\(\)/);
 assert.ok(proxy.includes("isTemporaryAuthFailure"));
 assert.ok(proxy.includes("temporaryAuthUnavailable"));
 assert.ok(proxy.includes('"Retry-After": "30"'));
 const publicIndex=proxy.indexOf("if (noAuthNeeded)");
 const clientIndex=proxy.indexOf("createServerClient(");
 assert.ok(publicIndex>0&&clientIndex>publicIndex,"Public login must short-circuit before Auth client");
 assert.ok(proxy.includes('normalizedPathname === "/login"'));
 assert.ok(proxy.includes('normalizedPathname === "/api/registration/status"'));
 assert.ok(proxy.includes('app_get_my_block_status'));
 assert.ok(proxy.includes('app_get_must_change_password'));
 assert.ok(proxy.includes("claims?.sub"),"Signed claims must identify the current user");
});
test("Login page uses signed claims, and login form explains rate-limiting",()=>{
 const page=read("app/login/page.tsx"),form=read("app/login/LoginForm.tsx");
 assert.match(page,/auth\.getClaims\(\)/);
 assert.doesNotMatch(page,/auth\s*\.getUser\(\)/);
 assert.ok(form.includes('signInError.status === 429'));
 assert.ok(form.includes("Пароль менять не нужно"));
});
test("Common hot finance and units routes verify claims and enforce existing server roles",()=>{
 for(const file of [
  "lib/yandex/finance-access.ts",
  "app/api/home/sync-notifications/route.ts",
  "app/api/agents/ozon-finance/route.ts",
  "app/api/agents/wb-finance/route.ts",
  "app/api/unit-economics/prospective/route.ts",
  "lib/ved-calculation/server-access.ts"
 ]){
  const s=read(file);
  assert.match(s,/auth\.getClaims\(\)/,file);
  assert.doesNotMatch(s,/auth\.getUser\(\)/,file);
  assert.ok(s.includes("claims?.sub"),file);
 }
 for(const f of [
  "lib/yandex/finance-access.ts",
  "app/api/agents/ozon-finance/route.ts",
  "app/api/agents/wb-finance/route.ts",
  "app/api/unit-economics/prospective/route.ts",
  "lib/ved-calculation/server-access.ts"
 ])assert.ok(read(f).includes("app_user_access"),f+" must still check roles");
});
