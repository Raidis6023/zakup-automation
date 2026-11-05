-- Short name stays in unit_ved_products.name.
-- Supplier originals remain in ved_commercial_offer_items.description_original.
-- Manually edited names are preserved in unit_ved_products.overrides.
ALTER TABLE public.unit_ved_products
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.unit_ved_products.full_name IS
 'Readable full product name derived from supplier commercial proposal, unless manually overridden.';
COMMENT ON COLUMN public.unit_ved_products.attributes IS
 'Structured supplier characteristics, derived without guessing. Original remains in offer items.';
