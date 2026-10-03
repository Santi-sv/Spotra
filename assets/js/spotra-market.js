/* SPOTRA · Market C2C (v3, estilo Facebook Marketplace)
   - Buscador, ubicación + radio, categorías de riders con íconos, filtros (precio, estado, orden).
   - Tarjetas con precio grande, "Recién publicado", distancia y ♥ Guardar.
   - Pestañas: Explorar · Guardados · Mis publicaciones. En compu: menú lateral; en celular: arriba.
   - Detalle: galería deslizable, vendedor, WhatsApp, Guardar, Compartir, Reportar. Link: /?listing=ID#market
   - Publicar: moderación admin, hasta 6 fotos, contacto por WhatsApp. */
(function(){
  const CUR = { UYU: '$U', USD: 'US$', ARS: 'AR$', BRL: 'R$' };
  const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const CATS = [
    ['all', 'Todo', I('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>')],
    ['tablas', 'Tablas', I('<path d="M3 13c2-1 16-5 18-4s-1 3-3 4-13 4-15 3-1-2 0-3Z"/><circle cx="7" cy="17" r="1.6"/><circle cx="16" cy="14.5" r="1.6"/>')],
    ['trucks', 'Trucks', I('<path d="M4 9h16M8 9v3h8V9M12 12v4"/><circle cx="6" cy="15" r="2"/><circle cx="18" cy="15" r="2"/>')],
    ['ruedas', 'Ruedas y rulemanes', I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>')],
    ['zapatillas', 'Zapatillas', I('<path d="M3 16v-5l4-1 3 2h3l5 2 3 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M3 15h18"/>')],
    ['ropa', 'Ropa', I('<path d="M9 4 4 6l1 5 3-1v10h8V10l3 1 1-5-5-2a3 3 0 0 1-6 0Z"/>')],
    ['protecciones', 'Protecciones', I('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/>')],
    ['bicis', 'BMX', I('<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 6h3"/>')],
    ['rollers', 'Rollers', I('<path d="M7 3h5v8l6 3v3H6V5"/><circle cx="8" cy="20" r="1.5"/><circle cx="12" cy="20" r="1.5"/><circle cx="16" cy="20" r="1.5"/>')],
    ['scooters', 'Scooters', I('<path d="M15 4h3l-2 13M4 17h12"/><circle cx="5" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>')],
    ['otros', 'Otros', I('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>')]
  ];
  const CAT_LABEL = Object.fromEntries(CATS.map(c => [c[0], c[1]]));
  const COND_LABEL = { 'nuevo': 'Nuevo', 'como-nuevo': 'Usado — como nuevo', 'bueno': 'Usado — bueno', 'con-detalles': 'Usado — con detalles' };
  const STATUS_LABEL = { pending: 'Pendiente', approved: 'Publicado', rejected: 'Rechazado', archived: 'Retirado' };
  const ICON = {
    search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    store: I('<path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v9h12v-9M9 19v-5h6v5"/>'),
    heart: I('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
    tag: I('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/>'),
    pin: I('<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.4"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    back: I('<path d="M15 6l-6 6 6 6"/>'),
    share: I('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/>'),
    flag: I('<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>'),
    user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>'),
    down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
    filter: I('<path d="M4 6h16M7 12h10M10 18h4"/>')
  };

  let tab = 'explore';          // explore | saved | mine
  let cat = 'all';
  let query = '';
  let filters = { min: '', max: '', cond: 'all', sort: 'auto' };
  let showFilters = false;
  let userLoc = null;
  let placeName = '';
  let radius = 0;               // 0 = todas las distancias
  let cache = [];
  let byId = new Map();
  let saved = new Set();
  let savedCol = new Map();      // listing_id -> collection_id
  let cols = [];                 // [{ id, name }]
  let viewCol = null;            // colección abierta (id) o 'recent'
  const RECENT_KEY = 'spotra_mk_recent';
  const recentIds = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(e){ return []; } };
  function pushRecent(id){ try { const r = recentIds().filter(x => x !== id); r.unshift(id); localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 30))); } catch(e){} }
  let current = null;
  let photoFiles = [];
  let deepListing = null;
  try { deepListing = new URLSearchParams(location.search).get('listing'); } catch(e){}

  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const lang = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function B(){ return window.SpotraBackend || null; }
  const $ = id => document.getElementById(id);
  const view = () => document.querySelector('[data-view="market"]');

  function fmtPrice(l){
    const sym = CUR[l.currency] || l.currency;
    const n = Number(l.price);
    if(n === 0) return t('Gratis');
    return sym + ' ' + (Number.isFinite(n) ? n.toLocaleString('es-UY', { maximumFractionDigits: 0 }) : l.price);
  }
  function distMeters(a, b){
    const R = 6371000, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function fmtKm(m){
    if(!Number.isFinite(m)) return '';
    if(m < 1000) return '< 1 km';
    return (m / 1000 < 10 ? (m / 1000).toFixed(1).replace('.', ',') : Math.round(m / 1000)) + ' km';
  }
  function dist(l){
    if(!userLoc || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return null;
    return distMeters(userLoc, { lat: l.lat, lng: l.lng });
  }
  const isNew = l => l.createdAt && (Date.now() - l.createdAt.getTime()) < 86400000;
  function ago(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const m = Math.floor((Date.now() - d.getTime()) / 60000), L = lang();
    if(m < 60) return ({ es: `hace ${Math.max(1, m)} min`, pt: `há ${Math.max(1, m)} min`, en: `${Math.max(1, m)} min ago` })[L];
    const h = Math.floor(m / 60);
    if(h < 24) return ({ es: `hace ${h} h`, pt: `há ${h} h`, en: `${h} h ago` })[L];
    const dd = Math.floor(h / 24);
    return ({ es: `hace ${dd} ${dd === 1 ? 'día' : 'días'}`, pt: `há ${dd} ${dd === 1 ? 'dia' : 'dias'}`, en: `${dd} ${dd === 1 ? 'day' : 'days'} ago` })[L];
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }
  async function uid(){ try { return await B().getUserId(); } catch(e){ return null; } }

  /* ================= Estructura ================= */
  function shell(){
    const v = view();
    if(!v) return null;
    if(!$('mkSide')) v.innerHTML = '<div class="mk"><aside class="mk-side" id="mkSide"></aside><div class="mk-main" id="mkMain"></div></div>';
    return v;
  }

  function sideHTML(){
    const loc = userLoc
      ? `<button type="button" class="mk-loc" data-mk-radius>${ICON.pin}<span>${esc(placeName || t('Tu ubicación'))} · ${radius ? radius + ' km' : esc(t('Todas las distancias'))}</span></button>`
      : `<button type="button" class="mk-loc" data-mk-near>${ICON.pin}<span>${esc(t('Ver lo más cerca'))}</span></button>`;
    return `<div class="mk-title"><h1>Market</h1><button type="button" class="mk-pub-mini" data-open-modal="product" aria-label="${esc(t('Publicar'))}">${ICON.plus}</button></div>
      <label class="mk-search">${ICON.search}<input id="mkSearch" type="search" value="${esc(query)}" placeholder="${esc(t('Buscar en el Market'))}" autocomplete="off" enterkeyhint="search"></label>
      <nav class="mk-tabs">
        <button type="button" data-mk-tab="explore" class="${tab === 'explore' ? 'active' : ''}">${ICON.store}<span>${esc(t('Explorar'))}</span></button>
        <button type="button" data-mk-tab="saved" class="${tab === 'saved' ? 'active' : ''}">${ICON.heart}<span>${esc(t('Guardados'))}</span></button>
        <button type="button" data-mk-tab="you" class="${tab === 'you' || tab === 'mine' ? 'active' : ''}">${ICON.user}<span>${esc(t('Tú'))}</span></button>
      </nav>
      <button type="button" class="mk-pub" data-open-modal="product">${ICON.plus}<span>${esc(t('Publicar'))}</span></button>
      <div class="mk-label mk-hide-m">${esc(t('Ubicación'))}</div>
      ${loc}
      <div class="mk-label mk-hide-m">${esc(t('Categorías'))}</div>
      <div class="mk-cats">${CATS.map(([k, label, ic]) => `<button type="button" data-mk-cat="${k}" class="${cat === k ? 'active' : ''}"><span class="ic">${ic}</span><span>${esc(t(label))}</span></button>`).join('')}</div>`;
  }

  function renderSide(){
    const s = $('mkSide');
    if(!s) return;
    const focused = document.activeElement && document.activeElement.id === 'mkSearch';
    s.innerHTML = sideHTML();
    if(focused){ const i = $('mkSearch'); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }

  /* ================= Tarjetas ================= */
  const dropped = l => l.previousPrice != null && l.previousPrice > l.price && l.priceDroppedAt && (Date.now() - l.priceDroppedAt.getTime()) < 14 * 86400000;
  function oldPrice(l){ return dropped(l) ? `<s class="mk-old">${esc(fmtPrice({ price: l.previousPrice, currency: l.currency }))}</s>` : ''; }
  function cardHTML(l){
    const d = dist(l);
    const meta = [l.city, d != null ? fmtKm(d) : ''].filter(Boolean).join(' · ');
    const img = l.photos[0] ? `style="background-image:url('${esc(l.photos[0])}')"` : '';
    const badge = d != null && d < 5000 ? 'Cerca' : dropped(l) ? 'Rebajado' : isNew(l) ? 'Recién publicado' : '';
    return `<article class="mk-card" data-ml-open="${esc(l.id)}" data-author="${esc(l.sellerId)}">
      <div class="mk-img" ${img}>
        ${badge ? `<span class="mk-new${badge === 'Rebajado' ? ' mk-drop' : ''}">${esc(t(badge))}</span>` : ''}
        ${l.sold ? `<span class="mk-new mk-soldtag">${esc(t('Vendido'))}</span>` : ''}
        <button type="button" class="mk-heart${saved.has(l.id) ? ' on' : ''}" data-mk-save="${esc(l.id)}" aria-label="${esc(t('Guardar'))}">${ICON.heart}</button>
      </div>
      <div class="mk-line"><b>${esc(fmtPrice(l))}</b>${oldPrice(l)}<span> · ${esc(l.title)}</span></div>
      <div class="mk-meta">${esc(meta)}</div>
    </article>`;
  }

  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function filtered(list){
    const words = fold(query).split(/\s+/).filter(Boolean);
    let out = list.filter(l => {
      if(cat !== 'all' && l.category !== cat) return false;
      if(filters.cond !== 'all' && (filters.cond === 'nuevo' ? l.condition !== 'nuevo' : l.condition === 'nuevo')) return false;
      const n = Number(l.price);
      if(filters.min !== '' && n < Number(filters.min)) return false;
      if(filters.max !== '' && n > Number(filters.max)) return false;
      if(words.length){ const hay = fold(l.title + ' ' + l.description + ' ' + l.city); if(!words.every(w => hay.includes(w))) return false; }
      if(userLoc && radius){ const d = dist(l); if(d == null || d > radius * 1000) return false; }
      return true;
    });
    const sort = filters.sort === 'auto' ? (userLoc ? 'near' : 'new') : filters.sort;
    if(sort === 'near') out.sort((a, b) => (dist(a) ?? 1e12) - (dist(b) ?? 1e12));
    else if(sort === 'cheap') out.sort((a, b) => a.price - b.price);
    else if(sort === 'expensive') out.sort((a, b) => b.price - a.price);
    else out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }

  function filterBarHTML(){
    const chip = (k, label) => `<button type="button" class="mk-chip${filters.sort === k ? ' active' : ''}" data-mk-sort="${k}">${esc(t(label))}</button>`;
    const active = filters.min !== '' || filters.max !== '' || filters.cond !== 'all';
    return `<div class="mk-bar">
      <button type="button" class="mk-chip${showFilters || active ? ' active' : ''}" data-mk-filters>${ICON.filter}<span>${esc(t('Filtros'))}</span></button>
      ${chip('auto', userLoc ? 'Más cerca' : 'Más recientes')}${userLoc ? chip('new', 'Más recientes') : ''}${chip('cheap', 'Menor precio')}${chip('expensive', 'Mayor precio')}
    </div>
    ${showFilters ? `<div class="mk-filters-box">
      <div class="mk-row"><label>${esc(t('Precio mínimo'))}<input type="number" inputmode="numeric" min="0" id="mkMin" value="${esc(filters.min)}"></label>
      <label>${esc(t('Precio máximo'))}<input type="number" inputmode="numeric" min="0" id="mkMax" value="${esc(filters.max)}"></label></div>
      <div class="mk-row mk-seg">${[['all', 'Todos'], ['nuevo', 'Nuevo'], ['usado', 'Usado']].map(([k, l]) => `<button type="button" data-mk-cond="${k}" class="${filters.cond === k ? 'active' : ''}">${esc(t(l))}</button>`).join('')}</div>
      <div class="mk-row"><button type="button" class="ghost-btn" data-mk-clear>${esc(t('Limpiar filtros'))}</button><button type="button" class="primary-btn" data-mk-apply>${esc(t('Aplicar'))}</button></div>
    </div>` : ''}`;
  }

  function renderExplore(){
    const main = $('mkMain');
    if(!main) return;
    const list = filtered(cache);
    const busy = query || cat !== 'all' || radius || filters.min !== '' || filters.max !== '' || filters.cond !== 'all';
    const title = query ? `${t('Resultados para')} "${query}"` : cat !== 'all' ? t(CAT_LABEL[cat]) : (userLoc ? t('Cerca tuyo') : t('Recién publicados'));
    main.innerHTML = `<div class="mk-head"><h2>${esc(title)}</h2>${userLoc ? `<button type="button" class="mk-loc-mini" data-mk-radius>${ICON.pin}<span>${esc(placeName || t('Tu ubicación'))}${radius ? ' · ' + radius + ' km' : ''}</span></button>` : ''}</div>
      ${filterBarHTML()}
      ${list.length ? `<div class="mk-grid">${list.map(cardHTML).join('')}</div>`
        : `<div class="empty-state">${ICON.store}<b>${esc(t(busy ? 'No encontramos productos con esos filtros' : 'Todavía no hay publicaciones acá'))}</b>${esc(t(busy ? 'Probá con otra búsqueda o ampliá la distancia.' : 'Publicá lo que ya no uses y dale una segunda vida.'))}</div>`}`;
  }

  async function loadExplore(){
    const main = $('mkMain');
    if(main && !cache.length) main.innerHTML = `<div class="meta" style="margin-top:10px">${esc(t('Cargando publicaciones...'))}</div>`;
    cache = await B().listListings({ limit: 300 });
    cache.forEach(l => byId.set(l.id, l));
    if(!current) renderExplore();
    if(deepListing){ const id = deepListing; deepListing = null; try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){} openDetail(id); }
  }

  /* ================= Guardados ================= */
  async function loadSaved(){
    const c = await db(); const me = await uid();
    if(!c || !me){ saved = new Set(); return; }
    const [{ data }, { data: cs }] = await Promise.all([c.from('saved_listings').select('listing_id, collection_id'), c.from('listing_collections').select('id, name').order('created_at')]);
    saved = new Set((data || []).map(r => r.listing_id));
    savedCol = new Map((data || []).map(r => [r.listing_id, r.collection_id]));
    cols = cs || [];
  }

  async function renderSaved(){
    const main = $('mkMain');
    if(!main) return;
    const me = await uid();
    if(!me){ main.innerHTML = `<div class="meta">${esc(t('Iniciá sesión para guardar productos.'))}</div>`; return; }
    await loadSaved();
    const missing = [...saved].filter(id => !byId.has(id));
    if(missing.length){
      const c = await db();
      const { data } = await c.from('listings').select('id, seller_id, username, whatsapp, title, description, category, condition, price, currency, city, latitude, longitude, photos, status, sold, created_at').in('id', missing);
      (data || []).forEach(r => byId.set(r.id, { id: r.id, sellerId: r.seller_id, username: r.username || 'rider', whatsapp: r.whatsapp || '', title: r.title, description: r.description || '', category: r.category, condition: r.condition, price: Number(r.price), currency: r.currency, city: r.city || '', lat: r.latitude, lng: r.longitude, photos: r.photos || [], status: r.status, sold: !!r.sold, createdAt: r.created_at ? new Date(r.created_at) : null }));
    }
    const list = [...saved].map(id => byId.get(id)).filter(Boolean);
    main.innerHTML = `<div class="mk-head"><h2>${esc(t('Guardados'))}</h2></div>` + (list.length
      ? `<div class="mk-grid">${list.map(cardHTML).join('')}</div>`
      : `<div class="empty-state">${ICON.heart}<b>${esc(t('Todavía no guardaste nada'))}</b>${esc(t('Tocá el corazón de un producto para verlo acá después.'))}</div>`);
  }

  async function toggleSave(id){
    const c = await db(); const me = await uid();
    if(!c || !me){ toast(t('Iniciá sesión para guardar productos.')); return; }
    const on = !saved.has(id);
    const paint = v => document.querySelectorAll(`[data-mk-save="${id}"]`).forEach(b => b.classList.toggle('on', v));
    on ? saved.add(id) : saved.delete(id);
    paint(on);
    const res = on ? await c.from('saved_listings').insert({ listing_id: id }) : await c.from('saved_listings').delete().eq('listing_id', id).eq('profile_id', me);
    if(res.error && !(on && res.error.code === '23505')){
      on ? saved.delete(id) : saved.add(id);
      paint(!on);
      toast(t('No se pudo. Probá de nuevo.'));
      return;
    }
    toast(t(on ? 'Guardado.' : 'Quitado de guardados.'));
    if(tab === 'saved' && !on && !current) renderSaved();
  }

  /* ================= Panel "Tú" ================= */
  async function ensureListings(ids){
    const missing = ids.filter(id => !byId.has(id));
    if(!missing.length) return;
    const c = await db();
    const { data } = await c.from('listings').select('id, seller_id, username, whatsapp, title, description, category, condition, price, currency, city, latitude, longitude, photos, status, sold, created_at, previous_price, price_dropped_at').in('id', missing.slice(0, 60));
    (data || []).forEach(r => byId.set(r.id, { id: r.id, sellerId: r.seller_id, username: r.username || 'rider', whatsapp: r.whatsapp || '', title: r.title, description: r.description || '', category: r.category, condition: r.condition, price: Number(r.price), currency: r.currency, city: r.city || '', lat: r.latitude, lng: r.longitude, photos: r.photos || [], status: r.status, sold: !!r.sold, createdAt: r.created_at ? new Date(r.created_at) : null, previousPrice: r.previous_price != null ? Number(r.previous_price) : null, priceDroppedAt: r.price_dropped_at ? new Date(r.price_dropped_at) : null }));
  }

  async function renderYou(){
    const main = $('mkMain');
    if(!main) return;
    const me = await uid();
    if(!me){ main.innerHTML = `<div class="meta">${esc(t('Iniciá sesión para ver tu panel.'))}</div>`; return; }
    main.innerHTML = `<div class="meta">${esc(t('Cargando...'))}</div>`;
    await loadSaved();
    const mine = await B().listMyListings();
    mine.forEach(l => byId.set(l.id, l));
    const recent = recentIds();
    await ensureListings([...saved].concat(recent));
    const colCover = id => { const it = [...savedCol.entries()].find(([lid, cid]) => cid === id && byId.get(lid)); const l = it && byId.get(it[0]); return l && l.photos[0] ? `style="background-image:url('${esc(l.photos[0])}')"` : ''; };
    const colCount = id => [...savedCol.values()].filter(v => v === id).length;
    main.innerHTML = `<div class="mk-head"><h2>${esc(t('Tú'))}</h2></div>
      <div class="mk-you">
        <button type="button" class="mk-ycard" data-mk-tab="saved">${ICON.heart}<b>${saved.size} ${esc(t(saved.size === 1 ? 'guardado' : 'guardados'))}</b></button>
        <button type="button" class="mk-ycard" data-mk-list="recent">${ICON.clock}<b>${esc(t('Vistos recientemente'))}</b></button>
        <button type="button" class="mk-ycard" data-mk-tab="mine">${ICON.tag}<b>${esc(t('Tus publicaciones'))} (${mine.length})</b></button>
        <button type="button" class="mk-ycard accent" data-open-modal="product">${ICON.plus}<b>${esc(t('Publicar algo'))}</b></button>
      </div>
      <div class="mk-yhead"><h3>${esc(t('Venta'))}</h3></div>
      <div class="mk-ylist">
        <button type="button" data-mk-tab="mine">${ICON.tag}<span>${esc(t('Tus publicaciones'))} (${mine.length})</span></button>
        <button type="button" data-mk-tab="mine">${ICON.down}<span>${esc(t('Bajar precio o marcar vendido'))}</span></button>
      </div>
      <div class="mk-yhead"><h3>${esc(t('Colecciones'))}</h3><button type="button" class="mk-link" data-mk-newcol>+ ${esc(t('Nueva'))}</button></div>
      ${cols.length ? `<div class="mk-cols">${cols.map(c => `<button type="button" class="mk-colcard" data-mk-list="${esc(c.id)}"><span class="mk-colimg" ${colCover(c.id)}>${colCover(c.id) ? '' : ICON.folder}</span><b>${esc(c.name)}</b><small>${colCount(c.id)} ${esc(t('guardados'))}</small></button>`).join('')}</div>`
        : `<p class="meta">${esc(t('Organizá tus guardados en colecciones, por ejemplo "Para mi tabla".'))}</p>`}`;
  }

  async function renderList(which){
    const main = $('mkMain');
    if(!main) return;
    let ids, title;
    if(which === 'recent'){ ids = recentIds(); title = t('Vistos recientemente'); }
    else { ids = [...savedCol.entries()].filter(([, c]) => c === which).map(([id]) => id); const c = cols.find(x => x.id === which); title = c ? c.name : t('Colección'); }
    await ensureListings(ids);
    const list = ids.map(id => byId.get(id)).filter(Boolean);
    main.innerHTML = `<button type="button" class="mk-back" data-mk-tab="you">${ICON.back}<span>${esc(t('Tú'))}</span></button>
      <div class="mk-head"><h2>${esc(title)}</h2>${which !== 'recent' ? `<button type="button" class="mk-link" data-mk-delcol="${esc(which)}">${esc(t('Eliminar colección'))}</button>` : `<button type="button" class="mk-link" data-mk-clearrecent>${esc(t('Borrar historial'))}</button>`}</div>
      ${list.length ? `<div class="mk-grid">${list.map(cardHTML).join('')}</div>` : `<div class="empty-state">${ICON.folder}<b>${esc(t('Todavía no hay nada acá'))}</b></div>`}`;
  }

  async function setCollection(listingId, value){
    const c = await db(); const me = await uid();
    if(!c || !me){ toast(t('Iniciá sesión para guardar productos.')); return; }
    let colId = value || null;
    if(value === '__new'){
      const name = (window.prompt(t('Nombre de la colección')) || '').trim().slice(0, 40);
      if(!name){ openDetail(listingId); return; }
      const { data, error } = await c.from('listing_collections').insert({ name }).select('id, name').single();
      if(error){ toast(t('No se pudo crear la colección.')); return; }
      cols.push(data); colId = data.id;
    }
    if(!saved.has(listingId)){
      const r = await c.from('saved_listings').insert({ listing_id: listingId, collection_id: colId });
      if(r.error && r.error.code !== '23505'){ toast(t('No se pudo. Probá de nuevo.')); return; }
      saved.add(listingId);
    } else {
      const r = await c.from('saved_listings').update({ collection_id: colId }).eq('listing_id', listingId).eq('profile_id', me);
      if(r.error){ toast(t('No se pudo. Probá de nuevo.')); return; }
    }
    savedCol.set(listingId, colId);
    toast(t(colId ? 'Guardado en la colección.' : 'Guardado.'));
    if(current && current.id === listingId) openDetail(listingId);
  }

  /* ================= Mis publicaciones ================= */
  async function renderMine(){
    const main = $('mkMain');
    if(!main) return;
    const head = `<div class="mk-head"><h2>${esc(t('Mis publicaciones'))}</h2></div>`;
    main.innerHTML = head + `<div class="meta">${esc(t('Cargando tus publicaciones...'))}</div>`;
    const mine = await B().listMyListings();
    mine.forEach(l => byId.set(l.id, l));
    if(!mine.length){
      main.innerHTML = head + `<div class="empty-state">${ICON.tag}<b>${esc(t('Todavía no publicaste nada'))}</b>${esc(t('Tocá "Publicar" y vendé lo que ya no uses.'))}</div>`;
      return;
    }
    main.innerHTML = head + '<div class="mk-mine">' + mine.map(l => {
      const st = l.sold ? 'Vendido' : STATUS_LABEL[l.status] || l.status;
      const cls = l.sold ? '' : l.status === 'approved' ? 'on' : l.status === 'pending' ? 'warn' : 'off';
      const actions = [];
      if(!l.sold && l.status === 'approved') actions.push(`<button type="button" class="ev-chip" data-ml-drop="${esc(l.id)}">${esc(t('Bajar precio'))}</button>`, `<button type="button" class="ev-chip" data-ml-sold="${esc(l.id)}">${esc(t('Marcar vendido'))}</button>`);
      actions.push(`<button type="button" class="ev-chip" data-ml-del="${esc(l.id)}">${esc(t('Eliminar'))}</button>`);
      return `<div class="ml-row${l.sold ? ' sold' : ''}">
        <div class="thumb" style="${l.photos[0] ? `background-image:url('${esc(l.photos[0])}')` : ''}" ${l.status === 'approved' ? `data-ml-open="${esc(l.id)}"` : ''}></div>
        <div style="flex:1;min-width:0">
          <b style="font-size:14px">${esc(l.title)}</b>
          <div class="mk-price" style="font-size:16px;margin:2px 0">${esc(fmtPrice(l))} ${oldPrice(l)}</div>
          <div class="ev-chips" style="margin-top:5px"><span class="ev-chip ${cls}">${esc(t(st))}</span>${actions.join('')}</div>
        </div></div>`;
    }).join('') + '</div>';
  }

  /* ================= Detalle ================= */
  function openDetail(id){
    const l = byId.get(id);
    if(!l){ toast(t('No se pudo abrir la publicación.')); return; }
    current = l;
    pushRecent(l.id);
    const main = $('mkMain');
    if(!main) return;
    view().classList.add('mk-detail-open');
    const d = dist(l);
    const num = String(l.whatsapp || '').replace(/[^\d]/g, '');
    const msg = ({ es: `¡Hola! Vi tu publicación "${l.title}" en SPOTRA. ¿Sigue disponible?`, pt: `Olá! Vi seu anúncio "${l.title}" no SPOTRA. Ainda está disponível?`, en: `Hi! I saw your listing "${l.title}" on SPOTRA. Is it still available?` })[lang()];
    const wa = num && !l.sold ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : '';
    const photos = l.photos.length ? l.photos : [''];
    const initial = esc(String(l.username || 'R').charAt(0).toUpperCase());
    main.innerHTML = `<button type="button" class="mk-back" data-mk-back>${ICON.back}<span>${esc(t('Volver al market'))}</span></button>
      <div class="mk-detail">
        <div class="mk-gallery-wrap">
          <div class="mk-gallery" id="mkGallery">${photos.map(p => `<div class="mk-slide" ${p ? `style="background-image:url('${esc(p)}')" data-lightbox="${esc(p)}"` : ''}></div>`).join('')}</div>
          ${photos.length > 1 ? `<div class="mk-dots">${photos.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>` : ''}
        </div>
        <div class="mk-info">
          <div class="mk-dprice">${esc(fmtPrice(l))} ${oldPrice(l)}</div>
          <h2 class="mk-dtitle">${esc(l.title)}</h2>
          <div class="mk-meta">${[l.city, d != null ? fmtKm(d) : '', ago(l.createdAt)].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="ev-chips" style="margin-top:10px"><span class="ev-chip on">${esc(t(CAT_LABEL[l.category] || l.category))}</span><span class="ev-chip">${esc(t(COND_LABEL[l.condition] || l.condition))}</span>${l.sold ? `<span class="ev-chip off">${esc(t('Vendido'))}</span>` : ''}</div>
          ${wa ? `<a class="primary-btn mk-wa" href="${esc(wa)}" target="_blank" rel="noopener">${ICON.wa}<span>${esc(t('Contactar por WhatsApp'))}</span></a>` : ''}
          <div class="mk-actions">
            <button type="button" class="mk-act${saved.has(l.id) ? ' on' : ''}" data-mk-save="${esc(l.id)}">${ICON.heart}<span>${esc(t('Guardar'))}</span></button>
            <button type="button" class="mk-act" data-mk-share>${ICON.share}<span>${esc(t('Compartir'))}</span></button>
          </div>
          <label class="mk-colsel">${ICON.folder}<select data-mk-col="${esc(l.id)}"><option value="">${esc(t(saved.has(l.id) ? 'Guardado sin colección' : 'Guardar en una colección...'))}</option>${cols.map(c => `<option value="${esc(c.id)}" ${savedCol.get(l.id) === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">+ ${esc(t('Nueva colección'))}</option></select></label>
          ${l.description ? `<div class="mk-label">${esc(t('Descripción'))}</div><p class="mk-desc">${esc(l.description)}</p>` : ''}
          <div class="mk-label">${esc(t('Vendedor'))}</div>
          <button type="button" class="mk-seller" data-rider="${esc(l.sellerId)}"><span class="mk-sav">${initial}</span><span><b>@${esc(l.username)}</b><small>${esc(t('Ver perfil'))}</small></span></button>
          <button type="button" class="report-link" data-report="listing" data-report-id="${esc(l.id)}" data-report-user="${esc(l.sellerId)}" data-report-name="${esc(l.username)}">${ICON.flag}${esc(t('Reportar publicación'))}</button>
        </div>
      </div>`;
    const g = $('mkGallery');
    if(g) g.addEventListener('scroll', () => {
      const i = Math.round(g.scrollLeft / Math.max(1, g.clientWidth));
      document.querySelectorAll('.mk-dots span').forEach((s, k) => s.classList.toggle('on', k === i));
    }, { passive: true });
    window.scrollTo(0, 0);
  }

  function closeDetail(){
    current = null;
    const v = view();
    if(v) v.classList.remove('mk-detail-open');
    render();
  }

  /* ================= Ubicación ================= */
  function locate(quiet){
    if(!navigator.geolocation){ if(!quiet) toast(t('Tu dispositivo no permite ubicación.')); return; }
    if(!quiet) toast(t('Buscando tu ubicación...'));
    navigator.geolocation.getCurrentPosition(async pos => {
      userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if(!radius) radius = 25;
      renderSide(); if(tab === 'explore' && !current) renderExplore();
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=${lang()}&lat=${userLoc.lat}&lon=${userLoc.lng}`);
        const j = r.ok ? await r.json() : null;
        const a = j && j.address;
        placeName = a ? (a.city || a.town || a.village || a.municipality || a.county || '') : '';
        renderSide(); if(tab === 'explore' && !current) renderExplore();
      } catch(e){}
    }, () => { if(!quiet) toast(t('No pudimos obtener tu ubicación. Revisá los permisos.')); }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });
  }

  function cycleRadius(){
    const opts = [5, 10, 25, 50, 0];
    radius = opts[(opts.indexOf(radius) + 1) % opts.length];
    renderSide(); if(!current) renderExplore();
    toast(radius ? `${t('Distancia')}: ${radius} km` : t('Todas las distancias'));
  }

  /* ================= Render general ================= */
  function render(){
    if(!shell()) return;
    renderSide();
    if(current) return;
    if(tab === 'explore') renderExplore();
    else if(tab === 'saved') renderSaved();
    else if(tab === 'you') renderYou();
    else renderMine();
  }

  async function onEnter(){
    if(!shell()) return;
    renderSide();
    await loadSaved();
    if(tab === 'explore') await loadExplore(); else render();
    if(!userLoc){
      try { if(navigator.permissions){ const st = await navigator.permissions.query({ name: 'geolocation' }); if(st.state === 'granted') locate(true); } } catch(e){}
    }
  }

  /* ================= Publicar (formulario en la hoja "product") ================= */
  function compress(file){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => resolve(b), 'image/jpeg', 0.82);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }
  function renderPhotoPreviews(){
    const box = $('mlPhotoPreview');
    if(!box) return;
    box.innerHTML = photoFiles.map((f, i) =>
      `<span class="ml-thumb" style="background-image:url('${URL.createObjectURL(f)}')"><b data-ml-rmphoto="${i}">×</b></span>`).join('');
  }
  async function submitFromForm(){
    const g = id => ($(id) || {}).value || '';
    const title = g('mlTitle').trim();
    const price = parseFloat(g('mlPrice'));
    const whatsapp = g('mlWhatsapp').trim();
    const city = g('mlCity').trim();
    if(!title || !Number.isFinite(price) || price < 0 || !whatsapp || !city){ toast(t('Completá título, precio, ciudad y WhatsApp.')); return; }
    if(!photoFiles.length){ toast(t('Subí al menos una foto del producto.')); return; }
    const btn = document.querySelector('[data-submit="product"]');
    if(btn){ btn.disabled = true; btn.textContent = t('Subiendo fotos...'); }
    const photos = [];
    for(const f of photoFiles){
      const blob = await compress(f);
      if(!blob) continue;
      const up = await B().uploadListingImage(blob, 'jpg');
      if(up.ok) photos.push(up.url);
    }
    if(!photos.length){
      if(btn){ btn.disabled = false; btn.textContent = t('Enviar a aprobación'); }
      toast(t('No se pudieron subir las fotos. Probá de nuevo.'));
      return;
    }
    if(btn) btn.textContent = t('Enviando...');
    const lat = parseFloat(g('mlLat')), lng = parseFloat(g('mlLng'));
    const res = await B().createListing({
      title, price,
      currency: g('mlCurrency') || 'UYU',
      category: g('mlCategory') || 'otros',
      condition: g('mlCondition') || 'bueno',
      description: g('mlDesc').trim(),
      whatsapp, city,
      lat: Number.isFinite(lat) ? Math.round(lat * 100) / 100 : null,
      lng: Number.isFinite(lng) ? Math.round(lng * 100) / 100 : null,
      photos
    });
    if(btn){ btn.disabled = false; btn.textContent = t('Enviar a aprobación'); }
    if(!res.ok){ toast(res.error === 'auth' ? t('Iniciá sesión para publicar.') : t('No se pudo publicar. Probá de nuevo.')); return; }
    photoFiles = [];
    renderPhotoPreviews();
    ['mlTitle', 'mlPrice', 'mlDesc', 'mlCity', 'mlWhatsapp', 'mlLat', 'mlLng'].forEach(id => { const el = $(id); if(el) el.value = ''; });
    const locBtn = $('mlLocBtn');
    if(locBtn){ locBtn.textContent = t('Usar mi ubicación (para "cerca de mí")'); locBtn.style.color = ''; }
    if(typeof window.closeModal === 'function') window.closeModal();
    toast(t('Publicación enviada. Queda pendiente de aprobación.'));
    if(tab === 'mine') renderMine();
  }

  /* ================= Eventos ================= */
  let searchTimer = null;
  document.addEventListener('input', e => {
    if(e.target.id !== 'mkSearch') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = e.target.value.trim();
      current = null;
      const v = view(); if(v) v.classList.remove('mk-detail-open');
      if(tab !== 'explore'){ tab = 'explore'; renderSide(); }
      renderExplore();
    }, 220);
  });

  document.addEventListener('click', async e => {
    const el = e.target;
    let b;
    if((b = el.closest('[data-mk-save]'))){ e.preventDefault(); e.stopPropagation(); toggleSave(b.dataset.mkSave); return; }
    if((b = el.closest('[data-ml-open]'))){ openDetail(b.dataset.mlOpen); return; }
    if(el.closest('[data-mk-back]')){ closeDetail(); return; }
    if((b = el.closest('[data-mk-tab]'))){
      tab = b.dataset.mkTab; current = null;
      const v = view(); if(v) v.classList.remove('mk-detail-open');
      if(tab === 'explore'){ renderSide(); loadExplore(); } else render();
      return;
    }
    if((b = el.closest('[data-mk-cat]'))){
      cat = b.dataset.mkCat; current = null; tab = 'explore';
      const v = view(); if(v) v.classList.remove('mk-detail-open');
      renderSide(); renderExplore();
      return;
    }
    if((b = el.closest('[data-mk-list]'))){ current = null; tab = 'you'; renderSide(); renderList(b.dataset.mkList); return; }
    if(el.closest('[data-mk-newcol]')){
      const name = (window.prompt(t('Nombre de la colección')) || '').trim().slice(0, 40);
      if(!name) return;
      const c = await db();
      const { error } = await c.from('listing_collections').insert({ name });
      toast(t(error ? 'No se pudo crear la colección.' : 'Colección creada.'));
      if(!error) renderYou();
      return;
    }
    if((b = el.closest('[data-mk-delcol]'))){
      if(!window.confirm(t('¿Eliminar la colección? Los productos siguen en Guardados.'))) return;
      const c = await db();
      await c.from('listing_collections').delete().eq('id', b.dataset.mkDelcol);
      await loadSaved(); renderYou();
      return;
    }
    if(el.closest('[data-mk-clearrecent]')){ try { localStorage.removeItem(RECENT_KEY); } catch(e){} renderList('recent'); return; }
    if((b = el.closest('[data-ml-drop]'))){
      const l = byId.get(b.dataset.mlDrop);
      const val = window.prompt(t('Nuevo precio (menor al actual)'), l ? String(l.price) : '');
      if(val == null) return;
      const n = parseFloat(String(val).replace(',', '.'));
      if(!Number.isFinite(n)){ toast(t('Escribí un número.')); return; }
      const c = await db();
      const { error } = await c.rpc('lower_listing_price', { p_listing: b.dataset.mlDrop, p_price: n });
      toast(error ? (error.message || t('No se pudo.')) : t('Precio actualizado. Se muestra como rebajado.'));
      if(!error){ cache = []; renderMine(); }
      return;
    }
    if(el.closest('[data-mk-near]')){ locate(false); return; }
    if(el.closest('[data-mk-radius]')){ cycleRadius(); return; }
    if(el.closest('[data-mk-filters]')){ showFilters = !showFilters; renderExplore(); return; }
    if((b = el.closest('[data-mk-sort]'))){ filters.sort = b.dataset.mkSort; renderExplore(); return; }
    if((b = el.closest('[data-mk-cond]'))){ filters.cond = b.dataset.mkCond; document.querySelectorAll('[data-mk-cond]').forEach(x => x.classList.toggle('active', x === b)); return; }
    if(el.closest('[data-mk-apply]')){ filters.min = ($('mkMin') || {}).value || ''; filters.max = ($('mkMax') || {}).value || ''; showFilters = false; renderExplore(); return; }
    if(el.closest('[data-mk-clear]')){ filters = { min: '', max: '', cond: 'all', sort: filters.sort }; showFilters = false; renderExplore(); return; }
    if(el.closest('[data-mk-share]') && current){
      const text = ({ es: `${current.title} · ${fmtPrice(current)} en el Market de SPOTRA`, pt: `${current.title} · ${fmtPrice(current)} no Market do SPOTRA`, en: `${current.title} · ${fmtPrice(current)} on the SPOTRA Market` })[lang()];
      if(window.spotraShare) window.spotraShare({ title: current.title, text, url: location.origin + '/?listing=' + encodeURIComponent(current.id) + '#market' });
      return;
    }
    if((b = el.closest('[data-ml-rmphoto]'))){ photoFiles.splice(parseInt(b.dataset.mlRmphoto, 10), 1); renderPhotoPreviews(); return; }
    if((b = el.closest('[data-ml-sold]'))){
      if(!window.confirm(t('¿Marcar como vendido? Deja de aparecer en el market.'))) return;
      const res = await B().markListingSold(b.dataset.mlSold);
      toast(t(res.ok ? 'Marcado como vendido.' : 'No se pudo. Probá de nuevo.'));
      if(res.ok){ cache = []; renderMine(); }
      return;
    }
    if((b = el.closest('[data-ml-del]'))){
      if(!window.confirm(t('¿Eliminar la publicación? No se puede deshacer.'))) return;
      const res = await B().deleteListing(b.dataset.mlDel);
      toast(t(res.ok ? 'Publicación eliminada.' : 'No se pudo eliminar.'));
      if(res.ok){ cache = []; renderMine(); }
      return;
    }
    if(el.closest('#mlLocBtn')){
      if(!navigator.geolocation){ toast(t('Tu dispositivo no permite ubicación.')); return; }
      const lb = $('mlLocBtn');
      lb.textContent = t('Obteniendo ubicación...');
      navigator.geolocation.getCurrentPosition(pos => {
        const la = $('mlLat'), ln = $('mlLng');
        if(la) la.value = pos.coords.latitude;
        if(ln) ln.value = pos.coords.longitude;
        lb.textContent = t('Ubicación lista ✓');
        lb.style.color = 'var(--green-hot)';
      }, () => {
        lb.textContent = t('Usar mi ubicación (para "cerca de mí")');
        toast(t('No pudimos obtener tu ubicación. Revisá los permisos.'));
      }, { enableHighAccuracy: true, timeout: 9000 });
    }
  });

  document.addEventListener('change', e => {
    if(e.target && e.target.dataset && e.target.dataset.mkCol){ setCollection(e.target.dataset.mkCol, e.target.value); return; }
    if(e.target && e.target.id === 'mlPhotos'){
      const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
      for(const f of files){
        if(photoFiles.length >= 6){ toast(t('Máximo 6 fotos.')); break; }
        photoFiles.push(f);
      }
      e.target.value = '';
      renderPhotoPreviews();
    }
  });

  function watchView(){
    const v = view();
    if(!v) return;
    let was = v.classList.contains('active');
    if(was) onEnter();
    new MutationObserver(() => {
      const now = v.classList.contains('active');
      if(now && !was) onEnter();
      was = now;
    }).observe(v, { attributes: true, attributeFilter: ['class'] });
    if(deepListing) setTimeout(() => { if(window.setRoute && document.body.classList.contains('is-authed')) window.setRoute('market'); }, 1800);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchView);
  else watchView();
  window.addEventListener('spotra-lang', () => { const v = view(); if(v && v.classList.contains('active')) render(); });
  window.addEventListener('spotra-user', () => { loadSaved(); });

  window.SpotraMarket = { submitFromForm };
})();
