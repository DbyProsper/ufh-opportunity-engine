-- =========================================================
-- SIGNATURES
-- =========================================================
CREATE TABLE public.signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  application_id uuid,
  offer_id uuid,
  context text NOT NULL DEFAULT 'general', -- 'personal_info' | 'acceptance' | 'affidavit' | 'offer' | 'general'
  method text NOT NULL,                    -- 'draw' | 'type' | 'upload'
  typed_name text,
  file_path text NOT NULL,                 -- in 'signatures' bucket
  file_name text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own signatures"
ON public.signatures FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all signatures"
ON public.signatures FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_signatures_user ON public.signatures(user_id);
CREATE INDEX idx_signatures_app ON public.signatures(application_id);

-- =========================================================
-- AFFIDAVIT SUBMISSIONS
-- =========================================================
CREATE TABLE public.affidavit_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | generated | uploaded | verified | rejected
  generated_path text,
  generated_at timestamptz,
  uploaded_path text,
  uploaded_file_name text,
  uploaded_at timestamptz,
  verified_by uuid,
  verified_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affidavit_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own affidavits"
ON public.affidavit_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users manage own affidavits"
ON public.affidavit_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own affidavits"
ON public.affidavit_submissions FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending','generated','uploaded','rejected'));

CREATE POLICY "Admins view all affidavits"
ON public.affidavit_submissions FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update affidavits"
ON public.affidavit_submissions FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_affidavit_updated
BEFORE UPDATE ON public.affidavit_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_affidavit_app ON public.affidavit_submissions(application_id);

-- Notify on affidavit status changes
CREATE OR REPLACE FUNCTION public.notify_affidavit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'uploaded' THEN
      INSERT INTO public.notifications(user_id, title, body, type, link)
      SELECT ur.user_id, 'Affidavit awaiting verification',
             'A signed/stamped affidavit was uploaded and needs review.',
             'info', '/admin'
      FROM public.user_roles ur WHERE ur.role = 'admin';
    ELSIF NEW.status = 'verified' THEN
      INSERT INTO public.notifications(user_id, title, body, type, link)
      VALUES (NEW.user_id, 'Affidavit verified',
              'Your affidavit has been verified. Thank you.',
              'success', '/dashboard');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications(user_id, title, body, type, link)
      VALUES (NEW.user_id, 'Affidavit rejected',
              COALESCE(NEW.admin_notes, 'Please re-upload a corrected, signed and stamped affidavit.'),
              'error', '/dashboard');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_affidavit_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_affidavit_notify
AFTER UPDATE ON public.affidavit_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_affidavit_change();

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('affidavits', 'affidavits', false)
ON CONFLICT (id) DO NOTHING;

-- Signatures bucket policies (path: <user_id>/...)
CREATE POLICY "Users read own signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own signatures"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own signatures"
ON storage.objects FOR DELETE
USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures' AND public.is_admin(auth.uid()));

-- Affidavits bucket policies (path: <user_id>/<application_id>/...)
CREATE POLICY "Users read own affidavits"
ON storage.objects FOR SELECT
USING (bucket_id = 'affidavits' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own affidavits"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'affidavits' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own affidavits"
ON storage.objects FOR UPDATE
USING (bucket_id = 'affidavits' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read affidavits"
ON storage.objects FOR SELECT
USING (bucket_id = 'affidavits' AND public.is_admin(auth.uid()));