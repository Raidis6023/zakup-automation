-- New China drafts must not infer FOB/FCA from truck/container transport.
-- VED enters Incoterms only after accepting the order.
DO $patch$
DECLARE v_source text;v_patched text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO v_source
 FROM pg_proc WHERE proname='create_ved_order_draft_original_20261015'
 AND pronamespace='public'::regnamespace;
 IF v_source IS NULL THEN RAISE EXCEPTION 'Original draft creator missing'; END IF;
 v_patched:=regexp_replace(
  v_source,
  'case[[:space:]]+when[[:space:]]+p_scenario[[:space:]]*=[[:space:]]*''container''[[:space:]]+then[[:space:]]*''FOB''[[:space:]]+else[[:space:]]*''FCA''[[:space:]]+end',
  'null::text',
  'i'
 );
 IF v_patched=v_source THEN RAISE EXCEPTION 'Incoterm auto-fill expression not found'; END IF;
 EXECUTE v_patched;
END
$patch$;