
-- Message threads (one per application, lazily created)
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX idx_messages_thread ON public.messages(thread_id, created_at);
CREATE INDEX idx_threads_app ON public.message_threads(application_id);

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Threads: applicant on the application OR admin
CREATE POLICY "Applicants view own threads"
ON public.message_threads FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = message_threads.application_id AND a.user_id = auth.uid()
));

CREATE POLICY "Admins view all threads"
ON public.message_threads FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Applicants create own threads"
ON public.message_threads FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.id = message_threads.application_id AND a.user_id = auth.uid()
));

CREATE POLICY "Admins create threads"
ON public.message_threads FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update threads"
ON public.message_threads FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Messages: applicant on the related app OR admin
CREATE POLICY "Applicants view own messages"
ON public.messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.message_threads t
  JOIN public.applications a ON a.id = t.application_id
  WHERE t.id = messages.thread_id AND a.user_id = auth.uid()
));

CREATE POLICY "Admins view all messages"
ON public.messages FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Applicants send messages on own threads"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.message_threads t
    JOIN public.applications a ON a.id = t.application_id
    WHERE t.id = messages.thread_id AND a.user_id = auth.uid()
  )
);

CREATE POLICY "Admins send messages on any thread"
ON public.messages FOR INSERT
WITH CHECK (sender_id = auth.uid() AND public.is_admin(auth.uid()));

CREATE POLICY "Recipients mark messages read"
ON public.messages FOR UPDATE
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.message_threads t
    JOIN public.applications a ON a.id = t.application_id
    WHERE t.id = messages.thread_id AND a.user_id = auth.uid()
  )
);

-- Bump last_message_at + create notification
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Notify the applicant if admin sent it; notify admins not implemented (broadcast not feasible here)
  IF NEW.sender_id <> v_app_user THEN
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
$$;

CREATE TRIGGER trg_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;
