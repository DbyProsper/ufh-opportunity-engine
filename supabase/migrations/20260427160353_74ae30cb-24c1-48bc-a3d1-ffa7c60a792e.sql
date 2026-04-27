
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-packs', 'application-packs', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {application_id}/pack.pdf
CREATE POLICY "Applicant or admin reads own pack"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'application-packs'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND a.user_id = auth.uid()
    )
  )
);
