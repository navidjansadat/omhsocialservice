'use strict';

/* ============================================================
   STATE
   ============================================================ */
let allCategories = [];
let allSubcategories = [];
let allServices = [];
let currentCategoryId = 'all';
let currentSubcategoryId = 'all';
let currentSettings = {};
let manualAnnouncement = null;
let searchTimer = null;

const $ = id => document.getElementById(id);

/* ============================================================
   HELPERS
   ============================================================ */
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[c]));

const money = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const normalize = s => String(s ?? '')
  .toLowerCase()
  .replace(/ي/g, 'ی')
  .replace(/ك/g, 'ک')
  .replace(/\u200c/g, ' ')
  .trim();

async function api(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'خطا در ارتباط با سرور');
  return data;
}

function safeUrl(value) {
  try {
    const u = new URL(String(value));
    return ['https:', 'http:', 'tel:', 'mailto:'].includes(u.protocol) ? u.toString() : '#';
  } catch { return '#'; }
}

/* ============================================================
   TOAST
   ============================================================ */
function toast(message, type = 'info', duration = 3500) {
  const container = $('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span></span>`;
  el.querySelector('span').textContent = message;
  container.append(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

/* ============================================================
   WHATSAPP
   ============================================================ */
function whatsappUrl(message = 'سلام، من از سایت OMH Social Services با شما تماس می‌گیرم.') {
  const n = String(currentSettings.whatsapp || '9370000000').replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

function openWhatsApp(message) {
  const w = window.open(whatsappUrl(message), '_blank', 'noopener,noreferrer');
  if (w) w.opener = null;
}

/* ============================================================
   LINKS / LOGO
   ============================================================ */
function setLink(id, value) {
  const el = $(id);
  if (!el) return;
  const url = safeUrl(value);
  if (url === '#') { el.hidden = true; return; }
  el.href = url;
  el.hidden = false;
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
}

function setLogo(url) {
  document.querySelectorAll('[data-site-logo], #headerLogo').forEach(img => {
    const fallback = img.dataset.siteLogoFallback || 'images/omh-logo.svg';
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    img.src = url || fallback;
  });
}

/* ============================================================
   SETTINGS
   ============================================================ */
async function loadSettings() {
  try {
    currentSettings = await api('/api/settings');
    const s = currentSettings;

    if (s.site_name) document.title = `${s.site_name} | خدمات دیجیتال`;
    document.querySelectorAll('[data-site-name]').forEach(el => {
      el.textContent = s.site_name || 'OMH Social Services';
    });
    document.querySelectorAll('[data-footer-text]').forEach(el => {
      el.textContent = s.footer_text || `© ${new Date().getFullYear()} OMH Social Services. تمامی حقوق محفوظ است.`;
    });

    setLogo(s.logo_url);

    setLink('telegramLink', s.telegram);
    setLink('facebookLink', s.facebook);
    setLink('instagramLink', s.instagram);
    setLink('footerTelegram', s.telegram);
    setLink('footerFacebook', s.facebook);
    setLink('footerInstagram', s.instagram);

    manualAnnouncement = s.announcement?.trim() || null;
  } catch (e) {
    console.warn('settings', e);
  }
}

/* ============================================================
   ANNOUNCEMENTS
   ============================================================ */
function showAnnouncement(rows) {
  const box = $('announcementList');
  if (!box) return;
  box.replaceChildren();
  if (!rows.length) { box.hidden = true; return; }
  rows.slice(0, 4).forEach(a => {
    const item = document.createElement('div');
    item.className = 'announcement-item';

    const icon = document.createElement('span');
    icon.className = 'announcement-icon';
    icon.textContent = a.icon || '📢';

    const wrap = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = a.title || 'اعلان';
    const content = document.createElement('span');
    content.textContent = a.content || '';

    wrap.append(title, content);
    item.append(icon, wrap);
    box.append(item);
  });
  box.hidden = false;
}

async function loadAnnouncements() {
  try {
    const rows = await api('/api/announcements');
    const all = [
      ...(manualAnnouncement ? [{ title: 'اعلان', content: manualAnnouncement, icon: '📢' }] : []),
      ...(Array.isArray(rows) ? rows : [])
    ];
    if (all.length) showAnnouncement(all);
  } catch (e) {
    if (manualAnnouncement) {
      showAnnouncement([{ title: 'اعلان', content: manualAnnouncement, icon: '📢' }]);
    }
  }
}

/* ============================================================
   CATEGORIES / SUBCATEGORIES
   ============================================================ */
function renderCategories() {
  const box = $('categoryTabs');
  if (!box) return;
  box.replaceChildren();

  const make = (id, label, icon = '📋') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.role = 'tab';
    b.className = currentCategoryId === id ? 'active' : '';
    b.textContent = `${icon} ${label}`;
    b.addEventListener('click', () => {
      currentCategoryId = id;
      currentSubcategoryId = 'all';
      renderCategories();
      renderSubcategories();
      applyFilters();
    });
    return b;
  };

  box.append(make('all', 'همه', '📋'));
  allCategories.forEach(c => box.append(make(c.id, c.name, c.icon || '📂')));
}

function renderSubcategories() {
  const box = $('subcategoryTabs');
  if (!box) return;
  box.replaceChildren();

  const list = currentCategoryId === 'all'
    ? allSubcategories
    : allSubcategories.filter(s => s.category_id === currentCategoryId);

  if (!list.length) {
    const p = document.createElement('span');
    p.className = 'empty-message';
    p.textContent = 'برای این دسته زیردسته‌ای موجود نیست.';
    box.append(p);
    return;
  }

  const all = document.createElement('button');
  all.type = 'button';
  all.className = currentSubcategoryId === 'all' ? 'active' : '';
  all.textContent = '📁 همه';
  all.addEventListener('click', () => {
    currentSubcategoryId = 'all';
    renderSubcategories();
    applyFilters();
  });
  box.append(all);

  list.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = currentSubcategoryId === s.id ? 'active' : '';
    b.textContent = `${s.icon || '📁'} ${s.name}`;
    b.addEventListener('click', () => {
      currentSubcategoryId = s.id;
      renderSubcategories();
      applyFilters();
    });
    box.append(b);
  });
}

/* ============================================================
   FILTER / RENDER SERVICES
   ============================================================ */
function applyFilters() {
  const q = normalize($('searchInput')?.value || '');
  let list = allServices.filter(s =>
    currentCategoryId === 'all' || s.subcategories?.category_id === currentCategoryId
  );
  if (currentSubcategoryId !== 'all') {
    list = list.filter(s => s.subcategory_id === currentSubcategoryId);
  }
  if (q) {
    list = list.filter(s => [
      s.name, s.description, s.short_description,
      s.subcategories?.name, s.subcategories?.categories?.name
    ].some(v => normalize(v).includes(q)));
  }
  renderServices(list);
}

function serviceImage(service) {
  if (service.image) {
    const img = document.createElement('img');
    img.src = service.image;
    img.alt = service.name || 'سرویس';
    img.loading = 'lazy';
    img.onerror = () => {
      img.onerror = null;
      const span = document.createElement('span');
      span.textContent = service.icon || '📱';
      img.replaceWith(span);
    };
    return img;
  }
  const span = document.createElement('span');
  span.textContent = service.icon || '📱';
  return span;
}

function renderServices(list) {
  const grid = $('servicesGrid');
  if (!grid) return;
  grid.replaceChildren();
  grid.setAttribute('aria-busy', 'false');

  if (!list.length) {
    const d = document.createElement('div');
    d.className = 'empty-message';
    d.textContent = 'هیچ سرویسی مطابق جستجو پیدا نشد.';
    grid.append(d);
    return;
  }

  list.forEach(s => {
    const price = Number(s.price || 0);
    const discount = Math.min(100, Math.max(0, Number(s.discount || 0)));
    const final = discount ? price - (price * discount / 100) : price;

    const card = document.createElement('article');
    card.className = 'service-card';

    const media = document.createElement('div');
    media.className = 'service-media';
    media.append(serviceImage(s));

    const h = document.createElement('h4');
    h.textContent = s.name || '';

    const path = document.createElement('div');
    path.className = 'service-path';
    path.textContent = [s.subcategories?.categories?.name, s.subcategories?.name].filter(Boolean).join(' / ');

    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = s.short_description || s.description || 'خدمات دیجیتال';

    const priceBox = document.createElement('div');
    priceBox.className = 'price';
    priceBox.textContent = `${money(final)} AFN`;
    if (discount) {
      const old = document.createElement('span');
      old.className = 'old';
      old.textContent = `${money(price)} AFN`;
      const dis = document.createElement('span');
      dis.className = 'discount';
      dis.textContent = `-${discount}%`;
      priceBox.append(old, dis);
    }

    const meta = document.createElement('div');
    meta.className = 'meta';

    const views = document.createElement('span');
    views.className = 'views';
    const eyeIcon = document.createElement('i');
    eyeIcon.className = 'fa-solid fa-eye';
    const viewsText = document.createElement('span');
    viewsText.textContent = Number(s.views || 0).toLocaleString();
    views.append(eyeIcon, viewsText);

    const order = document.createElement('button');
    order.type = 'button';
    order.className = 'order-btn';
    const cartIcon = document.createElement('i');
    cartIcon.className = 'fa-solid fa-cart-shopping';
    const orderText = document.createElement('span');
    orderText.textContent = 'سفارش';
    order.append(cartIcon, orderText);
    order.addEventListener('click', () => openWhatsApp(
      `سلام، می‌خواهم این سرویس را سفارش بدهم:\nسرویس: ${s.name}\nقیمت: ${money(final)} AFN\nلطفاً راهنمایی کنید.`
    ));

    meta.append(views, order);
    card.append(media, h, path, desc, priceBox, meta);
    grid.append(card);
  });
}

/* ============================================================
   CORE LOADER
   ============================================================ */
async function loadCore() {
  const results = await Promise.allSettled([
    api('/api/categories'),
    api('/api/subcategories'),
    api('/api/services')
  ]);

  allCategories = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
  allSubcategories = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
  allServices = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];

  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed === 3) throw new Error('ارتباط با سرور برقرار نشد');

  renderCategories();
  renderSubcategories();
  applyFilters();
  fillReviewServices();
}

/* ============================================================
   POSTS
   ============================================================ */
async function loadPosts() {
  const box = $('postsGrid');
  if (!box) return;
  try {
    const posts = await api('/api/posts');
    box.replaceChildren();
    box.setAttribute('aria-busy', 'false');

    if (!Array.isArray(posts) || !posts.length) {
      const e = document.createElement('div');
      e.className = 'empty-message';
      e.textContent = 'هنوز مطلبی منتشر نشده است.';
      box.append(e);
      return;
    }

    posts.forEach(post => {
      const article = document.createElement('article');
      article.className = 'post-card';

      const h = document.createElement('h3');
      h.textContent = post.title || '';

      const p = document.createElement('p');
      p.textContent = post.content || '';

      article.append(h, p);

      const like = document.createElement('button');
      like.type = 'button';
      like.className = 'like-btn';
      like.textContent = `❤️ ${Number(post.likes || 0)}`;
      like.setAttribute('aria-label', 'لایک کردن این مطلب');

      like.addEventListener('click', async () => {
        if (like.disabled) return;
        like.disabled = true;
        try {
          const updated = await api(`/api/posts/${post.id}/like`, { method: 'POST' });
          like.textContent = `❤️ ${Number(updated.likes || 0)}`;
          toast('ممنون از لایک شما', 'success', 2000);
        } catch (err) {
          toast('ثبت لایک انجام نشد', 'error', 2500);
        } finally {
          like.disabled = false;
        }
      });

      article.append(like);
      box.append(article);
    });
  } catch (e) {
    box.replaceChildren();
    const x = document.createElement('div');
    x.className = 'empty-message';
    x.textContent = 'نشرات فعلاً در دسترس نیست.';
    box.append(x);
    box.setAttribute('aria-busy', 'false');
  }
}

/* ============================================================
   REVIEWS
   ============================================================ */
async function loadReviews() {
  const box = $('reviewsGrid');
  if (!box) return;
  try {
    const reviews = await api('/api/reviews');
    box.replaceChildren();
    box.setAttribute('aria-busy', 'false');

    if (!Array.isArray(reviews) || !reviews.length) {
      const e = document.createElement('div');
      e.className = 'empty-message';
      e.textContent = 'هنوز نظری منتشر نشده است.';
      box.append(e);
      return;
    }

    reviews.forEach(r => {
      const article = document.createElement('article');
      article.className = 'review-card';

      const h = document.createElement('h4');
      h.textContent = r.customer_name || 'مشتری';

      const rating = Number(r.rating || 0);
      const stars = document.createElement('div');
      stars.setAttribute('aria-label', `امتیاز ${rating} از 5`);
      stars.textContent = '★'.repeat(rating) + '☆'.repeat(Math.max(0, 5 - rating));

      const p = document.createElement('p');
      p.textContent = r.comment || '';

      article.append(h, stars, p);
      box.append(article);
    });
  } catch (e) {
    box.replaceChildren();
    const x = document.createElement('div');
    x.className = 'empty-message';
    x.textContent = 'نظرات فعلاً در دسترس نیست.';
    box.append(x);
    box.setAttribute('aria-busy', 'false');
  }
}

function fillReviewServices() {
  const select = $('reviewService');
  if (!select) return;
  select.replaceChildren(new Option('انتخاب سرویس', ''));
  if (!allServices.length) {
    const opt = new Option('سرویسی موجود نیست', '');
    opt.disabled = true;
    select.append(opt);
    select.disabled = true;
    return;
  }
  allServices.forEach(s => select.append(new Option(s.name, s.id)));
}

/* ============================================================
   REVIEW SUBMIT
   ============================================================ */
async function submitReview(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const msg = $('reviewMessage');
  const btn = form.querySelector('button[type="submit"]');

  msg.textContent = '';
  msg.className = 'form-message';

  const name = $('reviewName').value.trim();
  const service_id = $('reviewService').value;
  const rating = Number($('reviewRating').value);
  const comment = $('reviewComment').value.trim();

  if (!name || !service_id || !rating || !comment) {
    msg.textContent = 'لطفاً همه فیلدها را پر کنید.';
    msg.classList.add('error');
    return;
  }

  btn.disabled = true;
  try {
    const body = { customer_name: name, service_id, rating, comment };
    const out = await api('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    msg.textContent = out.message || 'نظر شما ثبت شد.';
    msg.classList.add('success');
    toast('نظر شما با موفقیت ثبت شد', 'success');
    form.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('error');
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ============================================================
   THEME
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('omh-theme');
  if (saved === 'dark') document.body.classList.add('dark-mode');

  const btn = $('themeToggle');
  if (!btn) return;

  const sync = () => {
    const dark = document.body.classList.contains('dark-mode');
    btn.innerHTML = `<i class="fa-solid ${dark ? 'fa-sun' : 'fa-moon'}"></i><span>${dark ? 'روشن' : 'تاریک'}</span>`;
    btn.setAttribute('aria-checked', String(dark));
    btn.setAttribute('aria-label', dark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تاریک');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#070d1a' : '#10b981');
  };

  sync();
  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const dark = document.body.classList.contains('dark-mode');
    localStorage.setItem('omh-theme', dark ? 'dark' : 'light');
    sync();
  });
}

/* ============================================================
   MENU
   ============================================================ */
function initMenu() {
  const btn = $('hamburger');
  const nav = $('navMenu');
  const overlay = $('menuOverlay');
  if (!btn || !nav) return;

  const close = () => {
    nav.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (overlay) overlay.hidden = true;
  };

  const open = () => {
    nav.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    if (overlay) overlay.hidden = false;
  };

  btn.addEventListener('click', () => {
    if (nav.classList.contains('open')) close();
    else open();
  });

  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

  if (overlay) overlay.addEventListener('click', close);

  document.addEventListener('click', e => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      close();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) close();
  });

  // Close menu when resizing to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 700 && nav.classList.contains('open')) close();
  });
}

/* ============================================================
   NAV HIGHLIGHT
   ============================================================ */
function initNavHighlight() {
  const links = [...document.querySelectorAll('#navMenu a')];
  const sections = links
    .map(a => {
      const h = a.getAttribute('href');
      return h && h.startsWith('#') && h.length > 1 ? document.querySelector(h) : null;
    })
    .filter(Boolean);

  if (!sections.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = '#' + entry.target.id;
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === id));
      }
    });
  }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });

  sections.forEach(s => io.observe(s));
}

/* ============================================================
   HEADER SCROLL
   ============================================================ */
function initHeaderScroll() {
  const header = $('header');
  if (!header) return;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('scrolled', window.scrollY > 10);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ============================================================
   SEARCH
   ============================================================ */
function initSearch() {
  const input = $('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 150);
  });
}

/* ============================================================
   WHATSAPP BUTTONS
   ============================================================ */
function initWhatsAppButtons() {
  ['floatingWhatsapp', 'whatsappLink', 'footerWhatsapp'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', e => {
      e.preventDefault();
      openWhatsApp();
    });
  });
}

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', async () => {
  initMenu();
  initTheme();
  initNavHighlight();
  initHeaderScroll();
  initSearch();
  initWhatsAppButtons();

  $('reviewForm')?.addEventListener('submit', submitReview);

  try {
    await loadCore();
  } catch (e) {
    console.error(e);
    const grid = $('servicesGrid');
    if (grid) {
      grid.replaceChildren();
      const d = document.createElement('div');
      d.className = 'empty-message';
      d.textContent = 'ارتباط با سرور برقرار نشد. لطفاً صفحه را دوباره باز کنید.';
      grid.append(d);
      grid.setAttribute('aria-busy', 'false');
    }
    toast('ارتباط با سرور برقرار نشد', 'error');
  }

  await Promise.allSettled([
    loadSettings().then(loadAnnouncements),
    loadPosts(),
    loadReviews()
  ]);
});
