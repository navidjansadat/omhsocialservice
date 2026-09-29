# OMH Social Services — Final Edition

نسخه بازطراحی‌شده و اصلاح‌شده OMH Social Services.

## تغییرات این نسخه

- طراحی سایت کاملاً بازطراحی شده با هویت آبی/نئونی OMH.
- لوگوی ارسالی در `public/images/omh-logo.png` قرار گرفته است.
- تصویر ارسالی دوم به‌عنوان پس‌زمینه Hero در `public/images/omh-background.png` قرار گرفته است.
- کارت هر سرویس قالب مستقل، مرتب و یکدست دارد.
- تصویر سرویس اگر توسط ادمین آپلود شود، داخل قاب استاندارد و بدون کشیدگی نمایش داده می‌شود.
- اگر تصویر سرویس وجود نداشته باشد، سایت بر اساس نام سرویس/دسته‌بندی یک آیکن واضح Font Awesome انتخاب می‌کند؛ Emoji دیگر برای کارت سرویس استفاده نمی‌شود.
- نسخه موبایل و دسکتاپ Responsive است.
- حالت تاریک پیش‌فرض و حالت روشن وجود دارد.
- پنل مدیریت قبلی حفظ شده و فایل قدیمی `public/admin/script.js` حذف شده است.
- SVG از آپلودهای کاربری حذف شده و فقط JPG/PNG/WEBP مجاز است.
- Backend دیگر با `SUPABASE_ANON_KEY` به‌عنوان fallback اجرا نمی‌شود؛ برای Backend باید `SUPABASE_SERVICE_ROLE_KEY` تنظیم شود.
- Like نشرات به تابع Atomic در PostgreSQL منتقل شده تا Likeهای همزمان از بین نروند.
- فایل `supabase-schema.sql` برای ساخت کامل جداول و تابع Like اضافه شده است.

## راه‌اندازی

1. در Supabase بخش SQL Editor، فایل `supabase-schema.sql` را یک بار اجرا کنید.
2. در Render/سرور، این متغیرها را تنظیم کنید:

```env
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=omh-assets
NODE_ENV=production
FRONTEND_ORIGINS=https://YOUR-RENDER-DOMAIN.onrender.com
```

3. پروژه را نصب و اجرا کنید:

```bash
npm install
npm start
```

4. ورود اولیه پنل:

```text
URL: /admin
Username: admin
Password: OMH@Admin2026!
```

**بعد از اولین ورود رمز عبور را تغییر دهید.**

## تصاویر سرویس

در پنل مدیریت → سرویس‌ها → افزودن/ویرایش سرویس، تصویر JPG/PNG/WEBP آپلود کنید. سایت تصویر را در قاب ثابت و متناسب نمایش می‌دهد. اگر تصویر حذف یا آپلود نشود، آیکن خودکار بر اساس نوع سرویس نمایش داده می‌شود.

## نکته امنیتی

`SUPABASE_SERVICE_ROLE_KEY` را هیچ‌وقت داخل Frontend، GitHub عمومی یا فایل‌های `public/` قرار ندهید.
