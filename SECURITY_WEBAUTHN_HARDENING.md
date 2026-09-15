# WebAuthn hardening — non-destructive scope

This change intentionally performs no database migration, table deletion, data reset, account deletion, subscription mutation, or credential purge.

Existing `webauthn_credentials` rows remain compatible. Registration and device management now require an authenticated EDUCO/Supabase session and derive ownership from the verified session rather than browser-supplied identity fields. Login challenges are single-use and successful WebAuthn verification returns a signed EDUCO session token.

A user may need to sign in again if an old client session does not contain a verifiable Supabase or signed EDUCO token. Re-authentication does not delete account or school data.
