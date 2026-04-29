-- 1. Extend application_status enum
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- 2. Extend offer_status enum
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'template_sent';
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'signed_uploaded';
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'revision_requested';
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'rejected';

-- 3. applications: rejection reason + ensure reviewer column usable as assigned reviewer
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Trigger: require rejection_reason whenever status is rejected or changes_requested
CREATE OR REPLACE FUNCTION public.require_rejection_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('rejected','changes_requested')
     AND (NEW.rejection_reason IS NULL OR length(trim(NEW.rejection_reason)) = 0) THEN
    RAISE EXCEPTION 'A reason is required when rejecting or requesting changes on an application';
  END IF;
  -- Re-open editing automatically on changes_requested
  IF NEW.status = 'changes_requested' THEN
    NEW.is_editable = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_rejection_reason ON public.applications;
CREATE TRIGGER trg_require_rejection_reason
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.require_rejection_reason();

-- 4. workflow_offer_templates (admin-curated reusable templates)
CREATE TABLE IF NOT EXISTS public.workflow_offer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_offer_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage offer templates"
  ON public.workflow_offer_templates FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Anyone reads offer templates"
  ON public.workflow_offer_templates FOR SELECT
  USING (true);

-- 5. Extend offers: template path, current version, rejection reason
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS template_path text,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid;

-- offers RLS already lets applicants view & respond. Add an UPDATE policy for applicants on their own offer (so they can mark signed_uploaded). Already covered by "Users respond to own offers".

-- 6. offer_documents (multi-version round-trip log)
CREATE TABLE IF NOT EXISTS public.offer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('template','signed')),
  version integer NOT NULL DEFAULT 1,
  file_path text NOT NULL,
  file_name text NOT NULL,
  notes text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_documents_offer ON public.offer_documents(offer_id);

ALTER TABLE public.offer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage offer docs"
  ON public.offer_documents FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Applicants view own offer docs"
  ON public.offer_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    JOIN public.applications a ON a.id = o.application_id
    WHERE o.id = offer_documents.offer_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Applicants upload own signed docs"
  ON public.offer_documents FOR INSERT
  WITH CHECK (
    kind = 'signed'
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.offers o
      JOIN public.applications a ON a.id = o.application_id
      WHERE o.id = offer_documents.offer_id AND a.user_id = auth.uid()
    )
  );

-- 7. Storage buckets
INSERT INTO storage.buckets (id, name, public)
  VALUES ('offer-templates', 'offer-templates', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('offer-signed', 'offer-signed', false)
  ON CONFLICT (id) DO NOTHING;

-- offer-templates: admins read/write; applicants read only their own offer template
CREATE POLICY "Admins manage offer-templates bucket"
  ON storage.objects FOR ALL
  USING (bucket_id = 'offer-templates' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'offer-templates' AND public.is_admin(auth.uid()));

CREATE POLICY "Applicants read templates linked to their offers"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'offer-templates'
    AND EXISTS (
      SELECT 1 FROM public.offers o
      JOIN public.applications a ON a.id = o.application_id
      WHERE a.user_id = auth.uid()
      AND (o.template_path = storage.objects.name
           OR EXISTS (SELECT 1 FROM public.offer_documents od WHERE od.offer_id = o.id AND od.file_path = storage.objects.name))
    )
  );

-- offer-signed: admins all; applicants upload + read their own folder (folder = user id)
CREATE POLICY "Admins manage offer-signed bucket"
  ON storage.objects FOR ALL
  USING (bucket_id = 'offer-signed' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'offer-signed' AND public.is_admin(auth.uid()));

CREATE POLICY "Applicants upload own signed offers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'offer-signed'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Applicants read own signed offers"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'offer-signed'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 8. Notifications when offers change state
CREATE OR REPLACE FUNCTION public.handle_offer_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_workflow_name text;
BEGIN
  SELECT a.user_id, w.name INTO v_user, v_workflow_name
  FROM public.applications a
  JOIN public.workflows w ON w.id = a.workflow_id
  WHERE a.id = NEW.application_id;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NEW.status IN ('sent','template_sent') THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (v_user, 'Offer documents ready',
              'Your offer for ' || COALESCE(v_workflow_name,'your application') || ' is ready. Please sign, get it stamped if required, and upload the signed copy.',
              'success', '/dashboard');
    ELSIF NEW.status = 'revision_requested' THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (v_user, 'Revised offer copy requested',
              COALESCE(NEW.rejection_reason, 'Please upload a revised signed copy of your offer.'),
              'warning', '/dashboard');
    ELSIF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (v_user, 'Offer approved',
              'Your signed offer for ' || COALESCE(v_workflow_name,'your application') || ' has been approved.',
              'success', '/dashboard');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      VALUES (v_user, 'Offer rejected',
              COALESCE(NEW.rejection_reason, 'Your signed offer was not accepted.'),
              'error', '/dashboard');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_change ON public.offers;
CREATE TRIGGER trg_offer_change
  AFTER INSERT OR UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.handle_offer_change();

-- 9. Notify admins when applicant uploads a signed offer document
CREATE OR REPLACE FUNCTION public.handle_signed_doc_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workflow_name text;
BEGIN
  IF NEW.kind <> 'signed' THEN RETURN NEW; END IF;

  -- bump offer status + version
  UPDATE public.offers
     SET status = 'signed_uploaded',
         current_version = NEW.version
   WHERE id = NEW.offer_id;

  SELECT w.name INTO v_workflow_name
  FROM public.offers o
  JOIN public.applications a ON a.id = o.application_id
  JOIN public.workflows w ON w.id = a.workflow_id
  WHERE o.id = NEW.offer_id;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT ur.user_id,
         'Signed offer received',
         'A signed offer for ' || COALESCE(v_workflow_name,'an application') || ' has been uploaded for review.',
         'info',
         '/admin'
  FROM public.user_roles ur WHERE ur.role = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_signed_doc_upload ON public.offer_documents;
CREATE TRIGGER trg_signed_doc_upload
  AFTER INSERT ON public.offer_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_signed_doc_upload();