-- Selected classes chosen during establishment registration are part of the
-- establishment dossier and must always exist in public.classes. Historically
-- their creation was best-effort in the API, so a successful registration could
-- leave schools.levels populated while public.classes remained empty.

CREATE UNIQUE INDEX IF NOT EXISTS classes_school_name_unique_idx
  ON public.classes (school_id, name)
  WHERE school_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_school_selected_classes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.levels IS NULL OR jsonb_typeof(NEW.levels) <> 'object' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.classes (school_id, name, level, capacity, is_exam_class, status)
  SELECT NEW.id, selected.name, selected.level, 30, false, 'active'
  FROM (
    SELECT 'Garderie'::text AS name, 'Garderie'::text AS level
    WHERE NEW.levels->'garderie' = 'true'::jsonb

    UNION ALL

    SELECT entry.key, 'Préscolaire'
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(NEW.levels->'prescolaire') = 'object'
        THEN NEW.levels->'prescolaire' ELSE '{}'::jsonb END
    ) AS entry
    WHERE entry.value = 'true'::jsonb

    UNION ALL

    SELECT entry.key, 'Primaire'
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(NEW.levels->'primaire') = 'object'
        THEN NEW.levels->'primaire' ELSE '{}'::jsonb END
    ) AS entry
    WHERE entry.value = 'true'::jsonb

    UNION ALL

    SELECT entry.key, 'Collège'
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(NEW.levels->'secondaireCollege') = 'object'
        THEN NEW.levels->'secondaireCollege' ELSE '{}'::jsonb END
    ) AS entry
    WHERE entry.value = 'true'::jsonb

    UNION ALL

    SELECT entry.key, 'Lycée'
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(NEW.levels->'secondaireLycee') = 'object'
        THEN NEW.levels->'secondaireLycee' ELSE '{}'::jsonb END
    ) AS entry
    WHERE entry.value = 'true'::jsonb
  ) AS selected
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_sync_selected_classes ON public.schools;
CREATE TRIGGER schools_sync_selected_classes
AFTER INSERT OR UPDATE OF levels ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.sync_school_selected_classes();

-- Repair historical establishments whose selected levels were stored but whose
-- class rows were not created by the old best-effort API flow.
UPDATE public.schools
SET levels = levels
WHERE levels IS NOT NULL
  AND levels <> '{}'::jsonb;
