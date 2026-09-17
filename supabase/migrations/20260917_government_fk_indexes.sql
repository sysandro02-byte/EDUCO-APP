-- Cover school_id foreign keys used by ministry registers.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'government_inspections','government_national_exams','government_accreditations',
    'government_hr_movements','government_infrastructures','government_assets',
    'government_validation_cases','government_projects','government_decisions',
    'government_school_map'
  ] loop
    execute format(
      'create index if not exists %I on public.%I (school_id)',
      v_table || '_school_id_idx', v_table
    );
  end loop;
end $$;
