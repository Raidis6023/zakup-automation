# Детализация РК финансиста Ozon

Источник — существующая авторизованная загрузка Ozon Performance: POST `/api/client/statistics` с campaigns, dateFrom/dateTo и groupBy DATE; GET `/api/client/statistics/{UUID}`; GET `/api/client/statistics/report?UUID=...`. Официальный справочник: https://docs.ozon.ru/api/performance/#tag/Statistics . Рекламные кампании не изменяются. Статистика — аналитическая детализация, а не дополнительное списание в прибыли.

Расширен закрытый дневной кэш по account/day/SKU/campaign. Из CSV сохраняются исходные расход, показы, клики, корзины, заказы и выручка рекламных заказов. Цена каталога и общая выручка Seller вместо рекламной выручки не подставляются. Заказы модели отдельно не прибавляются к прямым заказам SKU.

Восемь метрик из файла пользователя: ДРР = расход / рекламная выручка; CTR = клики / показы; CPM = расход / показы × 1000; CPO = расход / заказы; показы, клики, корзины и заказы — суммы. Проценты и удельные затраты за период пересчитываются из сумм, а не усредняются по дням. При нулевом знаменателе и отсутствующих полях — неизвестно.

Парсер сохраняет активность с нулевым расходом, проверяет целые количества, дату и границы периода; отчёт без дня разбивается существующим обработчиком на дневные задания. Пропущенные столбцы не становятся нулями. Пустые даты на графике не соединяются линией. Подтверждённый ноль показывается только после полного покрытия отчётами.

Восстановление метрик использует старые UUID завершённых отчётов. При 404 просроченный отчёт ставится на повторную генерацию. Старые суммы расходов остаются доступны во время загрузки. Фоновая обработка использует существующий общий lock и cooldown. Открытие артикула читает только базу; кнопка загрузки добавляет задания, а не блокирует страницу запросами Ozon. Метрики готовности отделены от финансового покрытия.

В раскрытии артикула: редактирование датированных тарифов и КМ, таблица РК, переключатель кампании, восемь SVG-графиков с наведением и клавиатурным выбором дня, исходная дневная таблица. Период берётся из применённого финансового отчёта. Данные Excel использованы как образец состава показателей, а не как реальные значения.

Проверки: `tsc lib/ozon/campaign-metrics.ts lib/finance-totals.ts --outDir .campaign-build --rootDir lib --module commonjs --target es2020 --skipLibCheck`, затем `node scripts/finance-campaign-tests.cjs`.

Проверены фактические заголовки дневного отчёта Ozon: «Продано товаров» — количество проданных через рекламу единиц для графика «Заказы»; «Продажи в продвижении, ₽» — рекламная выручка. Это количество товаров, а не уникальных номеров заказов. Заголовки сохраняются в закрытом кэше заданий для сверки.


## October 27: consistent totals, CPC and chart controls
The campaign summary and plots both use available daily observations. Missing days do not nullify known period totals and are not converted into zero activity. The progress notice identifies incomplete periods. CPC is sum(expense)/sum(clicks), with null for missing/zero clicks; it replaces CPO in the eight displayed metrics. Money display rounds only at rendering. Charts use a warm multicolor line, point tooltips, an automatic Y domain and an optional zero baseline; missing observations disconnect paths. Expanded layouts use the financial scroll container width.

## Yandex Market promotion
Official methods: POST /v2/reports/boost-consolidated/generate, POST /v2/reports/shows-boost/generate (attributionType CLICKS), GET /v2/reports/info/{reportId}. Request one FILE report per day and promotion type to obtain daily product metrics. The boost sales report uses ONLY WITH_FEE source columns (paid promotion), billedAmount and ordersGvmDeliveredWithFee. Shows boost uses cost (calculated attributed spend), NOT campaign realCost, which cannot be allocated to offers. The statistics do not add an extra expense to finance profit.
Both product reports list multiple campaign IDs but do not allocate their SKU metrics between those IDs. UI therefore exposes sales boost and shows boost as separate combined campaign groups, without a combined default that would double count overlapping attribution. It does not manufacture per-campaign SKU metrics. The sales report revenue is delivered boosted revenue; shows boost revenue is ordered attributed revenue, as documented by Yandex.
Queue via authenticated /api/agents/yandex-finance-campaigns POST; cache via GET. Cron /api/agents/yandex-finance-campaigns-cron advances the shared queue every two minutes, with a global lease, 125-second generation cooldown, one in-flight report and priority for existing finance report loading. Errors are exposed to the UI; failed jobs can be retried using the load button. Storage is service-role only with RLS and no anon/authenticated grants. No campaigns, bids or advertising settings are modified.
Sources:
https://yandex.ru/dev/market/partner-api/doc/ru/reference/reports/generateBoostConsolidatedReport
https://yandex.ru/dev/market/partner-api/doc/ru/reference/reports/generateShowsBoostReport
