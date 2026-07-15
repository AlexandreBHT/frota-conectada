
-- Tighten vehicles UPDATE: only gestor via normal policies.
DROP POLICY IF EXISTS "Driver updates vehicle status via trip" ON public.vehicles;

-- Lock down SECURITY DEFINER functions from being called via the API directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role is used inside RLS policies (which run as the row's role); keep it executable by authenticated for direct app checks.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
