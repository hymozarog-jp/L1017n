-- Product images for L1017n admin-managed items.
-- The storefront reads public images; only the verified store admin can upload/delete.
alter table public.products add column if not exists image_url text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'l1017n-product-images',
  'l1017n-product-images',
  true,
  3145728,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "l1017n product images admin insert" on storage.objects;
create policy "l1017n product images admin insert" on storage.objects
for insert to authenticated with check (
  bucket_id='l1017n-product-images'
  and (storage.foldername(name))[1]='products'
  and public.is_store_admin()
);

drop policy if exists "l1017n product images admin select" on storage.objects;
create policy "l1017n product images admin select" on storage.objects
for select to authenticated using (
  bucket_id='l1017n-product-images'
  and public.is_store_admin()
);

drop policy if exists "l1017n product images admin delete" on storage.objects;
create policy "l1017n product images admin delete" on storage.objects
for delete to authenticated using (
  bucket_id='l1017n-product-images'
  and public.is_store_admin()
);
