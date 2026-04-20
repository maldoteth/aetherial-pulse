
-- Create public profile-media bucket for avatars and banners
insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do nothing;

-- Allow public read
create policy "Profile media public read"
  on storage.objects for select
  using (bucket_id = 'profile-media');

-- Allow anyone to upload (wallet auth handled at app layer; same pattern as store-media)
create policy "Profile media public insert"
  on storage.objects for insert
  with check (bucket_id = 'profile-media');

create policy "Profile media public update"
  on storage.objects for update
  using (bucket_id = 'profile-media');
