-- OMH maintenance migration (safe for existing installations; preserves current records).
-- Run this in Supabase SQL Editor after the original schema/migrations.
alter table public.services add column if not exists updated_at timestamptz not null default now();
alter table public.posts add column if not exists updated_at timestamptz not null default now();
alter table public.posts add column if not exists pdf_url text default '';
alter table public.posts add column if not exists pdf_name varchar(255) default '';
alter table public.settings add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_posts_pdf on public.posts(pdf_url) where coalesce(pdf_url,'') <> '';
create index if not exists idx_services_active_featured on public.services(is_active,is_featured);
create index if not exists idx_posts_active on public.posts(is_active,created_at desc);

-- Ensure updated_at remains fresh when content is edited.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at before update on public.services
for each row execute function public.set_updated_at();
drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at before update on public.posts
for each row execute function public.set_updated_at();
drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at before update on public.settings
for each row execute function public.set_updated_at();

-- Keep the current OMH contact channels as defaults without overwriting admin edits.
insert into public.settings(key,value) values
('whatsapp_channel','https://whatsapp.com/channel/0029VbC27wl9mrGcV1D6aa3O'),
('telegram_channel','https://t.me/OMHSocial')
on conflict (key) do nothing;

-- Update only known placeholder/older default contact values; preserve custom admin settings.
update public.settings set value='93748070273', updated_at=now()
where key='whatsapp' and value in ('9370000000','93701624943');
