
CREATE OR REPLACE FUNCTION public.withdraw_application(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.applications WHERE id = _id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not your application';
  END IF;
  UPDATE public.applications
     SET status = 'withdrawn'::application_status,
         is_editable = false
   WHERE id = _id
     AND status NOT IN ('approved'::application_status, 'rejected'::application_status, 'withdrawn'::application_status);
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_application(uuid) TO authenticated;
