-- Public wrapper needs execute on the private verifier while the table remains fully hidden.
revoke all on function private.verify_administrative_payment_receipt_secure(uuid)
from public;
grant execute on function private.verify_administrative_payment_receipt_secure(uuid)
to anon, authenticated;
