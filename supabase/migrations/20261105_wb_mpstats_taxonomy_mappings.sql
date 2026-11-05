-- Map a verified WB commission category to an explicit MPStats taxonomy location.
-- One mapping serves every prospective product with that WB category/group.
CREATE TABLE IF NOT EXISTS public.unit_wb_mpstats_mappings (
 wb_category text NOT NULL,
 wb_group text NOT NULL,
 mpstats_scope text NOT NULL CHECK (mpstats_scope IN ('subject','category')),
 mpstats_path text NOT NULL,
 mpstats_label text NOT NULL,
 confirmed_by uuid NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (wb_category,wb_group),
 CONSTRAINT unit_wb_mpstats_category_not_blank CHECK (length(trim(wb_category))>0),
 CONSTRAINT unit_wb_mpstats_group_not_blank CHECK (length(trim(wb_group))>0),
 CONSTRAINT unit_wb_mpstats_path_not_blank CHECK (length(trim(mpstats_path))>0)
);
ALTER TABLE public.unit_wb_mpstats_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unit_wb_mpstats_mappings FROM anon,authenticated;
GRANT ALL ON public.unit_wb_mpstats_mappings TO service_role;
