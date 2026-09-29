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

-- OMH v3 multilingual + guides upgrade
alter table public.categories add column if not exists name_ps varchar(100) default '', add column if not exists name_en varchar(100) default '', add column if not exists description_ps varchar(500) default '', add column if not exists description_en varchar(500) default '';
alter table public.subcategories add column if not exists name_ps varchar(100) default '', add column if not exists name_en varchar(100) default '';
alter table public.services add column if not exists name_ps varchar(120) default '', add column if not exists name_en varchar(120) default '', add column if not exists description_ps varchar(2000) default '', add column if not exists description_en varchar(2000) default '', add column if not exists short_description_ps varchar(300) default '', add column if not exists short_description_en varchar(300) default '';

create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  title varchar(180) not null,
  title_ps varchar(180) default '',
  title_en varchar(180) default '',
  content varchar(5000) not null,
  content_ps varchar(5000) default '',
  content_en varchar(5000) default '',
  icon varchar(100) default '',
  "order" integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_guides_active_order on public.guides(is_active,"order");
alter table public.guides enable row level security;

insert into public.settings(key,value) values
('welcome_ticker_fa','به خدمات دیجیتال عمر مختار هاشمی خوش آمدید 🥀'),
('welcome_ticker_ps','د عمر مختار هاشمي ډیجیټل خدمتونو ته ښه راغلاست 🥀'),
('welcome_ticker_en','Welcome to Omar Mokhtar Hashemi Digital Services 🥀'),
('payment_text_fa','امکان پرداخت با کریدیت و مومو موجود است.'),
('payment_text_ps','د کریډیټ او مومو له لارې د پیسو ورکولو امکان شته.'),
('payment_text_en','Payment by credit and MoMo is available.')
on conflict (key) do nothing;

insert into public.guides(title,title_ps,title_en,content,content_ps,content_en,icon,"order") values
('شماره مجازی چیست؟','مجازی شمېره څه ده؟','What is a virtual number?','شماره مجازی یک شماره آنلاین است که برای ثبت‌نام یا استفاده از بعضی سرویس‌ها و پیام‌رسان‌ها استفاده می‌شود. قبل از خرید، کشور، نوع سرویس و امکان دریافت کد را با پشتیبانی بررسی کنید.','مجازی شمېره یوه آنلاین شمېره ده چې د ځینو خدمتونو او پیغام رسوونکو اپلیکېشنونو لپاره کارېږي. له اخیستلو مخکې هېواد، د خدمت ډول او د کوډ ترلاسه کولو امکان له ملاتړ سره تایید کړئ.','A virtual number is an online number used for registration or access to some services and messengers. Before buying, confirm the country, service type and code availability with support.','fa-solid fa-phone-volume',1),
('افزایش فالوور و ممبر چگونه است؟','د فالوور او ممبر زیاتول څنګه کېږي؟','How do follower and member services work?','این خدمات برای افزایش عددی فالوور، ممبر یا تعامل صفحات ارائه می‌شوند. نوع سرویس، کیفیت و سرعت تحویل متفاوت است؛ قبل از سفارش جزئیات سرویس را بخوانید.','دا خدمتونه د پاڼو د فالوور، ممبر یا تعامل د شمېر د زیاتولو لپاره دي. د خدمت ډول، کیفیت او سرعت توپیر لري؛ له امر مخکې د خدمت معلومات ولولئ.','These services increase follower, member or engagement counts. Delivery speed and quality vary by service, so read the service details before ordering.','fa-solid fa-chart-line',2),
('پریموم کردن برنامه‌ها','د اپلیکېشنونو پریمیم کول','Premium app services','برای بعضی برنامه‌ها مانند CapCut، Gemini و سرویس‌های مشابه، بسته‌های پریمیم ارائه می‌شود. شرایط هر برنامه متفاوت است و قبل از خرید باید مدت، نوع دسترسی و شرایط استفاده را بررسی کنید.','د CapCut، Gemini او ورته اپلیکېشنونو لپاره ځینې پریمیم خدمتونه وړاندې کېږي. د هر اپ شرایط توپیر لري؛ د اخیستلو مخکې موده، د لاسرسي ډول او شرایط وګورئ.','Premium packages may be available for apps such as CapCut, Gemini and similar services. Terms differ by app; check duration, access type and usage conditions before purchase.','fa-solid fa-crown',3),
('خدمات طراحی و دیجیتال','ډیزاین او ډیجیټل خدمتونه','Design & digital services','طراحی وب‌سایت، توسعه اپلیکیشن اندروید، طراحی تبلیغات تصویری و ساخت ویدیوهای تبلیغاتی از خدمات دیجیتال OMH است. برای پروژه‌های اختصاصی، نیازمندی‌ها را با پشتیبانی هماهنگ کنید.','د وېب‌سایټ ډیزاین، د اندروید اپ جوړول، تصویري اعلانونه او تبلیغاتي ویډیوګانې د OMH له ډیجیټل خدمتونو څخه دي. د ځانګړو پروژو لپاره اړتیاوې له ملاتړ سره شریکې کړئ.','Website design, Android app development, image advertising and promotional videos are part of OMH digital services. For custom projects, discuss requirements with support.','fa-solid fa-laptop-code',4),
('امنیت و اعتماد در سفارش','په امر کې امنیت او باور','Security & trust','امنیت و رضایت مشتری اولویت ماست. هیچ سرویس یا حسابی بدون توضیح شرایط نباید خریداری شود؛ اگر درباره یک سرویس سوال دارید، قبل از پرداخت از پشتیبانی بپرسید.','امنیت او د مشتری رضایت زموږ لومړیتوب دی. هېڅ خدمت یا حساب باید د شرایطو له پوهېدو پرته وانخیستل شي؛ که پوښتنه لرئ، له پیسو مخکې له ملاتړ سره اړیکه ونیسئ.','Customer security and satisfaction are priorities. Do not purchase a service or account without understanding its terms; ask support before payment if anything is unclear.','fa-solid fa-shield-halved',5)
on conflict do nothing;

-- If guides already existed, the insert above leaves them untouched.

alter table public.posts add column if not exists title_ps varchar(160) default '', add column if not exists title_en varchar(160) default '', add column if not exists content_ps varchar(5000) default '', add column if not exists content_en varchar(5000) default '';

-- Starter catalog for a fresh installation. Prices are 0 until the admin sets them.
insert into public.categories(name,name_ps,name_en,slug,icon,description,description_ps,description_en,"order")
select * from (values
('شماره‌های مجازی','مجازی شمېرې','Virtual Numbers','virtual-numbers','fa-solid fa-phone-volume','شماره‌های مجازی برای بعضی پیام‌رسان‌ها و سرویس‌های آنلاین.','د ځینو پیغام رسوونکو او آنلاین خدمتونو لپاره مجازي شمېرې.','Virtual numbers for selected messengers and online services.',1),
('پریموم برنامه‌ها','د اپلیکېشنونو پریمیم','Premium Apps','premium-apps','fa-solid fa-crown','خدمات پریموم برای برنامه‌ها و ابزارهای منتخب.','د غوره اپلیکېشنونو او وسیلو لپاره پریمیم خدمتونه.','Premium services for selected apps and tools.',2),
('شبکه‌های اجتماعی','ټولنیزې شبکې','Social Media','social-media','fa-solid fa-chart-line','خدمات فالوور، ممبر و رشد صفحات اجتماعی.','د ټولنیزو پاڼو د فالوور، ممبر او ودې خدمتونه.','Follower, member and social page growth services.',3),
('طراحی و خدمات دیجیتال','ډیزاین او ډیجیټل خدمتونه','Design & Digital','design-digital','fa-solid fa-laptop-code','طراحی وب‌سایت، اپلیکیشن، تبلیغات تصویری و ویدیویی.','وېب‌سایټ، اپ، تصویري او ویډیويي اعلانونه.','Website, app, image advertising and promotional video services.',4)
) as v(name,name_ps,name_en,slug,icon,description,description_ps,description_en,"order")
where not exists (select 1 from public.categories c where c.slug=v.slug);

insert into public.subcategories(category_id,name,name_ps,name_en,slug,icon,"order")
select c.id,v.name,v.name_ps,v.name_en,v.slug,v.icon,v."order" from (values
('virtual-numbers','واتساپ','واټساپ','WhatsApp','whatsapp','fa-brands fa-whatsapp',1),
('virtual-numbers','تلگرام','ټیلیګرام','Telegram','telegram','fa-brands fa-telegram',2),
('premium-apps','CapCut','CapCut','CapCut','capcut','fa-solid fa-video',1),
('premium-apps','Gemini و ابزارهای مشابه','Gemini او ورته وسیلې','Gemini & similar tools','gemini','fa-solid fa-wand-magic-sparkles',2),
('social-media','فیسبوک','فیسبوک','Facebook','facebook','fa-brands fa-facebook-f',1),
('social-media','اینستاگرام','انسټاګرام','Instagram','instagram','fa-brands fa-instagram',2),
('social-media','تلگرام','ټیلیګرام','Telegram','telegram-social','fa-brands fa-telegram',3),
('social-media','کانال واتساپ','واټساپ چینل','WhatsApp Channel','whatsapp-channel','fa-brands fa-whatsapp',4),
('design-digital','طراحی وب‌سایت','د وېب‌سایټ ډیزاین','Website Design','website','fa-solid fa-globe',1),
('design-digital','اپلیکیشن اندروید','اندروید اپ','Android App','android-app','fa-brands fa-android',2),
('design-digital','تبلیغات تصویری','تصویري اعلانونه','Image Advertising','image-ads','fa-solid fa-palette',3),
('design-digital','ویدیوهای تبلیغاتی','تبلیغاتي ویډیوګانې','Promotional Videos','video-ads','fa-solid fa-film',4)
) v(cat_slug,name,name_ps,name_en,slug,icon,"order")
join public.categories c on c.slug=v.cat_slug
where not exists (select 1 from public.subcategories s where s.slug=v.slug and s.category_id=c.id);

insert into public.services(subcategory_id,name,name_ps,name_en,slug,short_description,short_description_ps,short_description_en,price,"order")
select s.id,v.name,v.name_ps,v.name_en,v.slug,v.short_fa,v.short_ps,v.short_en,0,v."order" from (values
('whatsapp','شماره مجازی واتساپ','د واټساپ مجازي شمېره','WhatsApp Virtual Number','whatsapp-virtual-number','شماره مجازی برای واتساپ؛ قبل از سفارش کشور و نوع شماره را بپرسید.','د واټساپ لپاره مجازي شمېره؛ د امر مخکې هېواد او ډول وپوښتئ.','Virtual number for WhatsApp; confirm country and type before ordering.',1),
('telegram','شماره مجازی تلگرام','د ټیلیګرام مجازي شمېره','Telegram Virtual Number','telegram-virtual-number','شماره مجازی برای تلگرام و سرویس‌های منتخب.','د ټیلیګرام او غوره خدمتونو لپاره مجازي شمېره.','Virtual number for Telegram and selected services.',1),
('capcut','پریموم CapCut','د CapCut پریمیم','CapCut Premium','capcut-premium','دسترسی پریموم مطابق شرایط سرویس.','د خدمت د شرایطو مطابق پریمیم لاسرسی.','Premium access according to service terms.',1),
('gemini','پریموم Gemini','د Gemini پریمیم','Gemini Premium','gemini-premium','پریموم ابزارهای هوش مصنوعی مطابق پلن موجود.','د موجود پلان مطابق د AI وسیلو پریمیم.','Premium AI tool access according to the available plan.',1),
('facebook','فالوور فیسبوک','د فیسبوک فالوور','Facebook Followers','facebook-followers','خدمت افزایش فالوور صفحه فیسبوک.','د فیسبوک پاڼې د فالوور زیاتولو خدمت.','Facebook page follower growth service.',1),
('instagram','فالوور اینستاگرام','د انسټاګرام فالوور','Instagram Followers','instagram-followers','خدمت افزایش فالوور اینستاگرام.','د انسټاګرام د فالوور زیاتولو خدمت.','Instagram follower growth service.',1),
('telegram-social','ممبر کانال و گروپ تلگرام','د ټیلیګرام چینل او ګروپ ممبر','Telegram Members','telegram-members','افزایش ممبر کانال یا گروپ تلگرام.','د ټیلیګرام چینل یا ګروپ د ممبر زیاتول.','Telegram channel or group member growth.',1),
('whatsapp-channel','فالوور کانال واتساپ','د واټساپ چینل فالوور','WhatsApp Channel Followers','whatsapp-channel-followers','افزایش فالوور کانال واتساپ.','د واټساپ چینل د فالوور زیاتول.','WhatsApp channel follower growth.',1),
('website','طراحی وب‌سایت حرفه‌ای','مسلکي وېب‌سایټ ډیزاین','Professional Website Design','professional-website','طراحی سایت اختصاصی مطابق نیاز پروژه.','د پروژې د اړتیا مطابق ځانګړی وېب‌سایټ.','Custom website design based on project requirements.',1),
('android-app','طراحی و توسعه برنامه اندرویدی','د اندروید اپ ډیزاین او پراختیا','Android App Development','android-app-development','طراحی و توسعه اپلیکیشن اندروید.','د اندروید اپ ډیزاین او پراختیا.','Android app design and development.',1),
('image-ads','طراحی تبلیغات تصویری','د تصویري اعلانونو ډیزاین','Image Ad Design','image-ad-design','طراحی پوستر و تبلیغات تصویری برای صفحات و کسب‌وکارها.','د پاڼو او کاروبارونو لپاره د پوستر او تصویري اعلان ډیزاین.','Poster and image advertising design.',1),
('video-ads','طراحی ویدیوهای تبلیغاتی','د تبلیغاتي ویډیو ډیزاین','Promotional Video Design','promotional-video-design','ساخت ویدیوهای تبلیغاتی برای معرفی خدمات و محصولات.','د خدمتونو او محصولاتو د معرفي لپاره تبلیغاتي ویډیو.','Promotional videos for services and products.',1)
) v(sub_slug,name,name_ps,name_en,slug,short_fa,short_ps,short_en,"order")
join public.subcategories s on s.slug=v.sub_slug
where not exists (select 1 from public.services x where x.slug=v.slug);
