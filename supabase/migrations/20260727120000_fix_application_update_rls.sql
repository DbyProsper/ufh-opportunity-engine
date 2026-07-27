-- Allow users to submit or continue editing their own draft/change-request applications
DROP POLICY IF EXISTS "Users update own editable applications" ON public.applications;

CREATE POLICY "Users update own editable applications"
ON public.applications
FOR UPDATE
USING (
  auth.uid() = user_id
  AND (
    is_editable = true
    OR status = 'draft'::application_status
    OR status = 'changes_requested'::application_status
  )
)
WITH CHECK (auth.uid() = user_id);
