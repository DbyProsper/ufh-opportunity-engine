
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  actions JSONB,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat messages" ON public.chat_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_messages_user_created_idx ON public.chat_messages (user_id, created_at);

CREATE TABLE public.chat_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  response TEXT NOT NULL,
  actions JSONB,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','student','admin')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_intents TO anon, authenticated;
GRANT ALL ON public.chat_intents TO service_role;
ALTER TABLE public.chat_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read enabled intents" ON public.chat_intents FOR SELECT USING (enabled = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage intents" ON public.chat_intents FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER chat_intents_updated_at BEFORE UPDATE ON public.chat_intents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  source TEXT,
  model TEXT,
  duration_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_logs TO authenticated;
GRANT ALL ON public.chat_logs TO service_role;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read chat logs" ON public.chat_logs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE INDEX chat_logs_created_idx ON public.chat_logs (created_at DESC);

-- Seed default intents from existing rule-based responses
INSERT INTO public.chat_intents (name, keywords, response, actions, audience, priority) VALUES
('UFH ITS / iEnabler', ARRAY['its','ienabler'], 'Here is the UFH ITS / iEnabler portal. Click below to open it in a new tab.', '[{"label":"Open UFH ITS / iEnabler","url":"https://ienabler.ufh.ac.za/pls/prodi41/w99pkg.mi_login"}]'::jsonb, 'all', 100),
('UFH Blackboard', ARRAY['blackboard'], 'Here is UFH Blackboard.', '[{"label":"Open UFH Blackboard","url":"https://ufh.blackboard.com"}]'::jsonb, 'all', 100),
('UFH Library', ARRAY['library'], 'Here is the UFH Library.', '[{"label":"Open UFH Library","url":"https://libguides.ufh.ac.za"}]'::jsonb, 'all', 100),
('Financial Aid', ARRAY['financial','bursary funding','financial aid'], 'Here is UFH Financial Aid.', '[{"label":"Open UFH Financial Aid","url":"https://www.ufh.ac.za/students/financial-aid"}]'::jsonb, 'all', 90),
('UFH Website', ARRAY['ufh website','website','main site'], 'Here is the UFH main website.', '[{"label":"Open UFH Website","url":"https://www.ufh.ac.za"}]'::jsonb, 'all', 80),
('Eligibility', ARRAY['eligib','qualify','can i apply'], 'Eligibility depends on your qualification, year of study, faculty and department. Open an opportunity and tap ''Why?'' to see the exact check for it.', '[{"label":"Browse Opportunities","route":"/dashboard"},{"label":"Update Profile","route":"/profile"}]'::jsonb, 'student', 70),
('Documents', ARRAY['document','upload','require','what do i need'], 'Most applications need: certified ID, latest academic transcript, CV, and any opportunity-specific documents listed on the application page.', '[{"label":"My Applications","route":"/dashboard"}]'::jsonb, 'student', 70),
('Opportunities', ARRAY['opportun','bursary','intern','tutor','apply','browse'], 'You can browse all published opportunities on your dashboard. Filter by category or use the search bar.', '[{"label":"View Opportunities","route":"/dashboard"}]'::jsonb, 'all', 60),
('Deadlines', ARRAY['deadline','due','when'], 'Each opportunity shows its closing date on the card. Open the details dialog for the exact deadline.', '[{"label":"View Opportunities","route":"/dashboard"}]'::jsonb, 'all', 60),
('Messages', ARRAY['message','reviewer','chat'], 'All conversations with reviewers appear in your Messages inbox.', '[{"label":"Open Messages","route":"/messages"}]'::jsonb, 'all', 60),
('Admin Tools', ARRAY['workflow','admin','extract','bulletin','invite'], 'In the Admin dashboard you can create workflows, extract opportunities from the Daily Bulletin PDF, review applications, and manage admins.', '[{"label":"Admin Dashboard","route":"/admin"},{"label":"Audit Log","route":"/admin/audit"}]'::jsonb, 'admin', 80),
('Profile', ARRAY['profile','banking','next of kin'], 'Update your personal details, qualification and banking info on the Profile page. A complete profile speeds up applications.', '[{"label":"Open Profile","route":"/profile"}]'::jsonb, 'all', 60),
('Theme / Settings', ARRAY['theme','dark','light','setting'], 'Change your theme (light, dark, UFH, minimal, image) from Settings.', '[{"label":"Open Settings","route":"/settings"}]'::jsonb, 'all', 50);
