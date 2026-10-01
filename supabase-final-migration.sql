-- OMH Social Services final content extension.
-- Safe to run after the existing OMH schema. It does not delete existing data.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  language text not null default 'fa',
  file_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_created_at_idx on public.documents(created_at desc);
create index if not exists documents_active_idx on public.documents(is_active);

-- Public read policy (the Node server normally reads through Supabase service role).
alter table public.documents enable row level security;
drop policy if exists "documents_public_read" on public.documents;
create policy "documents_public_read" on public.documents for select using (is_active = true);

-- Helpful settings can be stored without a schema change because the existing
-- settings table is key/value based. These are only defaults; replace URLs in admin.
insert into public.settings(key,value) values
('whatsapp_channel','https://whatsapp.com/channel/0029VbC27wl9mrGcV1D6aa3O'),
('telegram_channel','https://t.me/OMHSocial')
on conflict (key) do nothing;
