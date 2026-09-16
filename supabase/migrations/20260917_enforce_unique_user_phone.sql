-- Every EDUCO account that has a phone must own that normalized phone uniquely.
-- Keep this migration self-contained so production remains correct even if an
-- older account-lifecycle migration did not create phone_normalized.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (
    regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g')
  ) STORED;

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
