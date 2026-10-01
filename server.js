import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';

if (!SUPABASE_URL || !SUPABASE_KEY) console.warn('⚠️ SUPABASE_URL and a Supabase key are required.');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const defaultOrigins = [
  `http://localhost:${PORT}`,
  'http://localhost:3000',
  'https://omhservices-laig.onrender.com'
];
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || defaultOrigins.join(','))
    .split(',').map(v => v.trim()).filter(Boolean)
);

const publicSettings = new Set([
  'site_name','whatsapp','telegram','facebook','instagram','footer_text',
  'announcement','logo_url','favicon_url'
]);

function stringValue(value, max = 1000, required = false) {
  if (typeof value !== 'string') return required ? null : '';
  const v = value.trim();
  return required && !v ? null : v.slice(0, max);
}
function numberValue(value, { min = -Infinity, max = Infinity, integer = false, fallback = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return fallback;
  return n;
}
function boolValue(value, fallback = false) { return typeof value === 'boolean' ? value : fallback; }
function urlValue(value) {
  if (!value) return '';
  try {
    const u = new URL(String(value));
    return ['https:', 'http:'].includes(u.protocol) ? u.toString().slice(0, 1000) : '';
  } catch { return ''; }
}
function slugValue(value) {
  return stringValue(value, 120).toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_\u0600-\u06ff]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
function idValue(value) { return typeof value === 'string' && value.length <= 100 ? value : null; }
function fail(res, status, message) { return res.status(status).json({ error: message }); }
function safeError(error) { console.error(error); return 'خطای داخلی سرور'; }
function rows(data) { return Array.isArray(data) ? data : []; }

const settingValidators = {
  site_name: v => stringValue(v, 100),
  whatsapp: v => stringValue(v, 30),
  telegram: v => urlValue(v),
  facebook: v => urlValue(v),
  instagram: v => urlValue(v),
  footer_text: v => stringValue(v, 500),
  announcement: v => stringValue(v, 500),
  logo_url: v => urlValue(v),
  favicon_url: v => urlValue(v)
};

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const hostOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin && (allowedOrigins.has(origin) || origin === hostOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'تعداد تلاش‌های ورود زیاد است. چند دقیقه بعد دوباره امتحان کنید.' }
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120,
  standardHeaders: true, legacyHeaders: false
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.mimetype))
});

async function getAdmin(req) {
  const token = req.cookies?.admin_session;
  if (!token) return null;
  const { data, error } = await supabase
    .from('admins')
    .select('id,username,session_expiry')
    .eq('session_token', token)
    .gt('session_expiry', new Date().toISOString())
    .maybeSingle();
  return error || !data ? null : data;
}
async function requireAdmin(req, res, next) {
  try {
    const admin = await getAdmin(req);
    if (!admin) return fail(res, 401, 'نشست ادمین معتبر نیست.');
    req.admin = admin;
    next();
  } catch { return fail(res, 401, 'نشست ادمین معتبر نیست.'); }
}

async function storageRemoveByUrl(url) {
  if (!url || !SUPABASE_URL) return;
  try {
    const parsed = new URL(url);
    const marker = '/storage/v1/object/public/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return;
    const rest = parsed.pathname.slice(idx + marker.length);
    const slash = rest.indexOf('/');
    if (slash === -1) return;
    await supabase.storage.from(rest.slice(0, slash)).remove([rest.slice(slash + 1)]);
  } catch (e) { console.warn('Storage cleanup failed:', e.message); }
}

let storageReady = new Set();
async function ensureStorageBucket(bucket) {
  if (storageReady.has(bucket)) return;
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (!listError && existing?.some(b => b.name === bucket)) {
    storageReady.add(bucket); return;
  }
  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
  });
  if (error && !/already exists|duplicate/i.test(error.message || '')) throw error;
  storageReady.add(bucket);
}

async function uploadImage(req, res) {
  if (!req.file) return fail(res, 400, 'فایل تصویر ارسال نشده یا فرمت آن مجاز نیست.');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'omh-assets';
  const extMap = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'};
  const ext = extMap[req.file.mimetype];
  if (!ext) return fail(res, 400, 'فرمت تصویر مجاز نیست.');
  try {
    await ensureStorageBucket(bucket);
    const folder = stringValue(req.body.folder, 40) || 'uploads';
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
    const objectPath = `${safeFolder}/${uuidv4()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype, cacheControl: '31536000', upsert: false
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    if (!data?.publicUrl) throw new Error('Public URL was not created');
    return res.status(201).json({ url: data.publicUrl, path: objectPath });
  } catch (e) {
    console.error('Storage upload failed:', e);
    return fail(res, 500, 'آپلود انجام نشد. در Render مقدار SUPABASE_SERVICE_ROLE_KEY و در Supabase بخش Storage را بررسی کنید.');
  }
}

function servicePayload(body) {
  return {
    subcategory_id: idValue(body?.subcategory_id),
    name: stringValue(body?.name, 120, true),
    slug: slugValue(body?.slug || body?.name),
    description: stringValue(body?.description, 2000),
    short_description: stringValue(body?.short_description, 300),
    price: numberValue(body?.price, { min: 0, max: 1e9 }),
    discount: numberValue(body?.discount, { min: 0, max: 100 }),
    unit: stringValue(body?.unit, 50),
    image: urlValue(body?.image),
    icon: stringValue(body?.icon, 100),
    delivery_time: stringValue(body?.delivery_time, 100),
    guarantee: stringValue(body?.guarantee, 200),
    is_active: boolValue(body?.is_active, true),
    is_featured: boolValue(body?.is_featured, false),
    order: numberValue(body?.order, { min: 0, max: 999999, integer: true })
  };
}

app.get('/', (_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/admin', (_req,res)=>res.sendFile(path.join(__dirname,'public','admin','index.html')));
app.get('/admin/dashboard', (_req,res)=>res.sendFile(path.join(__dirname,'public','admin','dashboard.html')));
app.get('/api/health', (_req,res)=>res.json({status:'OK',message:'Server is running!'}));

// Authentication
app.post('/api/admin/login', loginLimiter, async (req,res)=>{
  try {
    const username=stringValue(req.body?.username,80,true);
    const password=typeof req.body?.password==='string'?req.body.password:'';
    if(!username||!password||password.length>200) return fail(res,400,'نام کاربری و رمز عبور الزامی است.');
    const {data:admin,error}=await supabase.from('admins').select('*').eq('username',username).maybeSingle();
    if(error||!admin) return fail(res,401,'اطلاعات ورود نادرست است.');
    const stored=String(admin.password||'');
    let valid=false;
    if(/^\$2[aby]\$/.test(stored)) valid=await bcrypt.compare(password,stored);
    else {
      const a=Buffer.from(stored), b=Buffer.from(password);
      valid=a.length===b.length && crypto.timingSafeEqual(a,b);
    }
    if(!valid) return fail(res,401,'اطلاعات ورود نادرست است.');
    const token=crypto.randomBytes(48).toString('hex');
    const expiry=new Date(Date.now()+24*60*60*1000).toISOString();
    const patch={session_token:token,session_expiry:expiry,last_login:new Date().toISOString()};
    if(!/^\$2[aby]\$/.test(stored)) patch.password=await bcrypt.hash(password,12);
    const {error:updateError}=await supabase.from('admins').update(patch).eq('id',admin.id);
    if(updateError) return fail(res,500,'ایجاد نشست ورود انجام نشد.');
    res.cookie('admin_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:24*60*60*1000,path:'/'});
    res.json({message:'ورود موفق',username:admin.username});
  }catch(e){fail(res,500,safeError(e));}
});
app.get('/api/admin/check',async(req,res)=>{const admin=await getAdmin(req);if(!admin)return fail(res,401,'نشست ادمین معتبر نیست.');res.json({authenticated:true,username:admin.username});});
app.post('/api/admin/logout',async(req,res)=>{try{const token=req.cookies?.admin_session;if(token)await supabase.from('admins').update({session_token:null,session_expiry:null}).eq('session_token',token);}finally{res.clearCookie('admin_session',{path:'/'});res.json({message:'خروج موفق'});}});

// Public content
app.get('/api/categories',async(_req,res)=>{try{const {data,error}=await supabase.from('categories').select('*').eq('is_active',true).order('order',{ascending:true});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.get('/api/subcategories',async(_req,res)=>{try{const {data,error}=await supabase.from('subcategories').select('*, categories(id,name,slug)').eq('is_active',true).order('order',{ascending:true});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.get('/api/categories/:id',async(req,res)=>{try{const id=idValue(req.params.id);const {data:category,error}=await supabase.from('categories').select('*').eq('id',id).eq('is_active',true).maybeSingle();if(error||!category)return fail(res,404,'دسته‌بندی پیدا نشد.');const {data:subs,error:subError}=await supabase.from('subcategories').select('*').eq('category_id',id).eq('is_active',true).order('order',{ascending:true});if(subError)throw subError;res.json({...category,subcategories:rows(subs)});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/subcategories/:id',async(req,res)=>{try{const id=idValue(req.params.id);const {data:sub,error}=await supabase.from('subcategories').select('*').eq('id',id).eq('is_active',true).maybeSingle();if(error||!sub)return fail(res,404,'زیردسته پیدا نشد.');const {data:services,error:serviceError}=await supabase.from('services').select('*').eq('subcategory_id',id).eq('is_active',true).order('order',{ascending:true});if(serviceError)throw serviceError;res.json({...sub,services:rows(services)});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/services',async(req,res)=>{
  try{
    const search=stringValue(req.query.search,100).toLowerCase();
    const categoryId=idValue(req.query.categoryId);
    const subcategoryId=idValue(req.query.subcategoryId);
    const featured=req.query.featured==='true';
    let subIds=null;
    if(categoryId&&categoryId!=='all'){
      const {data:subs,error}=await supabase.from('subcategories').select('id').eq('category_id',categoryId).eq('is_active',true);
      if(error)throw error; subIds=(subs||[]).map(s=>s.id); if(!subIds.length)return res.json([]);
    }
    let q=supabase.from('services').select('*, subcategories(id,name,slug,category_id,categories(id,name,slug))').eq('is_active',true).order('order',{ascending:true});
    if(subcategoryId&&subcategoryId!=='all')q=q.eq('subcategory_id',subcategoryId); else if(subIds)q=q.in('subcategory_id',subIds);
    if(featured)q=q.eq('is_featured',true);
    if(search.length>=1)q=q.or(`name.ilike.%${search}%,description.ilike.%${search}%,short_description.ilike.%${search}%`);
    const {data,error}=await q;if(error)throw error;res.json(rows(data));
  }catch(e){fail(res,500,safeError(e));}
});
app.get('/api/services/:id',async(req,res)=>{try{const id=idValue(req.params.id);const {data,error}=await supabase.from('services').select('*, subcategories(id,name,slug,category_id,categories(id,name,slug))').eq('id',id).eq('is_active',true).maybeSingle();if(error||!data)return fail(res,404,'سرویس پیدا نشد.');const current=numberValue(data.views,{min:0,integer:true});await supabase.from('services').update({views:current+1}).eq('id',id);res.json({...data,views:current+1});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/reviews',async(req,res)=>{try{let q=supabase.from('reviews').select('*').eq('is_approved',true).order('created_at',{ascending:false});if(req.query.serviceId)q=q.eq('service_id',idValue(req.query.serviceId));const {data,error}=await q;if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.post('/api/reviews',writeLimiter,async(req,res)=>{try{const service_id=idValue(req.body?.service_id);const customer_name=stringValue(req.body?.customer_name,80,true);const comment=stringValue(req.body?.comment,1000,true);const rating=numberValue(req.body?.rating,{min:1,max:5,integer:true,fallback:0});if(!service_id||!customer_name||!comment||!rating)return fail(res,400,'نام، امتیاز، متن نظر و سرویس الزامی است.');const {data:service}=await supabase.from('services').select('id').eq('id',service_id).eq('is_active',true).maybeSingle();if(!service)return fail(res,404,'سرویس پیدا نشد.');const {data,error}=await supabase.from('reviews').insert({service_id,customer_name,rating,comment,is_approved:false}).select().single();if(error)throw error;res.status(201).json({message:'نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.',data});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/posts',async(_req,res)=>{try{const {data,error}=await supabase.from('posts').select('*').eq('is_active',true).order('created_at',{ascending:false});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.post('/api/posts/:id/like',writeLimiter,async(req,res)=>{try{const id=idValue(req.params.id);const {data:post,error:getError}=await supabase.from('posts').select('likes').eq('id',id).eq('is_active',true).maybeSingle();if(getError||!post)return fail(res,404,'نشر پیدا نشد.');const likes=numberValue(post.likes,{min:0,integer:true})+1;const {data,error}=await supabase.from('posts').update({likes}).eq('id',id).select().single();if(error)throw error;res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.get('/api/announcements',async(_req,res)=>{try{const {data,error}=await supabase.from('announcements').select('*').eq('is_active',true).order('created_at',{ascending:false});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.get('/api/settings',async(_req,res)=>{try{const {data,error}=await supabase.from('settings').select('key,value');if(error)throw error;const out={};for(const item of data||[])if(publicSettings.has(item.key))out[item.key]=item.value;res.json(out);}catch(e){fail(res,500,safeError(e));}});

// Admin APIs
app.get('/api/admin/stats',requireAdmin,async(_req,res)=>{try{const results=await Promise.all([supabase.from('categories').select('id',{count:'exact',head:true}),supabase.from('subcategories').select('id',{count:'exact',head:true}),supabase.from('services').select('id',{count:'exact',head:true}),supabase.from('reviews').select('id',{count:'exact',head:true}).eq('is_approved',true),supabase.from('reviews').select('id',{count:'exact',head:true}).eq('is_approved',false),supabase.from('posts').select('id',{count:'exact',head:true})]);for(const r of results)if(r.error)throw r.error;res.json({totalCategories:results[0].count||0,totalSubcategories:results[1].count||0,totalServices:results[2].count||0,totalReviews:results[3].count||0,pendingReviews:results[4].count||0,totalPosts:results[5].count||0});}catch(e){fail(res,500,safeError(e));}});
app.post('/api/admin/upload',requireAdmin,writeLimiter,upload.single('file'),async(req,res)=>{try{await uploadImage(req,res);}catch(e){fail(res,500,safeError(e));}});
app.get('/api/admin/categories',requireAdmin,async(_req,res)=>{try{const {data,error}=await supabase.from('categories').select('*').order('order',{ascending:true});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.post('/api/categories',requireAdmin,writeLimiter,async(req,res)=>{try{const name=stringValue(req.body?.name,100,true);if(!name)return fail(res,400,'نام دسته‌بندی الزامی است.');const row={name,slug:slugValue(req.body?.slug||name),icon:stringValue(req.body?.icon,50),description:stringValue(req.body?.description,500),is_active:boolValue(req.body?.is_active,true),order:numberValue(req.body?.order,{min:0,max:999999,integer:true})};const {data,error}=await supabase.from('categories').insert(row).select().single();if(error)throw error;res.status(201).json(data);}catch(e){fail(res,500,safeError(e));}});
app.put('/api/categories/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const row={name:stringValue(req.body?.name,100,true),slug:slugValue(req.body?.slug||req.body?.name),icon:stringValue(req.body?.icon,50),description:stringValue(req.body?.description,500),is_active:boolValue(req.body?.is_active,true),order:numberValue(req.body?.order,{min:0,max:999999,integer:true})};if(!row.name)return fail(res,400,'نام دسته‌بندی الزامی است.');const {data,error}=await supabase.from('categories').update(row).eq('id',idValue(req.params.id)).select().single();if(error)throw error;res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.delete('/api/categories/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const id=idValue(req.params.id);const {data:subs}=await supabase.from('subcategories').select('id').eq('category_id',id).limit(1);if(subs?.length)return fail(res,409,'این دسته‌بندی زیردسته دارد. ابتدا آن‌ها را حذف یا جابه‌جا کنید.');const {error}=await supabase.from('categories').delete().eq('id',id);if(error)throw error;res.json({message:'حذف شد'});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/admin/subcategories',requireAdmin,async(_req,res)=>{try{const {data,error}=await supabase.from('subcategories').select('*, categories(id,name,slug)').order('order',{ascending:true});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.post('/api/subcategories',requireAdmin,writeLimiter,async(req,res)=>{try{const name=stringValue(req.body?.name,100,true),category_id=idValue(req.body?.category_id);if(!name||!category_id)return fail(res,400,'دسته‌بندی و نام الزامی است.');const row={category_id,name,slug:slugValue(req.body?.slug||name),icon:stringValue(req.body?.icon,50),is_active:boolValue(req.body?.is_active,true),order:numberValue(req.body?.order,{min:0,max:999999,integer:true})};const {data,error}=await supabase.from('subcategories').insert(row).select().single();if(error)throw error;res.status(201).json(data);}catch(e){fail(res,500,safeError(e));}});
app.put('/api/subcategories/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const row={category_id:idValue(req.body?.category_id),name:stringValue(req.body?.name,100,true),slug:slugValue(req.body?.slug||req.body?.name),icon:stringValue(req.body?.icon,50),is_active:boolValue(req.body?.is_active,true),order:numberValue(req.body?.order,{min:0,max:999999,integer:true})};if(!row.name||!row.category_id)return fail(res,400,'دسته‌بندی و نام الزامی است.');const {data,error}=await supabase.from('subcategories').update(row).eq('id',idValue(req.params.id)).select().single();if(error)throw error;res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.delete('/api/subcategories/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const id=idValue(req.params.id);const {data:services}=await supabase.from('services').select('id').eq('subcategory_id',id).limit(1);if(services?.length)return fail(res,409,'این زیردسته سرویس دارد. ابتدا سرویس‌ها را جابه‌جا یا حذف کنید.');const {error}=await supabase.from('subcategories').delete().eq('id',id);if(error)throw error;res.json({message:'حذف شد'});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/admin/services',requireAdmin,async(_req,res)=>{try{const {data,error}=await supabase.from('services').select('*, subcategories(id,name,slug,category_id,categories(id,name,slug))').order('order',{ascending:true});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.post('/api/services',requireAdmin,writeLimiter,async(req,res)=>{try{const row=servicePayload(req.body);if(!row.name||!row.subcategory_id)return fail(res,400,'زیردسته و نام سرویس الزامی است.');const {data,error}=await supabase.from('services').insert(row).select().single();if(error)throw error;res.status(201).json(data);}catch(e){fail(res,500,safeError(e));}});
app.put('/api/services/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const id=idValue(req.params.id);const {data:old}=await supabase.from('services').select('image').eq('id',id).maybeSingle();const row=servicePayload(req.body);if(req.body?.remove_image===true)row.image='';if(!row.name||!row.subcategory_id)return fail(res,400,'زیردسته و نام سرویس الزامی است.');const {data,error}=await supabase.from('services').update(row).eq('id',id).select().single();if(error)throw error;if(old?.image&&old.image!==row.image)await storageRemoveByUrl(old.image);res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.delete('/api/services/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const id=idValue(req.params.id);const {data:old}=await supabase.from('services').select('image').eq('id',id).maybeSingle();const {error}=await supabase.from('services').delete().eq('id',id);if(error)throw error;if(old?.image)await storageRemoveByUrl(old.image);res.json({message:'حذف شد'});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/admin/reviews',requireAdmin,async(_req,res)=>{try{const {data,error}=await supabase.from('reviews').select('*').order('created_at',{ascending:false});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.put('/api/reviews/:id/approve',requireAdmin,writeLimiter,async(req,res)=>{try{const {data,error}=await supabase.from('reviews').update({is_approved:true}).eq('id',idValue(req.params.id)).select().single();if(error)throw error;res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.put('/api/reviews/:id/reject',requireAdmin,writeLimiter,async(req,res)=>{try{const {data,error}=await supabase.from('reviews').update({is_approved:false}).eq('id',idValue(req.params.id)).select().single();if(error)throw error;res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.delete('/api/reviews/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const {error}=await supabase.from('reviews').delete().eq('id',idValue(req.params.id));if(error)throw error;res.json({message:'حذف شد'});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/admin/posts',requireAdmin,async(_req,res)=>{try{const {data,error}=await supabase.from('posts').select('*').order('created_at',{ascending:false});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.post('/api/posts',requireAdmin,writeLimiter,async(req,res)=>{try{const title=stringValue(req.body?.title,160,true),content=stringValue(req.body?.content,5000,true);if(!title||!content)return fail(res,400,'عنوان و متن الزامی است.');const {data,error}=await supabase.from('posts').insert({title,content,is_active:boolValue(req.body?.is_active,true),likes:0}).select().single();if(error)throw error;res.status(201).json(data);}catch(e){fail(res,500,safeError(e));}});
app.put('/api/posts/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const title=stringValue(req.body?.title,160,true),content=stringValue(req.body?.content,5000,true);if(!title||!content)return fail(res,400,'عنوان و متن الزامی است.');const {data,error}=await supabase.from('posts').update({title,content,is_active:boolValue(req.body?.is_active,true)}).eq('id',idValue(req.params.id)).select().single();if(error)throw error;res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.delete('/api/posts/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const {error}=await supabase.from('posts').delete().eq('id',idValue(req.params.id));if(error)throw error;res.json({message:'حذف شد'});}catch(e){fail(res,500,safeError(e));}});
app.get('/api/admin/announcements',requireAdmin,async(_req,res)=>{try{const {data,error}=await supabase.from('announcements').select('*').order('created_at',{ascending:false});if(error)throw error;res.json(rows(data));}catch(e){fail(res,500,safeError(e));}});
app.post('/api/announcements',requireAdmin,writeLimiter,async(req,res)=>{try{const row={title:stringValue(req.body?.title,160,true),content:stringValue(req.body?.content,1000,true),icon:stringValue(req.body?.icon,50),is_active:boolValue(req.body?.is_active,true)};if(!row.title||!row.content)return fail(res,400,'عنوان و متن الزامی است.');const {data,error}=await supabase.from('announcements').insert(row).select().single();if(error)throw error;res.status(201).json(data);}catch(e){fail(res,500,safeError(e));}});
app.put('/api/announcements/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const row={title:stringValue(req.body?.title,160,true),content:stringValue(req.body?.content,1000,true),icon:stringValue(req.body?.icon,50),is_active:boolValue(req.body?.is_active,true)};if(!row.title||!row.content)return fail(res,400,'عنوان و متن الزامی است.');const {data,error}=await supabase.from('announcements').update(row).eq('id',idValue(req.params.id)).select().single();if(error)throw error;res.json(data);}catch(e){fail(res,500,safeError(e));}});
app.delete('/api/announcements/:id',requireAdmin,writeLimiter,async(req,res)=>{try{const {error}=await supabase.from('announcements').delete().eq('id',idValue(req.params.id));if(error)throw error;res.json({message:'حذف شد'});}catch(e){fail(res,500,safeError(e));}});
app.put('/api/settings',requireAdmin,writeLimiter,async(req,res)=>{try{const updates=req.body&&typeof req.body==='object'?req.body:{};const accepted=Object.entries(updates).filter(([key])=>publicSettings.has(key));if(!accepted.length)return fail(res,400,'تنظیمات معتبر نیست.');let previousLogo='';if(accepted.some(([key])=>key==='logo_url')){const {data}=await supabase.from('settings').select('value').eq('key','logo_url').maybeSingle();previousLogo=data?.value||'';}const payload=accepted.map(([key,raw])=>({key,value:settingValidators[key]?settingValidators[key](raw):stringValue(raw,1000)}));const {error}=await supabase.from('settings').upsert(payload,{onConflict:'key'});if(error)throw error;const newLogo=updates.logo_url?String(updates.logo_url):'';if(previousLogo&&previousLogo!==newLogo)await storageRemoveByUrl(previousLogo);res.json({message:'تنظیمات ذخیره شد.'});}catch(e){fail(res,500,safeError(e));}});

app.use((err,_req,res,_next)=>{console.error(err);if(!res.headersSent)res.status(500).json({error:'خطای داخلی سرور'});});
app.listen(PORT,()=>console.log(`✅ OMH server running on port ${PORT}`));
