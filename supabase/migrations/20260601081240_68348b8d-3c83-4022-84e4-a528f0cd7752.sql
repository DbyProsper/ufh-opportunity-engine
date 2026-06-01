-- Update handle_new_user to read role from sign-up metadata so applicants can choose Student/Staff at registration.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_role_meta text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );

  v_role_meta := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  IF v_role_meta = 'staff' THEN
    v_role := 'staff';
  ELSIF v_role_meta = 'admin' THEN
    -- Admin role can never be self-assigned on signup; downgrade to student.
    v_role := 'student';
  ELSE
    v_role := 'student';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$function$;