-- =========================================================
-- Profile-first reusable data model
-- =========================================================

-- ADDRESSES ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'home',        -- home | postal | work | other
  is_primary boolean NOT NULL DEFAULT false,
  line1 text,
  line2 text,
  city text,
  province text,
  postal_code text,
  country text DEFAULT 'South Africa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own addresses" ON public.addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all addresses" ON public.addresses
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TRIGGER addresses_set_updated_at
BEFORE UPDATE ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_addresses_user ON public.addresses(user_id);

-- NEXT OF KIN ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.next_of_kin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text,
  relationship text,
  phone text,
  email text,
  address text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.next_of_kin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own NOK" ON public.next_of_kin
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all NOK" ON public.next_of_kin
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TRIGGER nok_set_updated_at
BEFORE UPDATE ON public.next_of_kin
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_nok_user ON public.next_of_kin(user_id);

-- FINANCIAL PROFILE (SARS) ---------------------------------
CREATE TABLE IF NOT EXISTS public.financial_profile (
  user_id uuid PRIMARY KEY,
  sars_tax_number text,
  income_tax_ref text,
  vat_number text,
  dependants integer,
  marital_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own financial profile" ON public.financial_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all financial profile" ON public.financial_profile
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TRIGGER fin_set_updated_at
BEFORE UPDATE ON public.financial_profile
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BANKING DETAILS ------------------------------------------
CREATE TABLE IF NOT EXISTS public.banking_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_name text,
  branch_code text,
  account_number text,
  account_type text,        -- cheque | savings | transmission
  account_holder text,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.banking_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own banking" ON public.banking_details
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all banking" ON public.banking_details
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TRIGGER bank_set_updated_at
BEFORE UPDATE ON public.banking_details
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_banking_user ON public.banking_details(user_id);

-- EMPLOYMENT DETAILS ---------------------------------------
CREATE TABLE IF NOT EXISTS public.employment_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employer text,
  position text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  supervisor_name text,
  supervisor_contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employment_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own employment" ON public.employment_details
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all employment" ON public.employment_details
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TRIGGER emp_set_updated_at
BEFORE UPDATE ON public.employment_details
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_employment_user ON public.employment_details(user_id);

-- Extend profiles with personal-info fields used by the tutor form
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS race text,
  ADD COLUMN IF NOT EXISTS disability text,
  ADD COLUMN IF NOT EXISTS home_language text;

-- Extend workflow_fields.profile_field allowed values are app-level only;
-- nothing to enforce in the DB. We rely on the editor UI.