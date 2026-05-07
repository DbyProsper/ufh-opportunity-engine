
-- Revoke execute from public/anon/authenticated on all internal SECURITY DEFINER trigger helpers.
do $$
declare f text;
begin
  for f in select unnest(array[
    'set_updated_at()',
    'tg_audit_row()',
    'log_application_event()',
    'log_offer_event()',
    'log_offer_doc_event()',
    'handle_offer_change()',
    'handle_signed_doc_upload()',
    'handle_new_message()',
    'notify_affidavit_change()',
    'require_offer_reason()',
    'require_rejection_reason()',
    'handle_new_user()'
  ])
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('revoke all on function public.%s from anon', f);
    execute format('revoke all on function public.%s from authenticated', f);
  end loop;
end $$;
