
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('student', 'staff', 'admin');
CREATE TYPE public.application_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn');
CREATE TYPE public.field_type AS ENUM ('text', 'textarea', 'select', 'multiselect', 'date', 'file', 'number', 'email', 'phone');
CREATE TYPE public.offer_status AS ENUM ('pending', 'sent', 'accepted', 'declined', 'withdrawn');
CREATE TYPE public.target_role AS ENUM ('student', 'staff', 'any');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  student_number TEXT,
  staff_number TEXT,
  department TEXT,
  faculty TEXT,
  phone TEXT,
  address TEXT,
  year_of_study TEXT,
  qualification TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer for RLS without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

-- ============ WORKFLOWS ============
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  target_role public.target_role NOT NULL DEFAULT 'student',
  department TEXT,
  faculty TEXT,
  deadline TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon TEXT DEFAULT 'GraduationCap',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  step_order INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_workflow_steps_workflow ON public.workflow_steps(workflow_id, step_order);

CREATE TABLE public.workflow_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_key TEXT NOT NULL,
  type public.field_type NOT NULL DEFAULT 'text',
  required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  help_text TEXT,
  options JSONB,
  profile_field TEXT,
  field_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_fields ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_workflow_fields_workflow ON public.workflow_fields(workflow_id, field_order);

CREATE TABLE public.workflow_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  doc_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.eligibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  rule_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eligibility_rules ENABLE ROW LEVEL SECURITY;

-- ============ APPLICATIONS ============
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  is_editable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, user_id)
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_applications_user ON public.applications(user_id);
CREATE INDEX idx_applications_workflow ON public.applications(workflow_id);

CREATE TABLE public.application_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.workflow_fields(id) ON DELETE CASCADE,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, field_id)
);
ALTER TABLE public.application_responses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.workflow_documents(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  status public.offer_status NOT NULL DEFAULT 'pending',
  message TEXT,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_workflows_updated BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default 'student' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

-- workflows (publicly readable when active; admins manage)
CREATE POLICY "Anyone reads active workflows" ON public.workflows
  FOR SELECT USING (is_active = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage workflows" ON public.workflows
  FOR ALL USING (public.is_admin(auth.uid()));

-- workflow_steps / fields / documents / eligibility_rules
CREATE POLICY "Anyone reads workflow_steps" ON public.workflow_steps FOR SELECT USING (true);
CREATE POLICY "Admins manage steps" ON public.workflow_steps FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone reads workflow_fields" ON public.workflow_fields FOR SELECT USING (true);
CREATE POLICY "Admins manage fields" ON public.workflow_fields FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone reads workflow_documents" ON public.workflow_documents FOR SELECT USING (true);
CREATE POLICY "Admins manage documents" ON public.workflow_documents FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone reads eligibility_rules" ON public.eligibility_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage eligibility" ON public.eligibility_rules FOR ALL USING (public.is_admin(auth.uid()));

-- applications
CREATE POLICY "Users view own applications" ON public.applications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all applications" ON public.applications
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users create own applications" ON public.applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own editable applications" ON public.applications
  FOR UPDATE USING (auth.uid() = user_id AND is_editable = true);
CREATE POLICY "Admins update applications" ON public.applications
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Users delete own draft applications" ON public.applications
  FOR DELETE USING (auth.uid() = user_id AND status = 'draft');

-- application_responses
CREATE POLICY "Users view own responses" ON public.application_responses
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins view all responses" ON public.application_responses
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users manage own responses" ON public.application_responses
  FOR ALL USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));

-- application_documents
CREATE POLICY "Users view own docs" ON public.application_documents
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins view all docs" ON public.application_documents
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users manage own docs" ON public.application_documents
  FOR ALL USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));

-- offers
CREATE POLICY "Users view own offers" ON public.offers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins view all offers" ON public.offers FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage offers" ON public.offers FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Users respond to own offers" ON public.offers
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));

-- notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins create notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR auth.uid() = user_id);

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload to own folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'application-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users read own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'application-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Admins read all application files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'application-documents'
    AND public.is_admin(auth.uid())
  );
CREATE POLICY "Users delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'application-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
