-- OMH Social Services - Supabase schema
-- Run this file once in Supabase SQL Editor before starting the Node server.
-- The default admin password is: OMH@Admin2026!
-- CHANGE IT immediately after first login.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username varchar(80) not null unique,
  password text not null,
  session_token text unique,
  session_expiry timestamptz,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  slug varchar(120) not null unique,
  icon varchar(100) default '',
  description varchar(500) default '',
  is_active boolean not null default true,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name varchar(100) not null,
  slug varchar(120) not null,
  icon varchar(100) default '',
  is_active boolean not null default true,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  unique(category_id, slug)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.subcategories(id) on delete restrict,
  name varchar(120) not null,
  slug varchar(120) not null unique,
  description varchar(2000) default '',
  short_description varchar(300) default '',
  price numeric(12,2) not null default 0,
  discount numeric(5,2) not null default 0 check (discount >= 0 and discount <= 100),
  unit varchar(50) default '',
  image text default '',
  icon varchar(100) default '',
  delivery_time varchar(100) default '',
  guarantee varchar(200) default '',
  views bigint not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  customer_name varchar(80) not null,
  rating integer not null check (rating between 1 and 5),
  comment varchar(1000) not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title varchar(160) not null,
  content varchar(5000) not null,
  is_active boolean not null default true,
  likes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title varchar(160) not null,
  content varchar(1000) not null,
  icon varchar(100) default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key varchar(100) primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_order on public.categories("order");
create index if not exists idx_subcategories_category on public.subcategories(category_id, "order");
create index if not exists idx_services_subcategory on public.services(subcategory_id, "order");
create index if not exists idx_services_active_featured on public.services(is_active, is_featured);
create index if not exists idx_reviews_service on public.reviews(service_id, is_approved, created_at desc);
create index if not exists idx_posts_active on public.posts(is_active, created_at desc);
create index if not exists idx_announcements_active on public.announcements(is_active, created_at desc);

-- Atomic Like counter: prevents lost likes when multiple requests arrive together.
create or replace function public.increment_post_likes(post_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.posts
     set likes = likes + 1,
         updated_at = now()
   where id = post_id
     and is_active = true
  returning likes;
$$;

grant execute on function public.increment_post_likes(uuid) to anon, authenticated, service_role;

-- Default settings. The supplied logo/background are local project assets; the site
-- automatically uses them until an administrator uploads a custom logo.
insert into public.settings(key,value) values
('site_name','OMH Social Services'),
('whatsapp','9370000000'),
('telegram','https://t.me/OMHSocial'),
('facebook',''),
('instagram',''),
('footer_text','© 2026 OMH Social Services. تمامی حقوق محفوظ است.'),
('announcement',''),
('logo_url',''),
('favicon_url','')
on conflict (key) do nothing;

-- Admin account. Change this password immediately after first login.
insert into public.admins(username,password)
values ('admin', crypt('OMH@Admin2026!', gen_salt('bf', 12)))
on conflict (username) do nothing;

-- RLS is enabled so the public anon key cannot directly mutate these tables.
-- The Node backend uses the Service Role key, which bypasses RLS.
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.services enable row level security;
alter table public.reviews enable row level security;
alter table public.posts enable row level security;
alter table public.announcements enable row level security;
alter table public.settings enable row level security;

-- No public policies are intentionally created. All application access goes through server.js.
