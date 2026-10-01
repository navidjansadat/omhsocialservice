# OMH Social Services — Final

نسخه نهایی بازسازی و یکپارچه‌شده OMH Social Services با تمرکز روی پایداری، امنیت، تجربه موبایل و مدیریت کامل محتوا.

## ساختار دیتابیس مورد استفاده
- `admins`
- `categories`
- `subcategories`
- `services`
- `reviews`
- `posts`
- `announcements`
- `settings`

## قابلیت‌ها
### سایت عمومی
- هدر ریسپانسیو و منوی واقعی موبایل
- Dark / Light Mode با ذخیره انتخاب کاربر
- لوگوی پیش‌فرض داخلی + امکان تعویض لوگو از پنل
- دسته‌بندی → زیردسته → سرویس
- جستجوی ترکیبی خدمات
- قیمت، تخفیف، واحد، زمان تحویل، گارانتی، تصویر و سرویس ویژه
- سفارش سرویس از طریق WhatsApp
- ثبت نظر مشتری با انتخاب سرویس و امتیاز؛ نظرها قبل از انتشار تأیید می‌شوند
- نشرات و Like
- اعلان‌های فعال در بالای سایت
- شبکه‌های اجتماعی قابل تنظیم
- طراحی موبایل و دسکتاپ متعادل

### پنل مدیریت
- ورود امن با session cookie و bcrypt
- محافظت APIهای مدیریتی
- rate limit برای ورود و عملیات نوشتن
- مدیریت دسته‌بندی، زیردسته، سرویس، نظرات، نشرات و اعلان‌ها
- آپلود و تعویض تصویر سرویس
- آپلود و حذف لوگو
- جستجو و فیلتر داخل پنل
- Dark / Light Mode برای پنل
- خطای یک بخش باعث از کار افتادن کل داشبورد نمی‌شود

## Render Environment Variables
```text
PORT=5000
NODE_ENV=production
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=omh-assets
FRONTEND_ORIGINS=https://YOUR_RENDER_DOMAIN.onrender.com
```

`SUPABASE_SERVICE_ROLE_KEY` را فقط در Render قرار دهید و هرگز در frontend یا GitHub منتشر نکنید.

## Storage
سرور هنگام اولین آپلود تلاش می‌کند Bucket با نام `omh-assets` را در صورت نبودن ایجاد کند. اگر پروژه Supabase اجازه ساخت Bucket از API را ندهد، از Supabase → Storage یک Bucket عمومی با همین نام بسازید.

## اجرا
```bash
npm install
npm start
```

سایت:
- `/`
- `/admin`
- `/admin/dashboard`
