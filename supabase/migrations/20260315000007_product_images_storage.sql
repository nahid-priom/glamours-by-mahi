-- Product images storage bucket policies
-- Create bucket from Dashboard or:
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', false);

-- Authenticated users can read org-scoped objects under their organization folder prefix.
-- Path convention: {organization_id}/{product_id|variant_id}/{filename}

create policy "product_images_select_authenticated"
on storage.objects for select
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

create policy "product_images_insert_authenticated"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.user_has_permission('products.update')
);

create policy "product_images_update_authenticated"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.user_has_permission('products.update')
);

create policy "product_images_delete_authenticated"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.user_has_permission('products.update')
);
