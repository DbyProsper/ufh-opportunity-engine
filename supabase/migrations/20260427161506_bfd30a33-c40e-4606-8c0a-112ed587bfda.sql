-- 1) Profile fields for CV storage and parsed text
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_path text,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS cv_text text;

-- 2) Profile documents library (auto-built from past application uploads)
CREATE TABLE IF NOT EXISTS public.profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,            -- e.g. "Transcript", "ID Document"
  file_name text NOT NULL,
  file_path text NOT NULL,        -- in application-documents bucket
  source_application_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile docs"
  ON public.profile_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all profile docs"
  ON public.profile_documents FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users manage own profile docs"
  ON public.profile_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Storage bucket for CVs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-cvs', 'user-cvs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own CV"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own CV"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own CV"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own CV"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read CVs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-cvs' AND public.is_admin(auth.uid()));

-- 4) Improved message notification trigger: notify ALL admins on applicant -> admin direction
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_app_user uuid;
  v_workflow_name text;
BEGIN
  UPDATE public.message_threads
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;

  SELECT a.user_id, w.name
  INTO v_app_user, v_workflow_name
  FROM public.message_threads t
  JOIN public.applications a ON a.id = t.application_id
  JOIN public.workflows w ON w.id = a.workflow_id
  WHERE t.id = NEW.thread_id;

  IF NEW.sender_id = v_app_user THEN
    -- Applicant sent → notify all admins
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT ur.user_id,
           'New applicant message',
           'New message on a ' || COALESCE(v_workflow_name, 'application') || ' thread.',
           'info',
           '/admin'
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  ELSE
    -- Reviewer sent → notify the applicant
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      v_app_user,
      'New message from reviewer',
      'You have a new message about your ' || COALESCE(v_workflow_name, 'application') || '.',
      'info',
      '/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Re-attach trigger if missing
DROP TRIGGER IF EXISTS trg_new_message ON public.messages;
CREATE TRIGGER trg_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();