CREATE OR REPLACE FUNCTION private.hold_new_omnex_code_delivery()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
  IF NEW.fields='{}'::jsonb AND NEW.state='queued' AND NEW.attempts=0
     AND NEW.remote_order_id IS NULL THEN
    NEW.next_attempt_at:=greatest(NEW.next_attempt_at,clock_timestamp()+interval '60 seconds');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.hold_new_omnex_code_delivery() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER hold_new_omnex_code_delivery
BEFORE INSERT ON private.omnex_jobs
FOR EACH ROW EXECUTE FUNCTION private.hold_new_omnex_code_delivery();
