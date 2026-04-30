
-- ============ APPLICATION EVENTS ============
CREATE TABLE public.application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_events_app ON public.application_events(application_id, created_at DESC);
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own application events"
  ON public.application_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins view all application events"
  ON public.application_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============ OFFER EVENTS ============
CREATE TABLE public.offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  version integer,
  message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_offer_events_offer ON public.offer_events(offer_id, created_at DESC);
ALTER TABLE public.offer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own offer events"
  ON public.offer_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.offers o
    JOIN public.applications a ON a.id = o.application_id
    WHERE o.id = offer_id AND a.user_id = auth.uid()
  ));
CREATE POLICY "Admins view all offer events"
  ON public.offer_events FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============ APPLICATION EVENT TRIGGER ============
CREATE OR REPLACE FUNCTION public.log_application_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.application_events(application_id, actor_id, event_type, to_status)
    VALUES (NEW.id, NEW.user_id, 'created', NEW.status::text);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.application_events(application_id, actor_id, event_type, from_status, to_status, message)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status::text, NEW.status::text, NEW.rejection_reason);
  END IF;

  IF NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id THEN
    INSERT INTO public.application_events(application_id, actor_id, event_type, message, metadata)
    VALUES (NEW.id, auth.uid(),
            CASE WHEN NEW.reviewer_id IS NULL THEN 'reviewer_unassigned' ELSE 'reviewer_assigned' END,
            NULL,
            jsonb_build_object('reviewer_id', NEW.reviewer_id));
  END IF;

  IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at AND NEW.submitted_at IS NOT NULL THEN
    INSERT INTO public.application_events(application_id, actor_id, event_type)
    VALUES (NEW.id, NEW.user_id, 'submitted');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_events_ins ON public.applications;
DROP TRIGGER IF EXISTS trg_app_events_upd ON public.applications;
CREATE TRIGGER trg_app_events_ins AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_event();
CREATE TRIGGER trg_app_events_upd AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.log_application_event();

-- ============ OFFER EVENT TRIGGERS ============
CREATE OR REPLACE FUNCTION public.log_offer_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.offer_events(offer_id, actor_id, event_type, to_status, version)
    VALUES (NEW.id, auth.uid(), 'created', NEW.status::text, NEW.current_version);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.offer_events(offer_id, actor_id, event_type, from_status, to_status, version, message)
    VALUES (NEW.id, auth.uid(), 'status_change', OLD.status::text, NEW.status::text, NEW.current_version, NEW.rejection_reason);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_events_ins ON public.offers;
DROP TRIGGER IF EXISTS trg_offer_events_upd ON public.offers;
CREATE TRIGGER trg_offer_events_ins AFTER INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.log_offer_event();
CREATE TRIGGER trg_offer_events_upd AFTER UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.log_offer_event();

CREATE OR REPLACE FUNCTION public.log_offer_doc_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.offer_events(offer_id, actor_id, event_type, version, message, metadata)
  VALUES (NEW.offer_id, NEW.uploaded_by,
          CASE WHEN NEW.kind = 'signed' THEN 'signed_uploaded' ELSE 'template_uploaded' END,
          NEW.version, NEW.notes,
          jsonb_build_object('file_name', NEW.file_name, 'kind', NEW.kind));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_doc_events ON public.offer_documents;
CREATE TRIGGER trg_offer_doc_events AFTER INSERT ON public.offer_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_offer_doc_event();

-- ============ REQUIRE NOTES ON OFFER REVISION/REJECTION ============
CREATE OR REPLACE FUNCTION public.require_offer_reason()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('revision_requested','rejected')
     AND (NEW.rejection_reason IS NULL OR length(trim(NEW.rejection_reason)) = 0) THEN
    RAISE EXCEPTION 'A note is required when requesting a revision or rejecting an offer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_offer_reason ON public.offers;
CREATE TRIGGER trg_require_offer_reason BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.require_offer_reason();

-- ============ LINTER HARDENING: revoke EXECUTE from public/anon ============
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_message() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.require_rejection_reason() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_offer_change() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_signed_doc_upload() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_application_event() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_offer_event() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_offer_doc_event() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.require_offer_reason() FROM PUBLIC, anon;
