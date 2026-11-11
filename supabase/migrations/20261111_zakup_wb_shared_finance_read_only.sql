-- Procurement-only change; finance, advertisers and existing historical rows untouched.
-- Verified daily WB financial operations are read directly, not copied to wb_sales.
CREATE OR REPLACE FUNCTION public.run_china_calculation_v9_preview()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_run_id uuid;

    v_date_from date;
    v_date_to date;

    v_own_date date;
    v_responsible_date date;
    v_ozon_date date;

    v_wb_snapshot_id uuid;
    v_wb_snapshot_at timestamptz;

    v_yandex_run_id uuid;
    v_yandex_date date;

    -- Source is the EXISTING completed WB daily finance report; no copy is made.
    v_wb_finance_run_day date;
    v_wb_finance_date_from date;
    v_wb_finance_date_to date;
    v_wb_finance_rows_saved integer;
BEGIN
    PERFORM pg_advisory_xact_lock(
        hashtext('china_calculation_v9_preview')
    );

    -- Use only the latest fully saved daily financial report from WB.
    SELECT j.run_day, j.date_from, j.date_to, j.rows_saved
    INTO v_wb_finance_run_day, v_wb_finance_date_from,
         v_wb_finance_date_to, v_wb_finance_rows_saved
    FROM public.wb_finance_cache_jobs j
    WHERE j.status = 'complete'
      AND j.rows_saved > 0
      AND j.completed_at >= now() - interval '48 hours'
    ORDER BY j.completed_at DESC, j.run_day DESC LIMIT 1;

    IF v_wb_finance_run_day IS NULL THEN
        RAISE EXCEPTION 'Закуп: нет завершённой ежедневной финансовой выгрузки WB за последние 48 часов';
    END IF;

    IF (SELECT count(*) FROM public.wb_finance_cache_lines l
        WHERE l.run_day = v_wb_finance_run_day) <> v_wb_finance_rows_saved
    THEN
        RAISE EXCEPTION 'Закуп: финансовый отчёт WB сохранён не полностью';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.wb_finance_cache_lines l
      WHERE l.run_day = v_wb_finance_run_day
        AND l.payload->>'docTypeName' IN ('Продажа', 'Возврат')
        AND l.payload->>'sellerOperName' IN ('Продажа', 'Возврат')
      GROUP BY l.payload->>'rrdId'
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'Закуп: в ежедневном финансовом отчёте WB повторяются идентификаторы операций';
    END IF;

    -- 1. Единый период продаж.
    SELECT r.date_from, r.date_to
    INTO v_date_from, v_date_to
    FROM public.ozon_sales_sync_runs r
    WHERE r.status = 'success'
      AND r.completed_days = 28
      AND r.date_to - r.date_from + 1 = 28
      AND r.date_to >= (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 4
      AND r.date_from >= v_wb_finance_date_from
      AND r.date_to <= v_wb_finance_date_to
      -- Exactly 28 distinct days of REAL FBW operations for this window.
      AND (
        SELECT count(DISTINCT (
          (l.payload->>'saleDt')::timestamptz AT TIME ZONE 'Europe/Moscow'
        )::date)
        FROM public.wb_finance_cache_lines l
        LEFT JOIN public.wb_orders o ON o.srid = l.payload->>'srid'
        WHERE l.run_day = v_wb_finance_run_day
          AND l.payload->>'docTypeName' IN ('Продажа', 'Возврат')
          AND l.payload->>'sellerOperName' IN ('Продажа', 'Возврат')
          AND (o.warehouse_type = 'Склад WB'
               OR (o.srid IS NULL AND l.payload->>'officeName' = 'Склад WB'))
          AND ((l.payload->>'saleDt')::timestamptz AT TIME ZONE 'Europe/Moscow')::date
              BETWEEN r.date_from AND r.date_to
      ) = 28
      AND EXISTS (
        SELECT 1 FROM public.yandex_sales_sync_runs y
        WHERE y.status='success'
          AND y.date_from=r.date_from AND y.date_to=r.date_to
          AND y.unmatched_order_items=0 AND y.unmatched_return_items=0
          
      )

    ORDER BY r.date_to DESC, r.created_at DESC
    LIMIT 1;

    IF v_date_from IS NULL THEN
        RAISE EXCEPTION
            'Нет общего полного 28-дневного периода Ozon, WB и Яндекс Маркета. Проверьте ежедневную выгрузку WB.';
    END IF;

    -- 2. Собственные склады и Ozon.
    SELECT max(snapshot_date)
    INTO v_own_date
    FROM public.own_stock_snapshots;

    SELECT max(snapshot_date)
    INTO v_responsible_date
    FROM public.responsible_storage_stock_snapshots;

    SELECT max(snapshot_date)
    INTO v_ozon_date
    FROM public.ozon_stock_snapshots;

    IF v_own_date IS NULL
       OR v_responsible_date IS NULL
       OR v_ozon_date IS NULL THEN
        RAISE EXCEPTION
            'Отсутствуют обязательные снимки складов';
    END IF;

    -- 3. Последний успешный snapshot WB.
    SELECT s.last_snapshot_id
    INTO v_wb_snapshot_id
    FROM public.wb_sync_state s
    WHERE s.sync_key = 'stocks'
      AND s.last_success_at IS NOT NULL
    LIMIT 1;

    IF v_wb_snapshot_id IS NULL THEN
        RAISE EXCEPTION
            'Нет успешного снимка остатков WB';
    END IF;

    SELECT max(snapshot_at)
    INTO v_wb_snapshot_at
    FROM public.wb_stock_product_snapshots
    WHERE snapshot_id = v_wb_snapshot_id;

    IF v_wb_snapshot_at IS NULL THEN
        RAISE EXCEPTION
            'Текущий снимок WB пуст';
    END IF;

    -- 4. Последний успешный снимок Яндекса.
    SELECT r.id, r.snapshot_date
    INTO v_yandex_run_id, v_yandex_date
    FROM public.yandex_stock_sync_runs r
    WHERE r.status = 'success'
      AND EXISTS (
          SELECT 1
          FROM public.yandex_stock_snapshots s
          WHERE s.sync_run_id = r.id
      )
    ORDER BY r.snapshot_date DESC, r.created_at DESC
    LIMIT 1;

    IF v_yandex_run_id IS NULL THEN
        RAISE EXCEPTION
            'Нет успешного снимка остатков Яндекса';
    END IF;

    -- 5. Проверка полноты источников.
    IF NOT EXISTS (
        SELECT 1
        FROM public.ozon_sales_daily
        WHERE sale_date BETWEEN v_date_from AND v_date_to
    ) THEN
        RAISE EXCEPTION
            'Нет продаж Ozon за период';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.wb_finance_cache_lines l
        LEFT JOIN public.wb_orders o ON o.srid = l.payload->>'srid'
        WHERE l.run_day = v_wb_finance_run_day
          AND l.payload->>'docTypeName' IN ('Продажа', 'Возврат')
          AND l.payload->>'sellerOperName' = 'Продажа'
          AND (o.warehouse_type = 'Склад WB'
               OR (o.srid IS NULL AND l.payload->>'officeName' = 'Склад WB'))
          AND ((l.payload->>'saleDt')::timestamptz AT TIME ZONE 'Europe/Moscow')::date
              BETWEEN v_date_from AND v_date_to
    ) THEN
        RAISE EXCEPTION 'Нет фактических продаж FBW в ежедневном отчёте за период';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.yandex_sales_daily
        WHERE sale_date BETWEEN v_date_from AND v_date_to
    ) THEN
        RAISE EXCEPTION
            'Нет продаж Яндекс Маркета за период';
    END IF;

    -- 6. Проверка полноты периода Яндекса.
    IF NOT EXISTS (
        SELECT 1
        FROM public.yandex_sales_daily
        WHERE sale_date BETWEEN
              v_date_to - 1 AND v_date_to
    ) THEN
        RAISE EXCEPTION
            'Продажи Яндекса не доходят до конца периода';
    END IF;


    -- Fail closed: source, stored row count, unique operation IDs, and all
    -- 28 days were verified above; never infer zero sales from a missing day.
    IF v_date_to < (now() AT TIME ZONE 'Asia/Krasnoyarsk')::date - 4 THEN
        RAISE EXCEPTION 'Закуп: общий подтверждённый период продаж старше четырёх суток';
    END IF;

    -- 7. Проверка master_code закупочных товаров.
    IF EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.is_active = true
          AND p.supply_origin = 'own_import'
          AND nullif(btrim(p.master_code), '') IS NULL
    ) THEN
        RAISE EXCEPTION
            'Активный own_import без master_code';
    END IF;

    IF EXISTS (
        SELECT btrim(p.master_code)
        FROM public.products p
        WHERE p.is_active = true
          AND p.supply_origin = 'own_import'
        GROUP BY btrim(p.master_code)
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Повторяющийся закупочный master_code';
    END IF;

    -- 8. Проверка дублирующихся активных карточек.
    IF EXISTS (
        SELECT 1
        FROM public.marketplace_listings l
        WHERE l.is_active = true
          AND l.account_key = 'main'
          AND lower(l.marketplace) IN (
              'ozon',
              'wildberries',
              'yandex_market'
          )
        GROUP BY
            lower(l.marketplace),
            btrim(l.external_id)
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Дубли активных marketplace_listings';
    END IF;

    -- 9. Защита от неизвестных складов Яндекса.
    -- 501: возвратный склад, не включаем.
    -- Остальные перечислены по результатам диагностики.
    IF EXISTS (
        SELECT 1
        FROM public.yandex_stock_snapshots s
        WHERE s.sync_run_id = v_yandex_run_id
          AND s.available > 0
          AND s.warehouse_id NOT IN (
              147, 172, 300, 301, 302,
              304, 305, 308, 313, 314, 501
          )
    ) THEN
        RAISE EXCEPTION
            'Новый склад Яндекса: проверьте схему FBY/FBS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.yandex_sales_daily s
        WHERE s.sale_date BETWEEN v_date_from AND v_date_to
          AND s.net_sales_quantity > 0
          AND s.warehouse_id NOT IN (
              147, 172, 300, 301, 302,
              304, 305, 308, 313, 314, 501
          )
    ) THEN
        RAISE EXCEPTION
            'Новый склад продаж Яндекса: требуется проверка';
    END IF;

    -- 10. Проверка дублированных строк WB snapshot.
    IF EXISTS (
        SELECT nm_id
        FROM public.wb_stock_product_snapshots
        WHERE snapshot_id = v_wb_snapshot_id
        GROUP BY nm_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Дубли nm_id в остатках WB';
    END IF;

    -- 11. Сохраняем запуск расчёта.
    INSERT INTO public.china_calculation_runs (
        mode,
        sales_window_days,
        container_lead_days,
        truck_lead_days,
        safety_buffer_days,
        container_order_point_days,
        truck_order_point_days,
        order_batch_days,
        container_capacity_m3,
        container_tolerance_m3,
        calculation_version,
        notes,
        sales_date_from,
        sales_date_to,
        own_stock_snapshot_date,
        responsible_storage_snapshot_date,
        ozon_stock_snapshot_date,
        wb_stock_snapshot_id,
        wb_stock_snapshot_at,
        yandex_stock_sync_run_id,
        yandex_stock_snapshot_date
    )
    VALUES (
        'simulation',
        28,
        90,
        60,
        10,
        100,
        70,
        60,
        68,
        0.50,
        'v9-preview',
        'Ozon FBO + WB FBW actual sales + Yandex FBY net sales. 60-day trigger, 100-day container, 70-day truck. Main and responsible storage summed. VED preserved.',
        v_date_from,
        v_date_to,
        v_own_date,
        v_responsible_date,
        v_ozon_date,
        v_wb_snapshot_id,
        v_wb_snapshot_at,
        v_yandex_run_id,
        v_yandex_date
    )
    RETURNING id INTO v_run_id;

    -- 12. Независимо агрегируем каждый источник.
    WITH

    product_master AS (
        SELECT
            p.id AS product_id,
            btrim(p.master_code) AS master_code
        FROM public.products p
        WHERE nullif(btrim(p.master_code), '') IS NOT NULL
    ),

    procurement_products AS (
        SELECT
            p.id AS product_id,
            btrim(p.master_code) AS master_code,
            p.units_per_carton,
            p.transport_carton_volume_m3
        FROM public.products p
        WHERE p.is_active = true
          AND p.supply_origin = 'own_import'
          AND nullif(btrim(p.master_code), '') IS NOT NULL
    ),

    eligible_listings AS (
        SELECT
            lower(l.marketplace) AS marketplace,
            btrim(l.external_id) AS external_id,
            btrim(l.master_code) AS master_code
        FROM public.marketplace_listings l
        JOIN procurement_products pp
          ON pp.master_code = btrim(l.master_code)
        WHERE l.account_key = 'main'
          AND l.is_active = true
          AND l.china_procurement_enabled = true
          AND nullif(btrim(l.external_id), '') IS NOT NULL
    ),

    -- OZON: продажи FBO.
    ozon_sales AS (
        SELECT
            e.master_code,
            sum(s.sales_quantity)::integer
                AS sales_quantity,
            sum(s.cancelled_quantity)::integer
                AS cancelled_quantity
        FROM public.ozon_sales_daily s
        JOIN public.products p
          ON p.id = s.product_id
         AND p.is_active = true
        JOIN eligible_listings e
          ON e.marketplace = 'ozon'
         AND e.external_id = btrim(p.offer_id)
         AND e.master_code = btrim(p.master_code)
        WHERE s.sale_date BETWEEN v_date_from AND v_date_to
        GROUP BY e.master_code
    ),

    -- WB FBW: direct read from the same daily finance report that is already
    -- stored for the financier. No procurement-specific copy in wb_sales.
    wb_sales_raw AS (
        SELECT
            e.master_code,
            count(*) FILTER (
                WHERE l.payload->>'sellerOperName' = 'Продажа'
            )::integer AS sales_quantity,
            count(*) FILTER (
                WHERE l.payload->>'sellerOperName' = 'Возврат'
            )::integer AS returns_quantity
        FROM public.wb_finance_cache_lines l
        LEFT JOIN public.wb_orders o
          ON o.srid = l.payload->>'srid'
        JOIN eligible_listings e
          ON e.marketplace = 'wildberries'
         AND e.external_id = l.payload->>'nmId'
        WHERE l.run_day = v_wb_finance_run_day
          AND l.payload->>'docTypeName' IN ('Продажа', 'Возврат')
          AND l.payload->>'sellerOperName' IN ('Продажа', 'Возврат')
          AND l.payload->>'rrdId' ~ '^[0-9]+$'
          AND l.payload->>'nmId' ~ '^[0-9]+$'
          AND (o.warehouse_type = 'Склад WB'
               OR (o.srid IS NULL AND l.payload->>'officeName' = 'Склад WB'))
          AND ((l.payload->>'saleDt')::timestamptz AT TIME ZONE 'Europe/Moscow')::date
              BETWEEN v_date_from AND v_date_to
        GROUP BY e.master_code
    ),

    wb_sales AS (
        SELECT
            master_code,
            greatest(
                sales_quantity - returns_quantity, 0
            ) AS sales_quantity,
            returns_quantity
        FROM wb_sales_raw
    ),

    -- Отмены WB: отдельно, в спрос не вычитаются.
    wb_cancelled AS (
        SELECT
            e.master_code,
            count(*)::integer AS cancelled_quantity
        FROM public.wb_orders o
        JOIN eligible_listings e
          ON e.marketplace = 'wildberries'
         AND e.external_id = o.nm_id::text
        WHERE o.warehouse_type = 'Склад WB'
          AND o.is_cancel = true
          AND (
              o.order_date AT TIME ZONE 'Europe/Moscow'
          )::date BETWEEN v_date_from AND v_date_to
        GROUP BY e.master_code
    ),

    -- YANDEX: чистые продажи FBY.
    yandex_sales AS (
        SELECT
            e.master_code,
            greatest(
                coalesce(sum(y.net_sales_quantity), 0),
                0
            )::integer AS sales_quantity,
            coalesce(
                sum(y.cancelled_quantity), 0
            )::integer AS cancelled_quantity
        FROM public.yandex_sales_daily y
        JOIN eligible_listings e
          ON e.marketplace = 'yandex_market'
         AND e.external_id = btrim(y.shop_sku)
         AND e.master_code = btrim(y.master_code)
        WHERE y.sale_date BETWEEN v_date_from AND v_date_to
          AND y.warehouse_id IN (
              147, 172, 300, 301, 302,
              304, 305, 308, 313, 314
          )
        GROUP BY e.master_code
    ),

    -- Склады компании.
    own_stock AS (
        SELECT
            pm.master_code,
            sum(s.quantity)::integer AS quantity
        FROM public.own_stock_snapshots s
        JOIN product_master pm
          ON pm.product_id = s.product_id
        WHERE s.snapshot_date = v_own_date
        GROUP BY pm.master_code
    ),

    responsible_storage AS (
        SELECT
            pm.master_code,
            sum(s.quantity)::integer AS quantity
        FROM public.responsible_storage_stock_snapshots s
        JOIN product_master pm
          ON pm.product_id = s.product_id
        WHERE s.snapshot_date = v_responsible_date
        GROUP BY pm.master_code
    ),

    -- Остатки Ozon.
    ozon_stock AS (
        SELECT
            e.master_code,
            sum(s.quantity)::integer AS quantity
        FROM public.ozon_stock_snapshots s
        JOIN public.products p
          ON p.id = s.product_id
         AND p.is_active = true
        JOIN eligible_listings e
          ON e.marketplace = 'ozon'
         AND e.external_id = btrim(p.offer_id)
         AND e.master_code = btrim(p.master_code)
        WHERE s.snapshot_date = v_ozon_date
        GROUP BY e.master_code
    ),

    -- Остатки Wildberries.
    wb_stock AS (
        SELECT
            e.master_code,
            sum(s.stock_count)::integer AS quantity
        FROM public.wb_stock_product_snapshots s
        JOIN eligible_listings e
          ON e.marketplace = 'wildberries'
         AND e.external_id = s.nm_id::text
        WHERE s.snapshot_id = v_wb_snapshot_id
        GROUP BY e.master_code
    ),

    -- Остатки Яндекс Маркета.
    yandex_stock AS (
        SELECT
            e.master_code,
            sum(s.available)::integer AS quantity
        FROM public.yandex_stock_snapshots s
        JOIN eligible_listings e
          ON e.marketplace = 'yandex_market'
         AND e.external_id = btrim(s.offer_id)
         AND e.master_code = btrim(s.master_code)
        WHERE s.sync_run_id = v_yandex_run_id
          AND s.warehouse_id IN (
              147, 172, 300, 301, 302,
              304, 305, 308, 313, 314
          )
        GROUP BY e.master_code
    ),

    -- ВЭД: заказанные количества отделены от физического склада.
    -- Импортированные внешние проформы с подтверждённым совпадением ЕНОТ
    -- резервируют потребность уже на этапе "В работе". Неопознанные позиции,
    -- черновики, отменённые и тестовые заказы не резервируют закуп.
    active_ved AS (
        SELECT
            pm.master_code,
            sum(
                CASE
                    WHEN o.workflow_status = 'ved_in_work'
                    THEN i.order_quantity
                    WHEN o.workflow_status = 'arrived'
                    THEN i.quantity
                    ELSE coalesce(nullif(i.order_quantity, 0), i.quantity)
                END
            )::integer AS quantity
        FROM public.ved_order_items i
        JOIN public.ved_orders o
          ON o.id = i.ved_order_id
        JOIN product_master pm
          ON pm.product_id = i.product_id
        WHERE i.status NOT IN ('rejected', 'cancelled')
          AND (
              (
                  o.workflow_status = 'ved_in_work'
                  AND o.created_by_name = 'Импорт внешних заказов'
                  AND i.order_quantity > 0
              )
              OR (
                  o.workflow_status IN ('production_confirmed', 'in_transit')
                  AND coalesce(nullif(i.order_quantity, 0), i.quantity) > 0
              )
              OR (
                  o.workflow_status = 'arrived'
                  AND i.quantity > 0
                  AND o.arrival_confirmed_at IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.own_stock_snapshots after_arrival
                      WHERE after_arrival.imported_at > o.arrival_confirmed_at
                        AND after_arrival.snapshot_date >= coalesce(
                            o.actual_arrival_date,
                            o.arrival_confirmed_at::date
                        )
                  )
              )
          )
        GROUP BY pm.master_code
    ),

    -- Одна строка на физический товар.
    base AS (
        SELECT
            pp.product_id,
            pp.master_code,
            pp.units_per_carton,
            pp.transport_carton_volume_m3,

            coalesce(os.sales_quantity, 0)::integer
                AS ozon_sales_28_days,
            coalesce(ws.sales_quantity, 0)::integer
                AS wb_sales_28_days,
            coalesce(ys.sales_quantity, 0)::integer
                AS yandex_sales_28_days,

            coalesce(os.cancelled_quantity, 0)::integer
                AS ozon_cancelled_28_days,
            coalesce(wc.cancelled_quantity, 0)::integer
                AS wb_cancelled_28_days,
            coalesce(ys.cancelled_quantity, 0)::integer
                AS yandex_cancelled_28_days,
            coalesce(ws.returns_quantity, 0)::integer
                AS wb_returns_28_days,

            coalesce(own.quantity, 0)::integer
                AS own_stock_quantity,
            coalesce(rs.quantity, 0)::integer
                AS responsible_storage_quantity,
            coalesce(oz.quantity, 0)::integer
                AS ozon_stock_quantity,
            coalesce(wbst.quantity, 0)::integer
                AS wb_stock_quantity,
            coalesce(yst.quantity, 0)::integer
                AS yandex_stock_quantity,
            coalesce(ved.quantity, 0)::integer
                AS active_ved_quantity,

            (own.master_code IS NOT NULL)
                AS own_stock_data_available,
            (own.master_code IS NULL)
                AS own_stock_assumed_zero,

            (
                pp.units_per_carton IS NOT NULL
                AND pp.units_per_carton > 0
                AND pp.transport_carton_volume_m3 IS NOT NULL
                AND pp.transport_carton_volume_m3 > 0
            ) AS packaging_data_ready

        FROM procurement_products pp
        LEFT JOIN ozon_sales os
          ON os.master_code = pp.master_code
        LEFT JOIN wb_sales ws
          ON ws.master_code = pp.master_code
        LEFT JOIN wb_cancelled wc
          ON wc.master_code = pp.master_code
        LEFT JOIN yandex_sales ys
          ON ys.master_code = pp.master_code
        LEFT JOIN own_stock own
          ON own.master_code = pp.master_code
        LEFT JOIN responsible_storage rs
          ON rs.master_code = pp.master_code
        LEFT JOIN ozon_stock oz
          ON oz.master_code = pp.master_code
        LEFT JOIN wb_stock wbst
          ON wbst.master_code = pp.master_code
        LEFT JOIN yandex_stock yst
          ON yst.master_code = pp.master_code
        LEFT JOIN active_ved ved
          ON ved.master_code = pp.master_code
    ),

    calculated AS (
        SELECT
            b.*,

            (
                b.ozon_sales_28_days
              + b.wb_sales_28_days
              + b.yandex_sales_28_days
            )::integer AS sales_28_days,

            (
                b.ozon_cancelled_28_days
              + b.wb_cancelled_28_days
              + b.yandex_cancelled_28_days
            )::integer AS cancelled_28_days,

            (
                b.own_stock_quantity
              + b.responsible_storage_quantity
            )::integer AS internal_stock_quantity,

            (
                b.own_stock_quantity
              + b.responsible_storage_quantity
              + b.ozon_stock_quantity
              + b.wb_stock_quantity
              + b.yandex_stock_quantity
            )::integer AS physical_stock,

            (
                b.own_stock_quantity
              + b.responsible_storage_quantity
              + b.ozon_stock_quantity
              + b.wb_stock_quantity
              + b.yandex_stock_quantity
              + b.active_ved_quantity
            )::integer AS effective_stock,

            (
                b.responsible_storage_quantity > 0
            ) AS has_responsible_storage

        FROM base b
    ),

    with_averages AS (
        SELECT
            c.*,
            round(
                c.sales_28_days::numeric / 28,
                6
            ) AS avg_sales_per_day
        FROM calculated c
    ),

    demand AS (
        SELECT
            a.*,

            CASE
                WHEN a.avg_sales_per_day > 0
                THEN round(
                    a.effective_stock::numeric
                    / a.avg_sales_per_day,
                    2
                )
                ELSE NULL
            END AS coverage_days,

            CASE
                WHEN a.avg_sales_per_day <= 0
                THEN false
                WHEN a.effective_stock::numeric <
                     a.avg_sales_per_day * 60
                THEN true
                ELSE false
            END AS needs_china_order,

            CASE
                WHEN a.avg_sales_per_day <= 0
                  OR a.effective_stock::numeric >=
                     a.avg_sales_per_day * 60
                THEN 0
                ELSE greatest(
                    round(
                        a.avg_sales_per_day * 100
                        - a.effective_stock
                    )::integer,
                    0
                )
            END AS container_order_units,

            CASE
                WHEN a.avg_sales_per_day <= 0
                  OR a.effective_stock::numeric >=
                     a.avg_sales_per_day * 60
                THEN 0
                ELSE greatest(
                    round(
                        a.avg_sales_per_day * 70
                        - a.effective_stock
                    )::integer,
                    0
                )
            END AS truck_order_units

        FROM with_averages a
    ),

    cartons AS (
        SELECT
            d.*,

            CASE
                WHEN NOT d.packaging_data_ready
                  OR d.container_order_units <= 0
                  OR d.container_order_units <
                     d.units_per_carton
                THEN 0
                ELSE round(
                    d.container_order_units::numeric
                    / d.units_per_carton
                )::integer
            END AS container_cartons,

            CASE
                WHEN NOT d.packaging_data_ready
                  OR d.truck_order_units <= 0
                  OR d.truck_order_units <
                     d.units_per_carton
                THEN 0
                ELSE round(
                    d.truck_order_units::numeric
                    / d.units_per_carton
                )::integer
            END AS truck_cartons

        FROM demand d
    ),

    final_calculation AS (
        SELECT
            c.*,

            (
                c.container_cartons
              * coalesce(c.units_per_carton, 0)
            )::integer AS container_final_units,

            round(
                c.container_cartons::numeric
              * coalesce(c.transport_carton_volume_m3, 0),
                6
            ) AS container_order_volume_m3,

            (
                c.truck_cartons
              * coalesce(c.units_per_carton, 0)
            )::integer AS truck_final_units,

            round(
                c.truck_cartons::numeric
              * coalesce(c.transport_carton_volume_m3, 0),
                6
            ) AS truck_order_volume_m3

        FROM cartons c
    )

    -- 13. Запись результатов.
    INSERT INTO public.china_calculation_items (
        calculation_run_id,
        product_id,

        sales_28_days,
        cancelled_28_days,
        avg_sales_per_day,

        ozon_sales_28_days,
        wb_sales_28_days,
        yandex_sales_28_days,

        ozon_cancelled_28_days,
        wb_cancelled_28_days,
        yandex_cancelled_28_days,
        wb_returns_28_days,

        own_stock_quantity,
        responsible_storage_quantity,
        ozon_stock_quantity,
        wb_stock_quantity,
        yandex_stock_quantity,

        internal_stock_quantity,
        physical_stock,
        active_ved_quantity,
        effective_stock,

        coverage_days,
        has_responsible_storage,

        own_stock_snapshot_date,
        responsible_storage_snapshot_date,
        ozon_stock_snapshot_date,

        own_stock_data_available,
        own_stock_assumed_zero,

        units_per_carton,
        transport_carton_volume_m3,
        packaging_data_ready,

        calculation_ready,
        transport_calculation_ready,
        calculation_block_reason,
        transport_block_reason,

        needs_china_order,

        calculated_order_units,
        carton_volume_m3,
        calculated_cartons,
        system_final_units,
        system_order_volume_m3,

        container_order_units,
        container_cartons,
        container_final_units,
        container_order_volume_m3,

        truck_order_units,
        truck_cartons,
        truck_final_units,
        truck_order_volume_m3
    )
    SELECT
        v_run_id,
        f.product_id,

        f.sales_28_days,
        f.cancelled_28_days,
        f.avg_sales_per_day,

        f.ozon_sales_28_days,
        f.wb_sales_28_days,
        f.yandex_sales_28_days,

        f.ozon_cancelled_28_days,
        f.wb_cancelled_28_days,
        f.yandex_cancelled_28_days,
        f.wb_returns_28_days,

        f.own_stock_quantity,
        f.responsible_storage_quantity,
        f.ozon_stock_quantity,
        f.wb_stock_quantity,
        f.yandex_stock_quantity,

        f.internal_stock_quantity,
        f.physical_stock,
        f.active_ved_quantity,
        f.effective_stock,

        f.coverage_days,
        f.has_responsible_storage,

        v_own_date,
        v_responsible_date,
        v_ozon_date,

        f.own_stock_data_available,
        f.own_stock_assumed_zero,

        f.units_per_carton,
        f.transport_carton_volume_m3,
        f.packaging_data_ready,

        true,
        f.packaging_data_ready,

        NULL,
        CASE
            WHEN NOT f.packaging_data_ready
            THEN 'Нет вложимости или объёма транспортной коробки'
            ELSE NULL
        END,

        f.needs_china_order,

        -- Старые поля: контейнер.
        f.container_order_units,
        f.transport_carton_volume_m3,
        f.container_cartons,
        f.container_final_units,
        f.container_order_volume_m3,

        -- Контейнер.
        f.container_order_units,
        f.container_cartons,
        f.container_final_units,
        f.container_order_volume_m3,

        -- Фура.
        f.truck_order_units,
        f.truck_cartons,
        f.truck_final_units,
        f.truck_order_volume_m3

    FROM final_calculation f;

    RETURN v_run_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.run_china_calculation_with_transport()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run_id uuid;
  v_simulation_id uuid;
BEGIN
  -- Prevent two simultaneous clicks creating competing "latest" calculations.
  PERFORM pg_advisory_xact_lock(hashtext('china_run_and_simulate'));

  -- No second copy of WB sales: v9 reads the completed daily finance cache directly.
  v_run_id := public.run_china_calculation();

  -- Passing the ID protects against a concurrent calculation for a different run.
  -- Keeping both calls in one transaction avoids an incomplete recalculation.
  v_simulation_id := public.simulate_china_transport(0::numeric, v_run_id);

  IF v_run_id IS NULL OR v_simulation_id IS NULL THEN
    RAISE EXCEPTION 'Не удалось завершить расчёт потребности и кубатуры';
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'calculation_run_id',v_run_id,
    'transport_simulation_id',v_simulation_id,
    'new_products_volume_m3',0
  );
END;
$function$;
