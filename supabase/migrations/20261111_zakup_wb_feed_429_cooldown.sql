-- Procurement WB Order Feed rate-limit cooldown (WB Basic tokens: 1 request / 3 hours).
-- No changes to financiers, finance report tables or existing procurement results.
CREATE OR REPLACE FUNCTION public.china_defer_wb_feed_sync(
  p_wait_seconds integer,
  p_error text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seconds integer := greatest(70,least(10800,coalesce(p_wait_seconds,10800)));
BEGIN
  UPDATE public.china_wb_feed_control
  SET
    locked_until=greatest(
      coalesce(locked_until,now()),
      now()+make_interval(secs => v_seconds)
    ),
    last_error=left(coalesce(p_error,'WB 429'),300),
    updated_at=now()
  WHERE id=1;
END;
$function$;
REVOKE ALL ON FUNCTION public.china_defer_wb_feed_sync(integer,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.china_defer_wb_feed_sync(integer,text)
TO service_role;
