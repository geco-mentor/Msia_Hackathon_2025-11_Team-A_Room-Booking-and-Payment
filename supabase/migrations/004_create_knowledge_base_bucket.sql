-- Create storage bucket for knowledge base documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('knowledge-base', 'knowledge-base', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- Policies for the knowledge-base bucket
drop policy if exists "Service role full access to knowledge-base bucket" on storage.objects;
create policy "Service role full access to knowledge-base bucket"
on storage.objects for all
using (bucket_id = 'knowledge-base')
with check (bucket_id = 'knowledge-base');

drop policy if exists "Authenticated users can read knowledge-base files" on storage.objects;
create policy "Authenticated users can read knowledge-base files"
on storage.objects for select
using (bucket_id = 'knowledge-base');
