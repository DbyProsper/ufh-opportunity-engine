
-- Bulletin extraction runs (audit log of who uploaded what and what drafts were created)
CREATE TABLE public.bulletin_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploader_email text,
  file_name text NOT NULL,
  file_hash text NOT NULL,
  opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  drafts_created jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bulletin_runs TO authenticated;
GRANT ALL ON public.bulletin_runs TO service_role;
ALTER TABLE public.bulletin_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bulletin runs" ON public.bulletin_runs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins write bulletin runs" ON public.bulletin_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update bulletin runs" ON public.bulletin_runs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- External application click tracking
CREATE TABLE public.external_application_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  external_opportunity_id uuid REFERENCES public.external_opportunities(id) ON DELETE CASCADE,
  external_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.external_application_clicks TO authenticated;
GRANT ALL ON public.external_application_clicks TO service_role;
ALTER TABLE public.external_application_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own clicks" ON public.external_application_clicks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users see own clicks" ON public.external_application_clicks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all clicks" ON public.external_application_clicks FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Profile additions for richer eligibility
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS highest_qualification_completed text,
  ADD COLUMN IF NOT EXISTS current_qualification text;

-- Tighten withdraw_application: only allow when status='submitted'
CREATE OR REPLACE FUNCTION public.withdraw_application(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.applications WHERE id = _id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not your application';
  END IF;
  UPDATE public.applications
     SET status = 'withdrawn'::application_status,
         is_editable = false
   WHERE id = _id
     AND status = 'submitted'::application_status;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only submitted applications can be withdrawn. Once under review, please contact the reviewer.';
  END IF;
END;
$function$;
