DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'set_updated_at',
        'handle_new_user',
        'log_application_event',
        'log_offer_event',
        'log_offer_doc_event',
        'require_rejection_reason',
        'require_offer_reason',
        'handle_offer_change',
        'handle_signed_doc_upload',
        'handle_new_message'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END$$;