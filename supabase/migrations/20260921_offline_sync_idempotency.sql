-- Harden offline synchronization against duplicate retries.
alter table public.transactions
  add column if not exists offline_operation_id text;

alter table public.payments
  add column if not exists offline_operation_id text;

create unique index if not exists transactions_offline_operation_unique
  on public.transactions(offline_operation_id)
  where offline_operation_id is not null;

create unique index if not exists payments_offline_operation_unique
  on public.payments(offline_operation_id)
  where offline_operation_id is not null;
