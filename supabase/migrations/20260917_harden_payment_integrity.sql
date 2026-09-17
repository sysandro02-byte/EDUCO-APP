-- Harden school payment integrity.
-- Production was checked before rollout: public.payments contained no rows,
-- so these constraints do not require data repair.

alter table public.payments
  drop constraint if exists payments_amount_positive_check;

alter table public.payments
  add constraint payments_amount_positive_check
  check (amount is null or amount > 0);

create unique index if not exists payments_school_receipt_unique_idx
  on public.payments (school_id, receipt_number)
  where receipt_number is not null and btrim(receipt_number) <> '';
