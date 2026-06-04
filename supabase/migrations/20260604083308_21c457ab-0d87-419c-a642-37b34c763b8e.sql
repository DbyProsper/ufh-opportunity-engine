
CREATE TABLE IF NOT EXISTS public.external_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  organization text,
  description text,
  requirements text,
  deadline timestamptz,
  external_link text,
  source text DEFAULT 'bulletin',
  status text NOT NULL DEFAULT 'draft', -- draft | published | archived
  confidence numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.external_opportunities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.external_opportunities TO authenticated;
GRANT ALL ON public.external_opportunities TO service_role;

ALTER TABLE public.external_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads published external opps"
  ON public.external_opportunities FOR SELECT
  USING (status = 'published' OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage external opps"
  ON public.external_opportunities FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_ext_opps_updated_at BEFORE UPDATE ON public.external_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
