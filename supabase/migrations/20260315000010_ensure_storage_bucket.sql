-- Ensure product-images storage bucket exists (policies in 20260315000007)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict do nothing;
