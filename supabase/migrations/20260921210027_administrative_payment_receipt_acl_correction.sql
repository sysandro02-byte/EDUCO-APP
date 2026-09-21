-- Correct service-role ACL enforcement for fiscal receipt attachment.
create or replace function private.attach_administrative_fiscal_receipt_secure(
  p_transaction_id uuid,
  p_fiscal_receipt_reference text
)
returns public.administrative_payment_receipts
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.administrative_payment_receipts;
begin
  if nullif(trim(p_fiscal_receipt_reference),'') is null then
    raise exception 'Référence de quittance requise';
  end if;

  update public.administrative_payment_receipts
  set fiscal_receipt_reference=trim(p_fiscal_receipt_reference),
      receipt_scope='OFFICIAL_QUITTANCE',
      updated_at=now()
  where transaction_id=p_transaction_id and status='VALID'
  returning * into r;

  if r.id is null then raise exception 'Reçu de paiement introuvable'; end if;
  return r;
end
$$;

revoke all on function private.attach_administrative_fiscal_receipt_secure(uuid,text)
from public,anon,authenticated;
grant execute on function private.attach_administrative_fiscal_receipt_secure(uuid,text)
to service_role;

revoke all on function public.attach_administrative_fiscal_receipt(uuid,text)
from public,anon,authenticated;
grant execute on function public.attach_administrative_fiscal_receipt(uuid,text)
to service_role;
