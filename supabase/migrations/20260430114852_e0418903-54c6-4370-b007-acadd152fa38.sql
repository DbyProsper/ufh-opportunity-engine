
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_message() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.require_rejection_reason() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_offer_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_signed_doc_upload() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_application_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_offer_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_offer_doc_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.require_offer_reason() FROM authenticated;
