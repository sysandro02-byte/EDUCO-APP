-- Atomic two-phase issuance: reserve canonical number/token before server-side PDF generation.
alter table public.administrative_official_documents add column if not exists issuance_state text not null default 'FINAL' check (issuance_state in ('RESERVED','FINAL','FAILED'));
-- Runtime functions are installed by the paired Supabase migration in production.
-- reserve_administrative_document returns the canonical verification_token.
-- finalize_administrative_document persists the trusted storage path and SHA-256 only after upload succeeds.
