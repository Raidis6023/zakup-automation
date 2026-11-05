-- The original supplier workbook remains archived unchanged.
-- Product images are derived private WebP thumbnails, addressed by offer item UUID.
alter table public.ved_commercial_offers
 add column if not exists photos_indexed_at timestamptz;
alter table public.ved_commercial_offer_items
 add column if not exists product_photo_path text,
 add column if not exists packaging_photo_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ved-product-photos','ved-product-photos',false,2097152,array['image/webp'])
on conflict(id) do nothing;

-- No public storage policies: read via authorized short-lived signed URLs only.
