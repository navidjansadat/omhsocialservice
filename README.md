# OMH Social Services — Final Complete Design

نسخه نهایی بازطراحی‌شده OMH Social Services با تمرکز روی ظاهر زنده، شلوغ اما منظم، تجربه موبایل، خدمات، نشرات، PDF و پنل مدیریت.

## صفحات عمومی
- `/` خانه با Hero تصویری، لوگوی دایره‌ای، بک‌گراند برند، انیمیشن، نوارهای متحرک و خدمات منتخب
- `/services.html` دسته‌بندی‌ها → انتخاب دسته → زیردسته → سرویس‌ها؛ بدون گزینه «همه خدمات»
- `/info.html` راهنمای خدمات بر اساس توضیحات قابل مدیریت سرویس‌ها
- `/posts.html` نشرات + بخش PDF؛ جلد PDF از صفحه اول فایل به‌صورت خودکار ساخته می‌شود
- `/contact.html` WhatsApp، Telegram، کانال‌ها، شبکه‌های اجتماعی و نظرات مشتریان

## طراحی
- پس‌زمینه‌های متحرک، نورهای شناور، orbit، ticker و marquee
- انیمیشن ورود بخش‌ها و کارت‌های شناور
- Dark / Light Mode
- RTL واقعی برای دری و پشتو و چیدمان مناسب English
- فوتر کامل چهاربخشی در دسکتاپ و ساختار کامل فشرده‌شده در موبایل
- لوگوی دایره‌ای اختصاصی و تصویر برند در Hero خانه
- آیکن سرویس در قاب استاندارد با `object-fit: contain` تا تصویر کشیده نشود
- طراحی Responsive برای موبایل، تبلت و دسکتاپ
- `prefers-reduced-motion` برای کاربرانی که حرکت کمتر را ترجیح می‌دهند

## خدمات
هر سرویس از پنل مدیریت قابل تنظیم است:
- نام، توضیح، توضیح کوتاه
- قیمت و تخفیف بر حسب AFN
- واحد، زمان تحویل، گارانتی
- تصویر سرویس
- آیکن پیش‌فرض هوشمند در صورت نبود تصویر
- فعال/غیرفعال و ویژه

## نشرات و PDF
- نشرات متنی از همان سیستم `posts` مدیریت می‌شوند.
- PDFها در Bucket جداگانه `omh-documents` ذخیره می‌شوند.
- جلد PDF از صفحه اول با PDF.js ساخته می‌شود و نیاز به آپلود جلد جداگانه نیست.
- مدیریت PDF در `/admin/documents.html` انجام می‌شود.

## دیتابیس
ساختار اصلی قبلی حفظ شده است:
- admins
- categories
- subcategories
- services
- reviews
- posts
- announcements
- settings

برای قابلیت PDF فایل `supabase-final-migration.sql` را یک بار در Supabase SQL Editor اجرا کنید. این فایل جدول `documents` و تنظیمات کانال‌ها را اضافه می‌کند و داده‌های قبلی را حذف نمی‌کند.

## Render
Environment Variables:
```text
PORT=5000
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=omh-assets
FRONTEND_ORIGINS=https://YOUR_RENDER_DOMAIN.onrender.com
```

برای PDF، سرور در صورت نبود Bucket تلاش می‌کند `omh-documents` را بسازد؛ در صورت محدودیت Supabase می‌توانید آن را دستی به‌صورت Public بسازید.

## اجرا
```bash
npm install
npm start
```

نکته: قبل از استفاده از PDF، `supabase-final-migration.sql` را اجرا کنید.
