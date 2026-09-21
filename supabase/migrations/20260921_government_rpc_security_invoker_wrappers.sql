-- Move privileged government RPC bodies out of the exposed public schema.
-- Idempotent: live production may already contain the *_secure functions.

do $$
begin
  if to_regprocedure('private.government_module_records_secure(text,text,text)') is null then
    alter function public.government_module_records(text,text,text) set schema private;
    alter function private.government_module_records(text,text,text) rename to government_module_records_secure;
  end if;
  if to_regprocedure('private.government_module_history_secure(text,text,text,bigint)') is null then
    alter function public.government_module_history(text,text,text,bigint) set schema private;
    alter function private.government_module_history(text,text,text,bigint) rename to government_module_history_secure;
  end if;
  if to_regprocedure('private.government_module_save_secure(text,text,text,jsonb)') is null then
    alter function public.government_module_save(text,text,text,jsonb) set schema private;
    alter function private.government_module_save(text,text,text,jsonb) rename to government_module_save_secure;
  end if;
  if to_regprocedure('private.government_module_transition_secure(text,text,text,bigint,text)') is null then
    alter function public.government_module_transition(text,text,text,bigint,text) set schema private;
    alter function private.government_module_transition(text,text,text,bigint,text) rename to government_module_transition_secure;
  end if;
  if to_regprocedure('private.government_module_delete_secure(text,text,text,bigint)') is null then
    alter function public.government_module_delete(text,text,text,bigint) set schema private;
    alter function private.government_module_delete(text,text,text,bigint) rename to government_module_delete_secure;
  end if;
  if to_regprocedure('private.government_workspace_snapshot_secure(text,text)') is null then
    alter function public.government_workspace_snapshot(text,text) set schema private;
    alter function private.government_workspace_snapshot(text,text) rename to government_workspace_snapshot_secure;
  end if;
end $$;

alter function private.government_module_records_secure(text,text,text) security definer;
alter function private.government_module_history_secure(text,text,text,bigint) security definer;
alter function private.government_module_save_secure(text,text,text,jsonb) security definer;
alter function private.government_module_transition_secure(text,text,text,bigint,text) security definer;
alter function private.government_module_delete_secure(text,text,text,bigint) security definer;
alter function private.government_workspace_snapshot_secure(text,text) security definer;

alter function private.government_module_records_secure(text,text,text) set search_path='';
alter function private.government_module_history_secure(text,text,text,bigint) set search_path='';
alter function private.government_module_save_secure(text,text,text,jsonb) set search_path='';
alter function private.government_module_transition_secure(text,text,text,bigint,text) set search_path='';
alter function private.government_module_delete_secure(text,text,text,bigint) set search_path='';
alter function private.government_workspace_snapshot_secure(text,text) set search_path='';

revoke all on function private.government_module_records_secure(text,text,text) from public,anon;
revoke all on function private.government_module_history_secure(text,text,text,bigint) from public,anon;
revoke all on function private.government_module_save_secure(text,text,text,jsonb) from public,anon;
revoke all on function private.government_module_transition_secure(text,text,text,bigint,text) from public,anon;
revoke all on function private.government_module_delete_secure(text,text,text,bigint) from public,anon;
revoke all on function private.government_workspace_snapshot_secure(text,text) from public,anon;

grant execute on function private.government_module_records_secure(text,text,text) to authenticated;
grant execute on function private.government_module_history_secure(text,text,text,bigint) to authenticated;
grant execute on function private.government_module_save_secure(text,text,text,jsonb) to authenticated;
grant execute on function private.government_module_transition_secure(text,text,text,bigint,text) to authenticated;
grant execute on function private.government_module_delete_secure(text,text,text,bigint) to authenticated;
grant execute on function private.government_workspace_snapshot_secure(text,text) to authenticated;

create or replace function public.government_module_records(p_ministry text,p_entity text,p_domain text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.government_module_records_secure(p_ministry,p_entity,p_domain) $$;

create or replace function public.government_module_history(p_ministry text,p_entity text,p_domain text,p_id bigint)
returns jsonb language sql security invoker set search_path=''
as $$ select private.government_module_history_secure(p_ministry,p_entity,p_domain,p_id) $$;

create or replace function public.government_module_save(p_ministry text,p_entity text,p_domain text,p_record jsonb)
returns jsonb language sql security invoker set search_path=''
as $$ select private.government_module_save_secure(p_ministry,p_entity,p_domain,p_record) $$;

create or replace function public.government_module_transition(p_ministry text,p_entity text,p_domain text,p_id bigint,p_status text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.government_module_transition_secure(p_ministry,p_entity,p_domain,p_id,p_status) $$;

create or replace function public.government_module_delete(p_ministry text,p_entity text,p_domain text,p_id bigint)
returns boolean language sql security invoker set search_path=''
as $$ select private.government_module_delete_secure(p_ministry,p_entity,p_domain,p_id) $$;

create or replace function public.government_workspace_snapshot(p_ministry text,p_entity text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.government_workspace_snapshot_secure(p_ministry,p_entity) $$;

revoke all on function public.government_module_records(text,text,text) from public,anon;
revoke all on function public.government_module_history(text,text,text,bigint) from public,anon;
revoke all on function public.government_module_save(text,text,text,jsonb) from public,anon;
revoke all on function public.government_module_transition(text,text,text,bigint,text) from public,anon;
revoke all on function public.government_module_delete(text,text,text,bigint) from public,anon;
revoke all on function public.government_workspace_snapshot(text,text) from public,anon;

grant execute on function public.government_module_records(text,text,text) to authenticated;
grant execute on function public.government_module_history(text,text,text,bigint) to authenticated;
grant execute on function public.government_module_save(text,text,text,jsonb) to authenticated;
grant execute on function public.government_module_transition(text,text,text,bigint,text) to authenticated;
grant execute on function public.government_module_delete(text,text,text,bigint) to authenticated;
grant execute on function public.government_workspace_snapshot(text,text) to authenticated;
