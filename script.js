/**
 * Premium Personal Profile / Link-in-Bio
 * Vanilla JS — localStorage + IndexedDB
 * Admin via 3x click on avatar + passcode
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────
  // Constants & Defaults
  // ─────────────────────────────────────────
  const STORAGE_KEY = 'premium_profile_cfg_v1';
  const DB_NAME = 'PremiumProfileDB';
  const DB_VERSION = 2;
  const STORE_IMAGES = 'images';
  const STORE_VIDEOS = 'videos';
  const STORE_AUDIO = 'audio';
  const DEFAULT_PASS = '@Kiss789789';
  const CLICK_WINDOW_MS = 600;

  const RING_LEVELS = [
    { id: 'white', label: 'White — 10 Years', color: '#f0f0f5' },
    { id: 'yellow', label: 'Yellow — 100 Years', color: '#f5d76e' },
    { id: 'purple', label: 'Purple — 1,000 Years', color: '#a78bfa' },
    { id: 'black', label: 'Black — 10,000 Years', color: '#5a5a6a' },
    { id: 'red', label: 'Red — 100,000 Years', color: '#ef4444' },
    { id: 'gold', label: 'Gold — 1,000,000+ Years', color: '#fbbf24' }
  ];

  const DEFAULT_CONFIG = {
    passcode: DEFAULT_PASS,
    profile: {
      imageId: null,
      username: '@HaRikKi',
      usernameSize: 28,
      usernameWeight: '700',
      usernameSpacing: 1,
      usernameColor: '#ffffff',
      usernameGradient: true,
      usernameGlow: true,
      badgeEnabled: true,
      description: 'Digital Creator • Gamer • Developer\nBuilding premium digital experiences.',
      descSize: 15,
      descColor: '#c8c8d0',
      descAlign: 'center'
    },
    soulRings: {
      enabled: true,
      count: 3,
      rings: [
        { level: 'gold', size: 1.15, thickness: 2, speed: 18, glow: 14, opacity: 0.8 },
        { level: 'purple', size: 1.32, thickness: 2, speed: 24, glow: 12, opacity: 0.65 },
        { level: 'white', size: 1.48, thickness: 1.5, speed: 30, glow: 10, opacity: 0.5 }
      ]
    },
    videos: {
      items: [], // { id, name, size, duration, default }
      activeIndex: 0,
      muted: true,
      playing: true
    },
    music: {
      enabled: true,
      audioId: null,
      fileName: '',
      title: 'Background Music',
      artist: 'Profile',
      loop: true,
      autoplay: false,
      playing: false
    },
    buttons: [
      { id: 'b1', title: 'Telegram', description: 'Chat with me', url: 'https://t.me/', iconType: 'brand', brand: 'telegram', emoji: '📢', iconName: '', sideColor: '#2AABEE', sideEnabled: true, enabled: true, featured: false },
      { id: 'b2', title: 'YouTube', description: 'Watch my videos', url: 'https://youtube.com/', iconType: 'brand', brand: 'youtube', emoji: '▶️', iconName: '', sideColor: '#FF0000', sideEnabled: true, enabled: true, featured: true },
      { id: 'b3', title: 'Discord', description: 'Join the server', url: 'https://discord.gg/', iconType: 'brand', brand: 'discord', emoji: '🎮', iconName: '', sideColor: '#5865F2', sideEnabled: true, enabled: true, featured: false },
      { id: 'b4', title: 'Website', description: 'Visit my site', url: 'https://example.com', iconType: 'brand', brand: 'website', emoji: '🌐', iconName: '', sideColor: '#c9a227', sideEnabled: true, enabled: true, featured: false }
    ],
    appearance: {
      primary: '#c9a227',
      accent: '#7c5cff',
      text: '#ffffff',
      btnBg: '#1a1a24',
      glow: '#c9a227',
      border: '#ffffff',
      fontUsername: "'Inter', system-ui, sans-serif",
      fontDesc: "'Inter', system-ui, sans-serif"
    },
    animations: {
      fade: true,
      slide: true,
      float: true,
      glow: true,
      hover: true,
      click: true,
      rotation: true,
      shine: true,
      reduced: false
    },
    settings: {
      title: '@HaRikKi — Premium Profile',
      metaDesc: 'Digital Creator • Gamer • Developer. Building premium digital experiences.',
      copyright: '© 2026 HaRikKi',
      footer: true,
      share: true,
      sound: true,
      vidCtrl: true
    },
    stats: {
      views: 0,
      clicks: 0,
      recent: ['Welcome to Admin Dashboard']
    }
  };

  // ─────────────────────────────────────────
  // State
  // ─────────────────────────────────────────
  let config = deepClone(DEFAULT_CONFIG);
  let db = null;
  let adminOpen = false;
  let avatarClicks = [];
  let editingButtonId = null;
  let videoObjectUrls = {}; // id -> blob URL
  let currentVideoId = null;

  // ─────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────
  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function uid(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isValidUrl(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(s)) {
      try {
        new URL(s);
        return true;
      } catch {
        return false;
      }
    }
    // allow bare domains
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return true;
    return false;
  }

  function normalizeUrl(str) {
    const s = (str || '').trim();
    if (!s) return '';
    if (/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return 'https://' + s;
    return s;
  }

  function showToast(msg, ms = 2200) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 300);
    }, ms);
  }

  function addRecent(msg) {
    if (!config.stats.recent) config.stats.recent = [];
    config.stats.recent.unshift(msg);
    if (config.stats.recent.length > 12) config.stats.recent.pop();
    saveConfig();
    renderRecent();
  }

  // ─────────────────────────────────────────
  // IndexedDB
  // ─────────────────────────────────────────
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_IMAGES)) {
          database.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_VIDEOS)) {
          database.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_AUDIO)) {
          database.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
        }
      };
    });
  }

  function idbPut(storeName, record) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGet(storeName, id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbDelete(storeName, id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // ─────────────────────────────────────────
  // Config persistence (localStorage)
  // ─────────────────────────────────────────
  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        config = mergeDeep(deepClone(DEFAULT_CONFIG), parsed);
      }
    } catch (e) {
      console.warn('Config load failed', e);
      config = deepClone(DEFAULT_CONFIG);
    }
    if (!config.music) config.music = deepClone(DEFAULT_CONFIG.music);
    // Migrate older buttons missing new fields
    (config.buttons || []).forEach(b => {
      if (b.description === undefined) b.description = '';
      if (b.sideColor === undefined) b.sideColor = '#c9a227';
      if (b.sideEnabled === undefined) b.sideEnabled = true;
      if (b.brand === undefined) b.brand = 'link';
      if (!b.iconType) b.iconType = 'brand';
    });
  }

  function saveConfig() {
    try {
      // Never store binary blobs in localStorage
      const toSave = deepClone(config);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Config save failed', e);
      showToast('Storage full or blocked. Settings may not persist.');
    }
  }

  function mergeDeep(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // ─────────────────────────────────────────
  // Apply theme / CSS variables
  // ─────────────────────────────────────────
  function applyAppearance() {
    const a = config.appearance;
    const p = config.profile;
    const root = document.documentElement;

    root.style.setProperty('--primary', a.primary);
    root.style.setProperty('--accent', a.accent);
    root.style.setProperty('--text', a.text);
    root.style.setProperty('--btn-bg', a.btnBg);
    root.style.setProperty('--glow', a.glow);
    root.style.setProperty('--font-username', a.fontUsername);
    root.style.setProperty('--font-desc', a.fontDesc);
    root.style.setProperty('--username-size', p.usernameSize + 'px');
    root.style.setProperty('--username-weight', p.usernameWeight);
    root.style.setProperty('--username-spacing', p.usernameSpacing + 'px');
    root.style.setProperty('--desc-size', p.descSize + 'px');

    // Animations
    const an = config.animations;
    document.body.classList.toggle('reduced-motion', !!an.reduced);
    document.body.classList.toggle('no-float', !an.float);
    document.body.classList.toggle('no-ring-anim', !an.rotation);
  }

  // ─────────────────────────────────────────
  // Public Profile Rendering
  // ─────────────────────────────────────────
  async function renderProfileImage() {
    const img = $('#profile-image');
    const adminPrev = $('#admin-profile-preview');
    const prevImg = $('#preview-img');
    let src = '';

    if (config.profile.imageId) {
      try {
        const rec = await idbGet(STORE_IMAGES, config.profile.imageId);
        if (rec && rec.blob) {
          src = URL.createObjectURL(rec.blob);
        }
      } catch (e) {
        console.warn('Image load error', e);
      }
    }

    if (!src) {
      // Default placeholder (SVG data URI)
      src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%231a1a28'/%3E%3Cstop offset='100%25' stop-color='%232a2a3a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='100' cy='100' r='100' fill='url(%23g)'/%3E%3Ccircle cx='100' cy='80' r='36' fill='%234a4a5a'/%3E%3Cellipse cx='100' cy='155' rx='55' ry='40' fill='%234a4a5a'/%3E%3C/svg%3E";
    }

    if (img) img.src = src;
    if (adminPrev) adminPrev.src = src;
    if (prevImg) prevImg.src = src;
  }

  function renderUsername() {
    const el = $('#username');
    const p = config.profile;
    if (!el) return;
    el.textContent = p.username || '@User';
    el.style.color = p.usernameColor || '#fff';
    el.classList.toggle('gradient', !!p.usernameGradient);
    el.classList.toggle('glow', !!p.usernameGlow);

    const prev = $('#preview-username');
    if (prev) {
      prev.textContent = p.username || '@User';
      prev.style.color = p.usernameColor || '#fff';
    }
  }

  function renderBadge() {
    const badge = $('#premium-badge');
    const prev = $('#preview-badge');
    const show = !!config.profile.badgeEnabled;
    if (badge) badge.classList.toggle('hidden', !show);
    if (prev) prev.classList.toggle('hidden', !show);
  }

  function renderDescription() {
    const el = $('#description');
    const p = config.profile;
    if (!el) return;
    el.textContent = p.description || '';
    el.style.color = p.descColor || '#c8c8d0';
    el.style.textAlign = p.descAlign || 'center';

    const prev = $('#preview-desc');
    if (prev) {
      prev.textContent = p.description || '';
      prev.style.color = p.descColor || '#c8c8d0';
    }
  }

  function renderSoulRings() {
    const container = $('#soul-rings');
    const prevContainer = $('#preview-rings');
    if (!container) return;

    container.innerHTML = '';
    if (prevContainer) prevContainer.innerHTML = '';

    const sr = config.soulRings;
    if (!sr.enabled) {
      container.classList.add('disabled');
      return;
    }
    container.classList.remove('disabled');

    const count = Math.min(9, Math.max(1, sr.count || 1));
    const rings = sr.rings || [];

    for (let i = 0; i < count; i++) {
      const r = rings[i] || {
        level: RING_LEVELS[i % RING_LEVELS.length].id,
        size: 1.12 + i * 0.14,
        thickness: 2,
        speed: 16 + i * 6,
        glow: 12,
        opacity: 0.75 - i * 0.08
      };

      const ring = document.createElement('div');
      ring.className = 'soul-ring';
      ring.dataset.level = r.level || 'white';
      const base = 140; // avatar size reference
      const sizePx = base * (r.size || 1.2);
      ring.style.width = sizePx + 'px';
      ring.style.height = sizePx + 'px';
      ring.style.borderWidth = (r.thickness || 2) + 'px';
      ring.style.setProperty('--ring-speed', (r.speed || 20) + 's');
      ring.style.setProperty('--ring-glow', (r.glow || 12) + 'px');
      ring.style.setProperty('--ring-opacity', r.opacity != null ? r.opacity : 0.7);
      // alternate direction
      if (i % 2 === 1) ring.style.animationDirection = 'reverse';
      container.appendChild(ring);

      // Preview (scaled)
      if (prevContainer) {
        const pr = ring.cloneNode(true);
        const scale = 72 / 140;
        pr.style.width = sizePx * scale + 'px';
        pr.style.height = sizePx * scale + 'px';
        prevContainer.appendChild(pr);
      }
    }
  }

  /** Simple brand/app style icons (not official trademark assets) */
  const BRAND_SVGS = {
    telegram: '<svg viewBox="0 0 24 24" fill="#2AABEE" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12a.43.43 0 01.14.27c.0.10.0.2.2.38z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8v-6.93H7.9V12h2.1V9.8c0-2.08 1.24-3.23 3.14-3.23.91 0 1.86.16 1.86.16v2.04h-1.05c-1.03 0-1.35.64-1.35 1.3V12h2.3l-.37 2.87h-1.93V21.8c4.56-.93 8-4.96 8-9.8 0-5.52-4.48-10-10-10z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f58529"/><stop offset="50%" stop-color="#dd2a7b"/><stop offset="100%" stop-color="#8134af"/></linearGradient></defs><path fill="url(#ig)" d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.9a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0zM12 9a3 3 0 110 6 3 3 0 010-6z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="#FF0000" xmlns="http://www.w3.org/2000/svg"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.5 31.5 0 000 12a31.5 31.5 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.5 31.5 0 0024 12a31.5 31.5 0 00-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="#000" xmlns="http://www.w3.org/2000/svg"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48V8.82a8.2 8.2 0 004.83 1.55V6.93a4.85 4.85 0 01-1.25-.24z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" fill="#5865F2" xmlns="http://www.w3.org/2000/svg"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.1.1 0 00-.07.03c-.18.33-.39.76-.53 1.09a16.1 16.1 0 00-4.8 0c-.14-.34-.37-.76-.54-1.09-.02-.01-.04-.02-.07-.02-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05 0 .07.01.11.09.22.17.33.26.04.03.03.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.03.09.31.61.67 1.19 1.06 1.74.02.03.05.04.08.03 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="#000" xmlns="http://www.w3.org/2000/svg"><path d="M18.24 2H21.5l-7.19 8.22L22.5 22h-6.55l-5.13-6.71L5.1 22H1.82l7.69-8.79L1.5 2h6.7l4.64 6.13L18.24 2zm-1.15 18h1.82L7.08 3.89H5.12L17.09 20z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M12.04 2a9.9 9.9 0 00-8.55 14.9L2 22l5.25-1.38A9.9 9.9 0 1012.04 2zm5.5 14.1c-.23.65-1.34 1.2-1.86 1.28-.48.07-1.09.1-1.76-.11-.41-.13-.93-.3-1.6-.59-2.82-1.22-4.66-4.07-4.8-4.26-.14-.18-1.14-1.52-1.14-2.9 0-1.38.72-2.06.98-2.34.26-.28.56-.35.75-.35h.54c.17 0 .4-.06.62.48.23.56.77 1.94.84 2.08.07.14.11.3.02.49-.09.18-.14.3-.27.46-.14.15-.29.34-.41.46-.14.14-.28.29-.12.56.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.22 2.19 1.36.27.13.43.11.59-.07.16-.18.68-.79.86-1.06.18-.28.36-.23.61-.14.25.1 1.58.75 1.85.88.10.0.0.1.5.17.14.08.14.46-.09 1.11z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="#181717" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0112 6.84c.85.004 1.71.12 2.51.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 10.0.2.2 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.59.69.49A10.27 10.27 0 0022 12.26C22 6.58 17.52 2 12 2z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="#0A66C2" xmlns="http://www.w3.org/2000/svg"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.23 0z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24" fill="#1DB954" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.58 14.43a.62.62 0 01-.86.21c-2.35-1.44-5.31-1.76-8.8-.96a.62.62 0 01-.28-1.22c3.8-.87 7.07-.5 9.73 1.12a.62.62 0 01.21.85zm1.22-2.72a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 01-.45-1.49c3.63-1.1 8.14-.57 11.23 1.33a.78.78 0 01.26 1.07zm.1-2.84C14.5 8.9 9.2 8.73 6.07 9.68a.94.94 0 11-.55-1.8c3.6-1.1 9.57-.89 13.34 1.35a.94.94 0 01-.96 1.64z"/></svg>',
    twitch: '<svg viewBox="0 0 24 24" fill="#9146FF" xmlns="http://www.w3.org/2000/svg"><path d="M4 2L2 5.5v14h4V22l3.5-2.5H14L22 12V2H4zm16 9.5l-3.5 3.5h-3.5l-2.5 2.5v-2.5H6.5V4H20v7.5zM15 7h1.5v4.5H15V7zm-4 0H12.5v4.5H11V7z"/></svg>',
    website: '<svg viewBox="0 0 24 24" fill="none" stroke="#c9a227" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="#c9a227" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><path d="M3 9l1.5-5h15L21 9M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18"/><path d="M9 13h6"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="#EA4335" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="#34A853" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><path d="M7 3h4l1.5 4.5-2.5 1.5a12 12 0 005.5 5.5l1.5-2.5L21 13v4a2 2 0 01-2 2A16 16 0 015 7a2 2 0 012-2z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><path d="M10 13a5 5 0 007.07 0l2.12-2.12a5 5 0 00-7.07-7.07L10.7 5.23"/><path d="M14 11a5 5 0 00-7.07 0L4.8 13.12a5 5 0 007.07 7.07l1.42-1.42"/></svg>'
  };

  function getBrandSvg(name) {
    return BRAND_SVGS[name] || BRAND_SVGS.link;
  }

  function renderButtons() {
    const nav = $('#link-buttons');
    const prev = $('#preview-buttons');
    if (!nav) return;
    nav.innerHTML = '';
    if (prev) prev.innerHTML = '';

    const list = (config.buttons || []).filter(b => b.enabled !== false);

    list.forEach(btn => {
      const a = document.createElement('a');
      a.className = 'link-btn' + (btn.featured ? ' featured' : '') + (btn.sideEnabled !== false ? ' has-side' : '');
      a.href = normalizeUrl(btn.url) || '#';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.dataset.id = btn.id;

      if (btn.sideEnabled !== false) {
        const bar = document.createElement('span');
        bar.className = 'btn-side-bar';
        bar.style.setProperty('--btn-side', btn.sideColor || '#c9a227');
        a.appendChild(bar);
      }

      const iconWrap = document.createElement('span');
      iconWrap.className = 'btn-icon';
      if (btn.iconType === 'brand') {
        iconWrap.classList.add('brand-icon');
        iconWrap.innerHTML = getBrandSvg(btn.brand || 'link');
      } else if (btn.iconType === 'icon' && btn.iconName) {
        iconWrap.innerHTML = '<i data-lucide="' + sanitizeText(btn.iconName) + '"></i>';
      } else {
        iconWrap.textContent = btn.emoji || '🔗';
      }
      a.appendChild(iconWrap);

      const stack = document.createElement('span');
      stack.className = 'btn-text-stack';
      const title = document.createElement('span');
      title.className = 'btn-title';
      title.textContent = btn.title || 'Link';
      stack.appendChild(title);
      if (btn.description) {
        const desc = document.createElement('span');
        desc.className = 'btn-desc';
        desc.textContent = btn.description;
        stack.appendChild(desc);
      }
      a.appendChild(stack);

      a.addEventListener('click', () => {
        config.stats.clicks = (config.stats.clicks || 0) + 1;
        saveConfig();
        updateStatsUI();
      });

      nav.appendChild(a);

      if (prev) {
        const p = document.createElement('div');
        p.className = 'preview-link';
        const iconLabel = btn.iconType === 'brand' ? '◆' : (btn.emoji || '🔗');
        let html = '<span>' + sanitizeText(iconLabel) + '</span><span>' + sanitizeText(btn.title || 'Link');
        if (btn.description) html += '<br><small style="opacity:.6">' + sanitizeText(btn.description) + '</small>';
        html += '</span>';
        p.innerHTML = html;
        prev.appendChild(p);
      }
    });

    if (window.lucide) {
      try { window.lucide.createIcons(); } catch (_) {}
    }
  }

  function renderSettingsUI() {
    const s = config.settings;
    document.title = s.title || 'Profile';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', s.metaDesc || '');

    const footer = $('#site-footer');
    const copyright = $('#copyright-text');
    if (footer) footer.classList.toggle('hidden', !s.footer);
    if (copyright) copyright.textContent = s.copyright || '';

    const shareBtn = $('#share-btn');
    const muteBtn = $('#mute-btn');
    const playBtn = $('#play-pause-btn');
    if (shareBtn) shareBtn.classList.toggle('hidden', !s.share);
    if (muteBtn) muteBtn.classList.toggle('hidden', !s.sound);
    if (playBtn) playBtn.classList.toggle('hidden', !s.vidCtrl);
  }

  function updateStatsUI() {
    const v = $('#stat-views');
    const c = $('#stat-clicks');
    const vids = $('#stat-videos');
    const links = $('#stat-links');
    if (v) v.textContent = config.stats.views || 0;
    if (c) c.textContent = config.stats.clicks || 0;
    if (vids) vids.textContent = (config.videos.items || []).length;
    if (links) links.textContent = (config.buttons || []).filter(b => b.enabled !== false).length;
  }

  function renderRecent() {
    const ul = $('#recent-changes');
    if (!ul) return;
    ul.innerHTML = '';
    (config.stats.recent || []).forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    });
  }

  // ─────────────────────────────────────────
  // Video System
  // ─────────────────────────────────────────
  async function loadActiveVideo() {
    const video = $('#bg-video');
    if (!video) return;

    const items = config.videos.items || [];
    if (!items.length) {
      video.classList.remove('visible');
      video.removeAttribute('src');
      video.load();
      updateVideoNav();
      return;
    }

    let idx = config.videos.activeIndex || 0;
    if (idx < 0 || idx >= items.length) idx = 0;
    config.videos.activeIndex = idx;
    const item = items[idx];

    try {
      // Revoke previous
      if (currentVideoId && videoObjectUrls[currentVideoId]) {
        // keep for potential reuse
      }

      let url = videoObjectUrls[item.id];
      if (!url) {
        const rec = await idbGet(STORE_VIDEOS, item.id);
        if (rec && rec.blob) {
          url = URL.createObjectURL(rec.blob);
          videoObjectUrls[item.id] = url;
        }
      }

      if (!url) {
        showToast('Video file missing from storage');
        return;
      }

      // Fade transition
      video.classList.remove('visible');
      await new Promise(r => setTimeout(r, 200));

      video.src = url;
      video.muted = config.videos.muted !== false;
      video.loop = true;
      video.playsInline = true;

      const playPromise = video.play();
      if (playPromise) {
        playPromise.then(() => {
          video.classList.add('visible');
          config.videos.playing = true;
          updatePlayIcon();
        }).catch(() => {
          // Autoplay blocked — still show frame
          video.classList.add('visible');
          config.videos.playing = false;
          updatePlayIcon();
        });
      }
      currentVideoId = item.id;
    } catch (e) {
      console.warn('Video load error', e);
      showToast('Could not load video');
    }

    updateVideoNav();
    updateMuteIcon();
  }

  function updateVideoNav() {
    const nav = $('#video-nav');
    const indicator = $('#video-indicator');
    const items = config.videos.items || [];
    if (!nav) return;
    if (items.length <= 1) {
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    if (indicator) {
      indicator.textContent = `${(config.videos.activeIndex || 0) + 1} / ${items.length}`;
    }
  }

  function updateMuteIcon() {
    const icon = $('#mute-icon');
    if (!icon) return;
    icon.setAttribute('data-lucide', config.videos.muted !== false ? 'volume-x' : 'volume-2');
    if (window.lucide) try { window.lucide.createIcons(); } catch (_) {}
  }

  function updatePlayIcon() {
    const icon = $('#play-icon');
    if (!icon) return;
    icon.setAttribute('data-lucide', config.videos.playing ? 'pause' : 'play');
    if (window.lucide) try { window.lucide.createIcons(); } catch (_) {}
  }

  function switchVideo(delta) {
    const items = config.videos.items || [];
    if (items.length < 2) return;
    let idx = (config.videos.activeIndex || 0) + delta;
    if (idx < 0) idx = items.length - 1;
    if (idx >= items.length) idx = 0;
    config.videos.activeIndex = idx;
    saveConfig();
    loadActiveVideo();
  }

  async function renderVideoList() {
    const list = $('#video-list');
    if (!list) return;
    list.innerHTML = '';
    const items = config.videos.items || [];

    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'video-item';
      li.dataset.id = item.id;
      li.innerHTML = `
        <span class="drag-handle" title="Drag">⋮⋮</span>
        <div class="vid-info">
          <div class="vid-name">${sanitizeText(item.name || 'Video')}</div>
          <div class="vid-meta">${item.default ? '⭐ Default · ' : ''}${formatBytes(item.size || 0)}${item.duration ? ' · ' + formatDuration(item.duration) : ''}</div>
        </div>
        <div class="item-actions">
          <button type="button" data-action="set-default" title="Set default" aria-label="Set default"><i data-lucide="star"></i></button>
          <button type="button" data-action="play" title="Preview" aria-label="Play"><i data-lucide="play"></i></button>
          <button type="button" data-action="delete" class="danger" title="Delete" aria-label="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      list.appendChild(li);
    });

    if (window.lucide) try { window.lucide.createIcons(); } catch (_) {}

    list.onclick = async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const itemEl = btn.closest('.video-item');
      if (!itemEl) return;
      const id = itemEl.dataset.id;
      const action = btn.dataset.action;

      if (action === 'delete') {
        if (!confirm('Delete this video from this device?')) return;
        try {
          await idbDelete(STORE_VIDEOS, id);
          if (videoObjectUrls[id]) {
            URL.revokeObjectURL(videoObjectUrls[id]);
            delete videoObjectUrls[id];
          }
          config.videos.items = config.videos.items.filter(v => v.id !== id);
          if (config.videos.activeIndex >= config.videos.items.length) {
            config.videos.activeIndex = Math.max(0, config.videos.items.length - 1);
          }
          saveConfig();
          addRecent('Video deleted');
          renderVideoList();
          loadActiveVideo();
          updateStatsUI();
        } catch (err) {
          showToast('Delete failed');
        }
      } else if (action === 'set-default') {
        config.videos.items.forEach(v => { v.default = v.id === id; });
        const idx = config.videos.items.findIndex(v => v.id === id);
        if (idx >= 0) config.videos.activeIndex = idx;
        saveConfig();
        addRecent('Default video set');
        renderVideoList();
        loadActiveVideo();
      } else if (action === 'play') {
        const idx = config.videos.items.findIndex(v => v.id === id);
        if (idx >= 0) {
          config.videos.activeIndex = idx;
          saveConfig();
          loadActiveVideo();
        }
      }
    };
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function formatDuration(sec) {
    if (!sec || !isFinite(sec)) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  // ─────────────────────────────────────────
  // Button Admin List
  // ─────────────────────────────────────────
  function renderButtonList() {
    const list = $('#button-list');
    if (!list) return;
    list.innerHTML = '';

    (config.buttons || []).forEach((btn, index) => {
      const li = document.createElement('li');
      li.className = 'button-item';
      li.dataset.id = btn.id;
      li.draggable = true;
      li.innerHTML = `
        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
        <div class="btn-info">
          <div class="btn-name">${btn.iconType === 'brand' ? '◆' : sanitizeText(btn.emoji || '🔗')} ${sanitizeText(btn.title || 'Untitled')}</div>
          <div class="btn-meta">${btn.enabled === false ? 'Hidden · ' : ''}${btn.description ? sanitizeText(btn.description.slice(0, 30)) + ' · ' : ''}${sanitizeText((btn.url || '').slice(0, 36))}</div>
        </div>
        <div class="item-actions">
          <button type="button" data-action="edit" title="Edit" aria-label="Edit"><i data-lucide="pencil"></i></button>
          <button type="button" data-action="toggle" title="Show/Hide" aria-label="Toggle visibility"><i data-lucide="${btn.enabled === false ? 'eye-off' : 'eye'}"></i></button>
          <button type="button" data-action="delete" class="danger" title="Delete" aria-label="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      list.appendChild(li);
    });

    if (window.lucide) try { window.lucide.createIcons(); } catch (_) {}

    // Drag reorder
    let dragSrc = null;
    list.querySelectorAll('.button-item').forEach(item => {
      item.addEventListener('dragstart', () => {
        dragSrc = item;
        item.style.opacity = '0.5';
      });
      item.addEventListener('dragend', () => {
        item.style.opacity = '';
        dragSrc = null;
      });
      item.addEventListener('dragover', e => e.preventDefault());
      item.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrc || dragSrc === item) return;
        const ids = config.buttons.map(b => b.id);
        const from = ids.indexOf(dragSrc.dataset.id);
        const to = ids.indexOf(item.dataset.id);
        if (from < 0 || to < 0) return;
        const [moved] = config.buttons.splice(from, 1);
        config.buttons.splice(to, 0, moved);
        saveConfig();
        renderButtonList();
        renderButtons();
        addRecent('Buttons reordered');
      });
    });

    list.onclick = (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const itemEl = btn.closest('.button-item');
      if (!itemEl) return;
      const id = itemEl.dataset.id;
      const action = btn.dataset.action;
      const target = config.buttons.find(b => b.id === id);
      if (!target) return;

      if (action === 'edit') {
        openButtonModal(target);
      } else if (action === 'toggle') {
        target.enabled = target.enabled === false ? true : false;
        saveConfig();
        renderButtonList();
        renderButtons();
        updateStatsUI();
        addRecent(target.enabled ? 'Button shown' : 'Button hidden');
      } else if (action === 'delete') {
        if (!confirm('Delete this button?')) return;
        config.buttons = config.buttons.filter(b => b.id !== id);
        saveConfig();
        renderButtonList();
        renderButtons();
        updateStatsUI();
        addRecent('Button deleted');
      }
    };
  }

  function openButtonModal(btn) {
    editingButtonId = btn ? btn.id : null;
    const modal = $('#btn-modal');
    const title = $('#btn-modal-title');
    if (title) title.textContent = btn ? 'Edit Button' : 'Add Button';

    $('#btn-title').value = btn ? btn.title : '';
    const descEl = $('#btn-desc');
    if (descEl) descEl.value = btn ? (btn.description || '') : '';
    $('#btn-url').value = btn ? btn.url : '';
    $('#btn-icon-type').value = btn ? (btn.iconType || 'brand') : 'brand';
    $('#btn-emoji').value = btn ? (btn.emoji || '🔗') : '🔗';
    $('#btn-icon-name').value = btn ? (btn.iconName || '') : '';
    const brandEl = $('#btn-brand');
    if (brandEl) brandEl.value = btn ? (btn.brand || 'link') : 'telegram';
    const sideColor = $('#btn-side-color');
    if (sideColor) sideColor.value = btn ? (btn.sideColor || '#c9a227') : '#c9a227';
    const sideEn = $('#btn-side-enabled');
    if (sideEn) sideEn.checked = btn ? btn.sideEnabled !== false : true;
    $('#btn-enabled').checked = btn ? btn.enabled !== false : true;
    $('#btn-featured').checked = btn ? !!btn.featured : false;

    toggleIconFields();
    modal.hidden = false;
    $('#btn-title').focus();
  }

  function toggleIconFields() {
    const type = $('#btn-icon-type').value;
    const brandF = $('#btn-brand-field');
    const emojiF = $('#btn-emoji-field');
    const iconF = $('#btn-icon-field');
    if (brandF) brandF.hidden = type !== 'brand';
    if (emojiF) emojiF.hidden = type !== 'emoji';
    if (iconF) iconF.hidden = type !== 'icon';
  }

  function saveButtonFromModal() {
    const title = ($('#btn-title').value || '').trim();
    const url = ($('#btn-url').value || '').trim();
    if (!title) {
      showToast('Title required');
      return;
    }
    if (!isValidUrl(url) && url) {
      showToast('Invalid URL');
      return;
    }

    const data = {
      id: editingButtonId || uid('btn'),
      title,
      description: (($('#btn-desc') && $('#btn-desc').value) || '').trim(),
      url: normalizeUrl(url),
      iconType: $('#btn-icon-type').value,
      brand: ($('#btn-brand') && $('#btn-brand').value) || 'link',
      emoji: ($('#btn-emoji').value || '🔗').slice(0, 4),
      iconName: ($('#btn-icon-name').value || '').trim().toLowerCase(),
      sideColor: ($('#btn-side-color') && $('#btn-side-color').value) || '#c9a227',
      sideEnabled: $('#btn-side-enabled') ? $('#btn-side-enabled').checked : true,
      enabled: $('#btn-enabled').checked,
      featured: $('#btn-featured').checked
    };

    if (editingButtonId) {
      const idx = config.buttons.findIndex(b => b.id === editingButtonId);
      if (idx >= 0) config.buttons[idx] = data;
      addRecent('Button updated');
    } else {
      config.buttons.push(data);
      addRecent('Button added');
    }

    saveConfig();
    renderButtonList();
    renderButtons();
    updateStatsUI();
    $('#btn-modal').hidden = true;
    editingButtonId = null;
  }

  // ─────────────────────────────────────────
  // Soul Rings Admin
  // ─────────────────────────────────────────
  function renderRingsConfig() {
    const wrap = $('#rings-config');
    if (!wrap) return;
    wrap.innerHTML = '';
    const count = Math.min(9, Math.max(1, config.soulRings.count || 1));

    // Ensure rings array length
    while (config.soulRings.rings.length < count) {
      const i = config.soulRings.rings.length;
      config.soulRings.rings.push({
        level: RING_LEVELS[i % RING_LEVELS.length].id,
        size: 1.12 + i * 0.14,
        thickness: 2,
        speed: 16 + i * 6,
        glow: 12,
        opacity: Math.max(0.3, 0.8 - i * 0.08)
      });
    }

    for (let i = 0; i < count; i++) {
      const r = config.soulRings.rings[i];
      const div = document.createElement('div');
      div.className = 'ring-item';
      div.innerHTML = `
        <h4>Ring ${i + 1}</h4>
        <label class="field"><span>Level</span>
          <select data-ring="${i}" data-prop="level">
            ${RING_LEVELS.map(l => `<option value="${l.id}" ${r.level === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Size multiplier</span>
          <input type="range" data-ring="${i}" data-prop="size" min="1.05" max="2.2" step="0.01" value="${r.size}" />
        </label>
        <label class="field"><span>Thickness</span>
          <input type="range" data-ring="${i}" data-prop="thickness" min="1" max="5" step="0.5" value="${r.thickness}" />
        </label>
        <label class="field"><span>Speed (seconds / revolution)</span>
          <input type="range" data-ring="${i}" data-prop="speed" min="4" max="60" step="1" value="${r.speed}" />
        </label>
        <label class="field"><span>Glow</span>
          <input type="range" data-ring="${i}" data-prop="glow" min="0" max="30" step="1" value="${r.glow}" />
        </label>
        <label class="field"><span>Opacity</span>
          <input type="range" data-ring="${i}" data-prop="opacity" min="0.1" max="1" step="0.05" value="${r.opacity}" />
        </label>
      `;
      wrap.appendChild(div);
    }

    wrap.onchange = wrap.oninput = (e) => {
      const el = e.target;
      if (!el.dataset.ring) return;
      const i = parseInt(el.dataset.ring, 10);
      const prop = el.dataset.prop;
      let val = el.value;
      if (prop !== 'level') val = parseFloat(val);
      if (!config.soulRings.rings[i]) return;
      config.soulRings.rings[i][prop] = val;
      saveConfig();
      renderSoulRings();
    };
  }

  // ─────────────────────────────────────────
  // Admin Panel Wiring
  // ─────────────────────────────────────────
  function openAdmin() {
    adminOpen = true;
    $('#admin-dashboard').hidden = false;
    $('#public-profile').style.visibility = 'hidden';
    fillAdminForms();
    fillMusicAdmin();
    renderButtonList();
    renderVideoList();
    renderRingsConfig();
    updateStatsUI();
    renderRecent();
    if (window.lucide) try { window.lucide.createIcons(); } catch (_) {}
  }

  function closeAdmin() {
    adminOpen = false;
    $('#admin-dashboard').hidden = true;
    $('#public-profile').style.visibility = '';
    $('#admin-sidebar').classList.remove('open');
    // Full re-render public
    applyAllPublic();
  }

  function fillAdminForms() {
    const p = config.profile;
    const a = config.appearance;
    const an = config.animations;
    const s = config.settings;
    const sr = config.soulRings;

    setVal('cfg-username', p.username);
    setVal('cfg-username-size', p.usernameSize);
    setText('cfg-username-size-val', p.usernameSize);
    setVal('cfg-username-weight', p.usernameWeight);
    setVal('cfg-username-spacing', p.usernameSpacing);
    setText('cfg-username-spacing-val', p.usernameSpacing);
    setVal('cfg-username-color', p.usernameColor);
    setCheck('cfg-username-gradient', p.usernameGradient);
    setCheck('cfg-username-glow', p.usernameGlow);
    setCheck('badge-enabled', p.badgeEnabled);

    setVal('cfg-description', p.description);
    setVal('cfg-desc-size', p.descSize);
    setText('cfg-desc-size-val', p.descSize);
    setVal('cfg-desc-color', p.descColor);
    setVal('cfg-desc-align', p.descAlign);

    setCheck('rings-enabled', sr.enabled);
    setVal('rings-count', sr.count);
    setText('rings-count-val', sr.count);

    setVal('cfg-primary', a.primary);
    setVal('cfg-accent', a.accent);
    setVal('cfg-text', a.text);
    setVal('cfg-btn-bg', a.btnBg);
    setVal('cfg-glow', a.glow);
    setVal('cfg-border', a.border);
    setVal('cfg-font-username', a.fontUsername);
    setVal('cfg-font-desc', a.fontDesc);

    setCheck('anim-fade', an.fade);
    setCheck('anim-slide', an.slide);
    setCheck('anim-float', an.float);
    setCheck('anim-glow', an.glow);
    setCheck('anim-hover', an.hover);
    setCheck('anim-click', an.click);
    setCheck('anim-rotation', an.rotation);
    setCheck('anim-shine', an.shine);
    setCheck('anim-reduced', an.reduced);

    setVal('cfg-title', s.title);
    setVal('cfg-meta-desc', s.metaDesc);
    setVal('cfg-copyright', s.copyright);
    setCheck('cfg-footer', s.footer);
    setCheck('cfg-share', s.share);
    setCheck('cfg-sound', s.sound);
    setCheck('cfg-vid-ctrl', s.vidCtrl);

    renderProfileImage();
  }

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v != null ? v : '';
  }
  function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v != null ? v : '';
  }
  function setCheck(id, v) {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  }

  function bindAdminInputs() {
    // Username
    onInput('cfg-username', v => { config.profile.username = v; saveConfig(); renderUsername(); });
    onRange('cfg-username-size', 'cfg-username-size-val', v => { config.profile.usernameSize = +v; saveConfig(); applyAppearance(); });
    onInput('cfg-username-weight', v => { config.profile.usernameWeight = v; saveConfig(); applyAppearance(); });
    onRange('cfg-username-spacing', 'cfg-username-spacing-val', v => { config.profile.usernameSpacing = +v; saveConfig(); applyAppearance(); });
    onInput('cfg-username-color', v => { config.profile.usernameColor = v; saveConfig(); renderUsername(); });
    onCheck('cfg-username-gradient', v => { config.profile.usernameGradient = v; saveConfig(); renderUsername(); });
    onCheck('cfg-username-glow', v => { config.profile.usernameGlow = v; saveConfig(); renderUsername(); });
    onCheck('badge-enabled', v => { config.profile.badgeEnabled = v; saveConfig(); renderBadge(); });

    // Description
    onInput('cfg-description', v => { config.profile.description = v; saveConfig(); renderDescription(); });
    onRange('cfg-desc-size', 'cfg-desc-size-val', v => { config.profile.descSize = +v; saveConfig(); applyAppearance(); });
    onInput('cfg-desc-color', v => { config.profile.descColor = v; saveConfig(); renderDescription(); });
    onInput('cfg-desc-align', v => { config.profile.descAlign = v; saveConfig(); renderDescription(); });

    // Rings
    onCheck('rings-enabled', v => { config.soulRings.enabled = v; saveConfig(); renderSoulRings(); });
    onRange('rings-count', 'rings-count-val', v => {
      config.soulRings.count = +v;
      saveConfig();
      renderRingsConfig();
      renderSoulRings();
    });

    // Appearance
    onInput('cfg-primary', v => { config.appearance.primary = v; saveConfig(); applyAppearance(); });
    onInput('cfg-accent', v => { config.appearance.accent = v; saveConfig(); applyAppearance(); });
    onInput('cfg-text', v => { config.appearance.text = v; saveConfig(); applyAppearance(); });
    onInput('cfg-btn-bg', v => { config.appearance.btnBg = v; saveConfig(); applyAppearance(); });
    onInput('cfg-glow', v => { config.appearance.glow = v; saveConfig(); applyAppearance(); });
    onInput('cfg-font-username', v => { config.appearance.fontUsername = v; saveConfig(); applyAppearance(); });
    onInput('cfg-font-desc', v => { config.appearance.fontDesc = v; saveConfig(); applyAppearance(); });

    // Animations
    const animMap = {
      'anim-fade': 'fade', 'anim-slide': 'slide', 'anim-float': 'float',
      'anim-glow': 'glow', 'anim-hover': 'hover', 'anim-click': 'click',
      'anim-rotation': 'rotation', 'anim-shine': 'shine', 'anim-reduced': 'reduced'
    };
    Object.keys(animMap).forEach(id => {
      onCheck(id, v => {
        config.animations[animMap[id]] = v;
        saveConfig();
        applyAppearance();
        renderSoulRings();
      });
    });

    // Settings
    onInput('cfg-title', v => { config.settings.title = v; saveConfig(); renderSettingsUI(); });
    onInput('cfg-meta-desc', v => { config.settings.metaDesc = v; saveConfig(); renderSettingsUI(); });
    onInput('cfg-copyright', v => { config.settings.copyright = v; saveConfig(); renderSettingsUI(); });
    onCheck('cfg-footer', v => { config.settings.footer = v; saveConfig(); renderSettingsUI(); });
    onCheck('cfg-share', v => { config.settings.share = v; saveConfig(); renderSettingsUI(); });
    onCheck('cfg-sound', v => { config.settings.sound = v; saveConfig(); renderSettingsUI(); });
    onCheck('cfg-vid-ctrl', v => { config.settings.vidCtrl = v; saveConfig(); renderSettingsUI(); });

    // Profile image upload
    const imgInput = $('#profile-image-input');
    if (imgInput) {
      imgInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !file.type.startsWith('image/')) {
          showToast('Please select an image');
          return;
        }
        if (file.size > 8 * 1024 * 1024) {
          showToast('Image too large (max ~8MB recommended)');
          return;
        }
        try {
          const id = config.profile.imageId || uid('img');
          await idbPut(STORE_IMAGES, { id, blob: file, name: file.name, type: file.type });
          config.profile.imageId = id;
          saveConfig();
          await renderProfileImage();
          addRecent('Profile image updated');
          showToast('Image saved');
        } catch (err) {
          console.error(err);
          showToast('Could not save image (storage full?)');
        }
        imgInput.value = '';
      });
    }

    $('#remove-profile-image')?.addEventListener('click', async () => {
      if (config.profile.imageId) {
        try { await idbDelete(STORE_IMAGES, config.profile.imageId); } catch (_) {}
        config.profile.imageId = null;
        saveConfig();
        await renderProfileImage();
        addRecent('Profile image removed');
      }
    });

    // Video upload
    const vidInput = $('#video-upload-input');
    if (vidInput) {
      vidInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !file.type.startsWith('video/')) {
          showToast('Please select a video');
          return;
        }
        // Soft limit warning
        if (file.size > 80 * 1024 * 1024) {
          if (!confirm('Large video (' + formatBytes(file.size) + '). Browser storage may fail. Continue?')) {
            vidInput.value = '';
            return;
          }
        }
        try {
          const id = uid('vid');
          await idbPut(STORE_VIDEOS, { id, blob: file, name: file.name, type: file.type });
          let duration = 0;
          try {
            duration = await getVideoDuration(file);
          } catch (_) {}
          config.videos.items.push({
            id,
            name: file.name,
            size: file.size,
            duration,
            default: config.videos.items.length === 0
          });
          if (config.videos.items.length === 1) config.videos.activeIndex = 0;
          saveConfig();
          addRecent('Video uploaded');
          renderVideoList();
          updateStatsUI();
          if (config.videos.items.length === 1) loadActiveVideo();
          showToast('Video saved on this device');
        } catch (err) {
          console.error(err);
          showToast('Storage failed — video too large or quota exceeded');
        }
        vidInput.value = '';
      });
    }

    // Security — change passcode
    $('#change-passcode')?.addEventListener('click', () => {
      const cur = $('#sec-current').value;
      const neu = $('#sec-new').value;
      const conf = $('#sec-confirm').value;
      if (cur !== config.passcode) {
        showToast('Current passcode incorrect');
        return;
      }
      if (!neu || neu.length < 4) {
        showToast('New passcode too short');
        return;
      }
      if (neu !== conf) {
        showToast('Confirmation does not match');
        return;
      }
      config.passcode = neu;
      saveConfig();
      $('#sec-current').value = '';
      $('#sec-new').value = '';
      $('#sec-confirm').value = '';
      addRecent('Passcode changed');
      showToast('Passcode updated');
    });

    // Backup
    $('#export-settings')?.addEventListener('click', () => {
      const exportData = deepClone(config);
      // Do not export passcode in plain form optionally — still include for restore
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'profile-settings-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Settings exported');
    });

    $('#import-settings')?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!confirm('Import will overwrite current settings (not videos). Continue?')) {
        e.target.value = '';
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') throw new Error('Invalid');
        // Preserve video list reference (binaries stay in IDB)
        const videos = config.videos;
        config = mergeDeep(deepClone(DEFAULT_CONFIG), data);
        config.videos = videos;
        saveConfig();
        fillAdminForms();
        applyAllPublic();
        renderButtonList();
        renderRingsConfig();
        addRecent('Settings imported');
        showToast('Settings imported');
      } catch (err) {
        showToast('Import failed — invalid JSON');
      }
      e.target.value = '';
    });

    $('#reset-settings')?.addEventListener('click', () => {
      if (!confirm('Reset ALL settings to defaults? Videos in IndexedDB will remain.')) return;
      if (!confirm('This cannot be undone. Are you sure?')) return;
      const pass = config.passcode;
      const videos = config.videos;
      config = deepClone(DEFAULT_CONFIG);
      config.passcode = pass;
      config.videos = videos;
      saveConfig();
      fillAdminForms();
      applyAllPublic();
      renderButtonList();
      renderRingsConfig();
      addRecent('Settings reset');
      showToast('Settings reset');
    });

    // Add button
    $('#add-button')?.addEventListener('click', () => openButtonModal(null));
    $('#btn-icon-type')?.addEventListener('change', toggleIconFields);
    $('#btn-save')?.addEventListener('click', saveButtonFromModal);
    $('#btn-cancel')?.addEventListener('click', () => {
      $('#btn-modal').hidden = true;
      editingButtonId = null;
    });

    // Sidebar nav
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const sec = item.dataset.section;
        if (sec === 'logout') {
          closeAdmin();
          return;
        }
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        $$('.admin-section').forEach(s => s.classList.remove('active'));
        const panel = $('#sec-' + sec);
        if (panel) panel.classList.add('active');
        const titles = {
          dashboard: 'Dashboard', profile: 'Profile', username: 'Username',
          description: 'Description', soulrings: 'Soul Rings', videos: 'Videos',
          music: 'Music',
          buttons: 'Buttons', appearance: 'Appearance', animations: 'Animations',
          settings: 'Website Settings', security: 'Security', backup: 'Backup'
        };
        const st = $('#section-title');
        if (st) st.textContent = titles[sec] || 'Admin';
        $('#admin-sidebar').classList.remove('open');
      });
    });

    $('#menu-toggle')?.addEventListener('click', () => {
      $('#admin-sidebar').classList.add('open');
    });
    $('#sidebar-close')?.addEventListener('click', () => {
      $('#admin-sidebar').classList.remove('open');
    });

    $('#preview-toggle')?.addEventListener('click', () => {
      const lp = $('#live-preview');
      if (!lp) return;
      lp.classList.toggle('force-show');
      lp.classList.toggle('hidden');
    });
  }

  function onInput(id, cb) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => cb(el.value));
    el.addEventListener('change', () => cb(el.value));
  }

  function onRange(id, valId, cb) {
    const el = document.getElementById(id);
    if (!el) return;
    const update = () => {
      const v = el.value;
      const valEl = document.getElementById(valId);
      if (valEl) valEl.textContent = v;
      cb(v);
    };
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  }

  function onCheck(id, cb) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => cb(el.checked));
  }

  function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        resolve(v.duration);
        URL.revokeObjectURL(v.src);
      };
      v.onerror = reject;
      v.src = URL.createObjectURL(file);
    });
  }

  // ─────────────────────────────────────────
  // Password / Triple-click
  // ─────────────────────────────────────────
  function setupAdminAccess() {
    const btn = $('#avatar-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      // Don't open links etc.
      e.preventDefault();
      const now = Date.now();
      avatarClicks = avatarClicks.filter(t => now - t < CLICK_WINDOW_MS);
      avatarClicks.push(now);
      if (avatarClicks.length >= 3) {
        avatarClicks = [];
        showPassPopup();
      }
    });
  }

  function showPassPopup() {
    const popup = $('#pass-popup');
    const input = $('#pass-input');
    if (!popup || !input) return;
    input.value = '';
    popup.hidden = false;
    setTimeout(() => input.focus(), 50);
  }

  function hidePassPopup() {
    const popup = $('#pass-popup');
    if (popup) popup.hidden = true;
  }

  function setupPassPopup() {
    const done = $('#pass-done');
    const input = $('#pass-input');
    if (!done || !input) return;

    const tryPass = () => {
      const val = input.value;
      if (val === config.passcode) {
        hidePassPopup();
        openAdmin();
      } else {
        hidePassPopup();
        // Silent fail — no error message per requirements
      }
    };

    done.addEventListener('click', tryPass);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tryPass();
      if (e.key === 'Escape') hidePassPopup();
    });

    // Click outside closes
    $('#pass-popup')?.addEventListener('click', (e) => {
      if (e.target.id === 'pass-popup') hidePassPopup();
    });
  }


  // ─────────────────────────────────────────
  // Background Music + Media Session
  // ─────────────────────────────────────────
  let musicObjectUrl = null;

  async function loadMusic() {
    const audio = $('#bg-music');
    if (!audio) return;
    const m = config.music || {};
    if (!m.enabled || !m.audioId) {
      audio.removeAttribute('src');
      audio.load();
      updateMusicIcon(false);
      return;
    }
    try {
      const rec = await idbGet(STORE_AUDIO, m.audioId);
      if (!rec || !rec.blob) {
        updateMusicIcon(false);
        return;
      }
      if (musicObjectUrl) URL.revokeObjectURL(musicObjectUrl);
      musicObjectUrl = URL.createObjectURL(rec.blob);
      audio.src = musicObjectUrl;
      audio.loop = m.loop !== false;
      setupMediaSession();
      if (m.autoplay) {
        audio.play().then(() => {
          config.music.playing = true;
          updateMusicIcon(true);
        }).catch(() => {
          config.music.playing = false;
          updateMusicIcon(false);
        });
      }
      const info = $('#music-file-info');
      if (info) info.textContent = 'File: ' + (m.fileName || 'audio') + (rec.blob.size ? ' · ' + formatBytes(rec.blob.size) : '');
    } catch (e) {
      console.warn('Music load error', e);
    }
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const m = config.music || {};
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: m.title || 'Background Music',
        artist: m.artist || 'Profile',
        album: config.profile.username || 'Profile',
        artwork: []
      });
      navigator.mediaSession.setActionHandler('play', () => { toggleMusic(true); });
      navigator.mediaSession.setActionHandler('pause', () => { toggleMusic(false); });
      navigator.mediaSession.setActionHandler('stop', () => { toggleMusic(false); });
    } catch (e) {
      console.warn('MediaSession setup', e);
    }
  }

  function toggleMusic(forcePlay) {
    const audio = $('#bg-music');
    if (!audio || !audio.src) {
      showToast('No music uploaded');
      return;
    }
    const shouldPlay = forcePlay === true ? true : forcePlay === false ? false : audio.paused;
    if (shouldPlay) {
      audio.play().then(() => {
        config.music.playing = true;
        updateMusicIcon(true);
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch (_) {}
        }
      }).catch(() => showToast('Could not play music'));
    } else {
      audio.pause();
      config.music.playing = false;
      updateMusicIcon(false);
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = 'paused'; } catch (_) {}
      }
    }
  }

  function updateMusicIcon(playing) {
    const btn = $('#music-btn');
    const icon = $('#music-icon');
    if (btn) btn.classList.toggle('playing', !!playing);
    if (icon) {
      icon.setAttribute('data-lucide', playing ? 'pause' : 'music');
      if (window.lucide) try { window.lucide.createIcons(); } catch (_) {}
    }
  }

  function fillMusicAdmin() {
    const m = config.music || {};
    const en = $('#music-enabled');
    if (en) en.checked = m.enabled !== false;
    const t = $('#music-title');
    if (t) t.value = m.title || '';
    const a = $('#music-artist');
    if (a) a.value = m.artist || '';
    const lp = $('#music-loop');
    if (lp) lp.checked = m.loop !== false;
    const ap = $('#music-autoplay');
    if (ap) ap.checked = !!m.autoplay;
    const info = $('#music-file-info');
    if (info) info.textContent = m.fileName ? ('File: ' + m.fileName) : 'No music file uploaded yet.';
  }

  function bindMusicAdmin() {
    onCheck('music-enabled', v => {
      config.music = config.music || {};
      config.music.enabled = v;
      saveConfig();
      if (!v) {
        const audio = $('#bg-music');
        if (audio) { audio.pause(); }
        updateMusicIcon(false);
      } else {
        loadMusic();
      }
    });
    onInput('music-title', v => { config.music = config.music || {}; config.music.title = v; saveConfig(); setupMediaSession(); });
    onInput('music-artist', v => { config.music = config.music || {}; config.music.artist = v; saveConfig(); setupMediaSession(); });
    onCheck('music-loop', v => {
      config.music = config.music || {};
      config.music.loop = v;
      const audio = $('#bg-music');
      if (audio) audio.loop = v;
      saveConfig();
    });
    onCheck('music-autoplay', v => { config.music = config.music || {}; config.music.autoplay = v; saveConfig(); });

    const input = $('#music-upload-input');
    if (input) {
      input.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !file.type.startsWith('audio/')) {
          showToast('Please select an audio file');
          return;
        }
        if (file.size > 30 * 1024 * 1024) {
          if (!confirm('Large audio file. Continue?')) { input.value = ''; return; }
        }
        try {
          const id = (config.music && config.music.audioId) || uid('aud');
          await idbPut(STORE_AUDIO, { id, blob: file, name: file.name, type: file.type });
          config.music = config.music || {};
          config.music.audioId = id;
          config.music.fileName = file.name;
          config.music.enabled = true;
          saveConfig();
          addRecent('Music uploaded');
          fillMusicAdmin();
          await loadMusic();
          showToast('Music saved on this device');
        } catch (err) {
          console.error(err);
          showToast('Could not save audio (storage full?)');
        }
        input.value = '';
      });
    }

    $('#music-remove')?.addEventListener('click', async () => {
      if (!config.music || !config.music.audioId) return;
      if (!confirm('Remove music file?')) return;
      try { await idbDelete(STORE_AUDIO, config.music.audioId); } catch (_) {}
      if (musicObjectUrl) { URL.revokeObjectURL(musicObjectUrl); musicObjectUrl = null; }
      config.music.audioId = null;
      config.music.fileName = '';
      config.music.playing = false;
      saveConfig();
      const audio = $('#bg-music');
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      updateMusicIcon(false);
      fillMusicAdmin();
      addRecent('Music removed');
      showToast('Music removed');
    });
  }

  // ─────────────────────────────────────────
  // Public controls (share, mute, play, nav)
  // ─────────────────────────────────────────
  function setupPublicControls() {
    $('#share-btn')?.addEventListener('click', async () => {
      const url = location.href;
      const title = config.settings.title || document.title;
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (_) {}
      }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied');
      } catch {
        showToast('Copy failed');
      }
    });

    $('#mute-btn')?.addEventListener('click', () => {
      const video = $('#bg-video');
      config.videos.muted = !config.videos.muted;
      if (video) video.muted = config.videos.muted;
      saveConfig();
      updateMuteIcon();
    });

    $('#play-pause-btn')?.addEventListener('click', () => {
      const video = $('#bg-video');
      if (!video || !video.src) return;
      if (video.paused) {
        video.play().then(() => {
          config.videos.playing = true;
          updatePlayIcon();
        }).catch(() => {});
      } else {
        video.pause();
        config.videos.playing = false;
        updatePlayIcon();
      }
    });

    $('#prev-video')?.addEventListener('click', () => switchVideo(-1));
    $('#next-video')?.addEventListener('click', () => switchVideo(1));

    $('#music-btn')?.addEventListener('click', () => toggleMusic());
  }

  // ─────────────────────────────────────────
  // Apply everything (public)
  // ─────────────────────────────────────────
  function applyAllPublic() {
    applyAppearance();
    renderUsername();
    renderBadge();
    renderDescription();
    renderSoulRings();
    renderButtons();
    renderSettingsUI();
    renderProfileImage();
    loadActiveVideo();
    loadMusic();
    updateStatsUI();
  }

  // ─────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────
  async function init() {
    loadConfig();

    // Page view
    config.stats.views = (config.stats.views || 0) + 1;
    saveConfig();

    try {
      await openDB();
    } catch (e) {
      console.warn('IndexedDB unavailable', e);
      showToast('Local file storage unavailable');
    }

    applyAllPublic();
    setupAdminAccess();
    setupPassPopup();
    setupPublicControls();
    bindAdminInputs();
    bindMusicAdmin();

    // Lucide
    if (window.lucide) {
      try { window.lucide.createIcons(); } catch (_) {}
    } else {
      // Wait for deferred script
      window.addEventListener('load', () => {
        if (window.lucide) try { window.lucide.createIcons(); } catch (_) {}
      });
    }

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#pass-popup').hidden) hidePassPopup();
        if (!$('#btn-modal').hidden) {
          $('#btn-modal').hidden = true;
          editingButtonId = null;
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
