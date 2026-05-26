
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_extra jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE POLICY "Admins delete applications"
ON public.applications
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete application responses"
ON public.application_responses
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete application documents"
ON public.application_documents
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete offers"
ON public.offers
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete offer documents"
ON public.offer_documents
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete affidavits"
ON public.affidavit_submissions
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete message threads"
ON public.message_threads
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
