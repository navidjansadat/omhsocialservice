-- Run this once after the previous OMH schema.
-- Adds PDF support to OMH publications. No image column is added for posts.
alter table public.posts add column if not exists pdf_url text default '';
alter table public.posts add column if not exists pdf_name varchar(255) default '';
create index if not exists idx_posts_pdf on public.posts(pdf_url) where pdf_url <> '';
