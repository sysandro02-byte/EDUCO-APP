-- Private vault for issued administrative documents.
insert into storage.buckets(id,name,public) values ('official-administrative-documents','official-administrative-documents',false)
on conflict(id) do update set public=false;

create policy "owners read official document files" on storage.objects for select to authenticated
using (bucket_id='official-administrative-documents' and exists(
 select 1 from public.administrative_official_documents d
 where d.storage_path=name and d.owner_uid=(select auth.uid())
));
create policy "ministry agents read official document files" on storage.objects for select to authenticated
using (bucket_id='official-administrative-documents' and exists(
 select 1 from public.administrative_official_documents d
 where d.storage_path=name and public.is_ministry_administrative_agent(d.ministry)
));
-- Client users never receive INSERT/UPDATE/DELETE policies on the official vault.
-- Final PDFs must be uploaded by a trusted server-side issuance process.
