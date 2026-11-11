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
assert(cache.includes("status:audit.has(name)?'present':'not_provided'"));
console.log('PASS finance source freshness: Ozon Performance independent of Seller clock; YM fallback and all-category audit');
