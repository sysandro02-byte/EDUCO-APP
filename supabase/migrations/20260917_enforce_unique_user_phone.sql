-- Every EDUCO account that has a phone must own that normalized phone uniquely.
-- This migration intentionally runs after the account-lifecycle migration, which
-- introduced phone_normalized. It restores database-level uniqueness so the
-- phone identifier used for login cannot belong to multiple accounts.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
    GROUP BY phone_normalized
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique user phone: duplicate normalized phone values exist';
  END IF;
END $$;

DROP INDEX IF EXISTS public.users_phone_lookup_idx;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON public.users (phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';
