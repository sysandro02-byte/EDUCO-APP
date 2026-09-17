-- Keep legacy administrative/security tables server-only.
-- RLS already blocks ordinary row access; revoking grants removes the Data API
-- surface entirely for browser roles while preserving service-role access.
REVOKE ALL PRIVILEGES ON TABLE public.budget_settings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.school_settings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.webauthn_credentials FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.budget_settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.school_settings TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.webauthn_credentials TO service_role;
