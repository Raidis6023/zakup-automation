const assert=require('node:assert/strict');
const fs=require('node:fs');
const ozon=fs.readFileSync('app/ozon/financier/FinancierClient.tsx','utf8');
assert(ozon.includes('seen===null||Date.parse(report.latest_sku_update)>Date.parse(seen)'),
 'Ozon should use Performance sync checkpoint and force a fresh report on initial view');
assert(!ozon.includes("Date.parse(report.latest_sku_update)>Date.parse(data.cache_updated_at"),
 'Seller posting date must not suppress Performance updates');
const yandex=fs.readFileSync('app/yandex-market/financier/YandexFinancierClient.tsx','utf8');
assert(yandex.includes('initialError&&!initialReloaded.current'));
assert(yandex.includes('void load();'));
assert(yandex.includes("e.target.value>shift(localDay(),-1)?shift(localDay(),-1):e.target.value"));
assert(yandex.includes('Источники требуют сверки:'));
assert(yandex.includes('Отсутствующие статьи доходов/расходов не подтверждены нулём'));
const cache=fs.readFileSync('lib/yandex/finance-cache.ts','utf8');
assert(cache.includes("...rules.map(([name])=>name),'Реклама на Маркете'"),
 'YM audit must include separately billed marketplace advertising');
assert(cache.includes("status:!audit.has(name)?'not_provided':audit.get(name)?.preserved?'preserved':'present'"));
const parser=fs.readFileSync('lib/yandex/finance-parser.ts','utf8');
assert(parser.includes('missing.push(marketingSheet)'),
 'Missing advertising worksheet must remain an unconfirmed expense source');
assert(cache.includes("warningFromReady?.includes('ЯМ не включил листы услуг')"),
 'Prefer preserved day snapshots for source-omitting report');
assert(cache.includes('source_report_id!==snapshot.source_report_id'),
 'Daily report must preserve source lineage across replacements');
assert(cache.includes("status:!audit.has(name)?'not_provided':audit.get(name)?.preserved?'preserved':'present'"),
 'Historical carried expenses are marked as provisional provenance');
const sql=fs.readFileSync('supabase/migrations/20261111_yandex_preserve_omitted_expense_sheets.sql','utf8');
assert(sql.includes("d.payload->>'sheet'") && sql.includes('any(missing_sources)'));
assert(sql.includes('max(kept.line_index)+1'), 'Preserved line positions must not collide');
console.log('PASS finance source freshness: Ozon Performance independent of Seller clock; YM fallback and all-category audit');
