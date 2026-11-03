-- Предварительная юнит-экономика новых товаров из версий ВЭД.
-- Отдельная история, без ЕНОТ и без изменения существующих таблиц ВЭД.
-- Применить ДО публикации серверного кода; миграция идемпотентна.
CREATE TABLE IF NOT EXISTS public.unit_ved_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 article text NOT NULL UNIQUE CHECK (length(article) BETWEEN 1 AND 120),
 name text NOT NULL,
 source_type text NOT NULL CHECK (source_type IN ('single','whole')),
 source_version_id uuid NOT NULL,
 source_item_id uuid,
 ved_created_at timestamptz NOT NULL,
 input_data jsonb NOT NULL,
 result_data jsonb,
 cost_gross_rub numeric(20,8),
 purchase_vat_credit_rub numeric(20,8),
 volume_liters numeric(20,8),
 volume_source text,
 unit_weight_kg numeric(20,8) CHECK (unit_weight_kg IS NULL OR unit_weight_kg > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.unit_ved_settings (
 product_id uuid NOT NULL REFERENCES public.unit_ved_products(id) ON DELETE CASCADE,
 model text NOT NULL CHECK (model IN ('ozon-fbo','ozon-fbs','wb-fbw','wb-fbs','ym-fby','ym-fbs')),
 data jsonb NOT NULL DEFAULT '{}'::jsonb,
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid,
 PRIMARY KEY(product_id,model)
);
CREATE TABLE IF NOT EXISTS public.unit_ved_calculations (
 product_id uuid NOT NULL REFERENCES public.unit_ved_products(id) ON DELETE CASCADE,
 model text NOT NULL CHECK (model IN ('ozon-fbo','ozon-fbs','wb-fbw','wb-fbs','ym-fby','ym-fbs')),
 source_type text NOT NULL,
 source_version_id uuid NOT NULL,
 status text NOT NULL CHECK (status IN ('calculated','estimated','needs_input','invalid_ved')),
 missing text[] NOT NULL DEFAULT '{}',
 result_data jsonb NOT NULL,
 computed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(product_id,model)
);
CREATE TABLE IF NOT EXISTS public.unit_ved_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 product_id uuid NOT NULL REFERENCES public.unit_ved_products(id) ON DELETE CASCADE,
 model text NOT NULL CHECK (model IN ('ozon-fbo','ozon-fbs','wb-fbw','wb-fbs','ym-fby','ym-fbs')),
 source_type text NOT NULL,
 source_version_id uuid NOT NULL,
 settings_revision integer NOT NULL DEFAULT 1,
 status text NOT NULL,
 result_data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product_id,model,source_type,source_version_id,settings_revision)
);
CREATE TABLE IF NOT EXISTS public.unit_ved_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_type text NOT NULL CHECK (source_type IN ('single','whole')),
 source_version_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(source_type,source_version_id)
);
CREATE INDEX IF NOT EXISTS unit_ved_events_retry_idx ON public.unit_ved_events(status,created_at);
CREATE INDEX IF NOT EXISTS unit_ved_products_version_idx ON public.unit_ved_products(source_type,source_version_id);
CREATE INDEX IF NOT EXISTS unit_ved_history_product_idx ON public.unit_ved_history(product_id,created_at DESC);
ALTER TABLE public.unit_ved_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_ved_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_ved_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_ved_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_ved_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unit_ved_products,public.unit_ved_settings,public.unit_ved_calculations,public.unit_ved_history,public.unit_ved_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.unit_ved_products,public.unit_ved_settings,public.unit_ved_calculations,public.unit_ved_history,public.unit_ved_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.unit_ved_history_id_seq, public.unit_ved_events_id_seq TO service_role;

-- Обязательное событие в той же транзакции, что сохраняет версию ВЭД.
-- SECURITY INVOKER: функция не обходит права и RLS.
CREATE OR REPLACE FUNCTION public.unit_enqueue_ved_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 INSERT INTO public.unit_ved_events (source_type,source_version_id)
 VALUES (CASE WHEN TG_TABLE_NAME = 'ved_calculation_snapshots' THEN 'single' ELSE 'whole' END,NEW.id)
 ON CONFLICT (source_type,source_version_id) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.unit_enqueue_ved_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unit_enqueue_ved_event() TO service_role;
DROP TRIGGER IF EXISTS unit_ved_single_saved ON public.ved_calculation_snapshots;
CREATE TRIGGER unit_ved_single_saved AFTER INSERT ON public.ved_calculation_snapshots
 FOR EACH ROW EXECUTE FUNCTION public.unit_enqueue_ved_event();
DROP TRIGGER IF EXISTS unit_ved_whole_saved ON public.ved_offer_calculation_versions;
CREATE TRIGGER unit_ved_whole_saved AFTER INSERT ON public.ved_offer_calculation_versions
 FOR EACH ROW EXECUTE FUNCTION public.unit_enqueue_ved_event();

-- Существующие версии ВЭД также попадут в очередь после установки миграции.
INSERT INTO public.unit_ved_events(source_type,source_version_id)
 SELECT 'single',id FROM public.ved_calculation_snapshots
 ON CONFLICT (source_type,source_version_id) DO NOTHING;
INSERT INTO public.unit_ved_events(source_type,source_version_id)
 SELECT 'whole',id FROM public.ved_offer_calculation_versions
 ON CONFLICT (source_type,source_version_id) DO NOTHING;
