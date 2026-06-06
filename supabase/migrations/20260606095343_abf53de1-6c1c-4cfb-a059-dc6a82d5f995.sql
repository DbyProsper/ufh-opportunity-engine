
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.external_opportunities ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.external_opportunities ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light';
