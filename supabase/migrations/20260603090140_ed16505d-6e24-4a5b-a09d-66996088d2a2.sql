
-- 1. Extend role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reviewer';
COMMIT;

-- 2. Helper: super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

-- Admin check now also accepts super_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'super_admin');
$$;

-- 3. Bootstrap: oldest admin becomes super_admin (idempotent)
DO $$
DECLARE v_uid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    SELECT user_id INTO v_uid FROM public.user_roles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
    IF v_uid IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- 4. admin_invites
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  invited_by uuid NOT NULL,
  reason text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_invites_email ON public.admin_invites (lower(email)) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.admin_invites TO authenticated;
GRANT ALL ON public.admin_invites TO service_role;

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage invites" ON public.admin_invites;
CREATE POLICY "Super admins manage invites" ON public.admin_invites
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) AND lower(email) LIKE '%@ufh.ac.za' AND role IN ('admin','reviewer'));

DROP POLICY IF EXISTS "Invitees view own invite" ON public.admin_invites;
CREATE POLICY "Invitees view own invite" ON public.admin_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower((SELECT email FROM public.profiles WHERE id = auth.uid())));

-- 5. admin_audit_logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  role public.app_role,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read admin audit" ON public.admin_audit_logs;
CREATE POLICY "Admins read admin audit" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 6. Tighten user_roles: only super_admin can write
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;

CREATE POLICY "Admins read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins write roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- Block users from ever editing their own role rows (defense in depth — no self-promotion)
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You cannot modify your own role';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.user_roles;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- 7. Accept invite RPC (called by invitee after login)
CREATE OR REPLACE FUNCTION public.accept_admin_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.admin_invites%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();

  SELECT * INTO v_inv FROM public.admin_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invite token'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invite already %', v_inv.status; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.admin_invites SET status='expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invite expired — request a new one';
  END IF;
  IF lower(v_inv.email) <> lower(v_email) THEN RAISE EXCEPTION 'This invite is for a different email'; END IF;
  IF lower(v_email) NOT LIKE '%@ufh.ac.za' THEN RAISE EXCEPTION 'Admin access restricted to @ufh.ac.za emails'; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), v_inv.role)
    ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.admin_invites
     SET status='accepted', accepted_at=now(), accepted_by=auth.uid()
   WHERE id = v_inv.id;

  INSERT INTO public.admin_audit_logs(actor_id, actor_email, action, target_user_id, target_email, role, reason, metadata)
  VALUES (auth.uid(), v_email, 'invite_accepted', auth.uid(), v_email, v_inv.role, v_inv.reason,
          jsonb_build_object('invite_id', v_inv.id, 'invited_by', v_inv.invited_by));

  RETURN jsonb_build_object('ok', true, 'role', v_inv.role);
END $$;

-- 8. Revoke role RPC (super_admin only)
CREATE OR REPLACE FUNCTION public.revoke_admin_role(_target uuid, _role public.app_role, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_target_email text; v_remaining int;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only super admins can revoke roles'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'You cannot revoke your own role'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'A reason is required'; END IF;

  -- Prevent removing the last super_admin
  IF _role = 'super_admin' THEN
    SELECT count(*) INTO v_remaining FROM public.user_roles WHERE role = 'super_admin' AND user_id <> _target;
    IF v_remaining = 0 THEN RAISE EXCEPTION 'Cannot remove the last super admin'; END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target AND role = _role;

  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  SELECT email INTO v_target_email FROM public.profiles WHERE id = _target;
  INSERT INTO public.admin_audit_logs(actor_id, actor_email, action, target_user_id, target_email, role, reason)
  VALUES (auth.uid(), v_email, 'role_revoked', _target, v_target_email, _role, _reason);
  RETURN jsonb_build_object('ok', true);
END $$;

-- 9. handle_new_user: auto-consume matching pending invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
  v_role_meta text;
  v_inv public.admin_invites%ROWTYPE;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));

  v_role_meta := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  v_role := CASE WHEN v_role_meta = 'staff' THEN 'staff'::public.app_role ELSE 'student'::public.app_role END;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role) ON CONFLICT DO NOTHING;

  -- Auto-accept pending admin/reviewer invite for this email
  SELECT * INTO v_inv FROM public.admin_invites
   WHERE lower(email) = lower(NEW.email) AND status='pending' AND expires_at > now()
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_inv.role) ON CONFLICT DO NOTHING;
    UPDATE public.admin_invites SET status='accepted', accepted_at=now(), accepted_by=NEW.id WHERE id = v_inv.id;
    INSERT INTO public.admin_audit_logs(actor_id, actor_email, action, target_user_id, target_email, role, reason, metadata)
    VALUES (NEW.id, NEW.email, 'invite_accepted', NEW.id, NEW.email, v_inv.role, v_inv.reason,
            jsonb_build_object('invite_id', v_inv.id, 'invited_by', v_inv.invited_by, 'auto', true));
  END IF;

  RETURN NEW;
END $$;
