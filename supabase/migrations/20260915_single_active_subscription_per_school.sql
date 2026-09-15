-- EDUCO: one effective active subscription per school.
-- Preserve historical subscriptions; only the most relevant active row remains active.

WITH ranked_active AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY school_id
           ORDER BY end_date DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.subscriptions
  WHERE status = 'active'
    AND school_id IS NOT NULL
)
UPDATE public.subscriptions AS s
SET status = 'inactive', updated_at = now()
FROM ranked_active AS r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_per_school_idx
  ON public.subscriptions (school_id)
  WHERE status = 'active' AND school_id IS NOT NULL;
