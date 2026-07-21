/* SPOTRA · Market C2C (v1)
   - Usados entre riders: publicar con fotos → moderación admin → publicado → contacto por WhatsApp.
   - "Cerca de mí": distancia al vendedor y filtro por rango (5/20/50 km), estilo FB Marketplace.
   - Mis publicaciones: estados (Pendiente/Publicado/Vendido/Rechazado), marcar vendido, eliminar. */
(function(){
  const CUR = { UYU: '$U', USD: 'US$', ARS: 'AR$', BRL: 'R$' };
  const CAT_LABEL = { tablas: 'Tablas', ruedas: 'Ruedas', bicis: 'Bicis', protecciones: 'Protecciones', ropa: 'Ropa', otros: 'Otros' };
  const COND_LABEL = { 'nuevo': 'Nuevo', 'como-nuevo': 'Usado — como nuevo', 'bueno': 'Usado — bueno', 'con-detalles': 'Usado — con detalles' };
  const STATUS_LABEL = { pending: 'Pendiente', approved: 'Publicado', rejected: 'Rechazado', archived: 'Retirado' };

  let activeTab = 'explore';
  let activeCat = 'all';
  let userLoc = null;
  let distKm = 0; /* 0 = todos */
  let cache = [];
  let current = null;
  let photoFiles = [];

  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function B(){ return window.SpotraBackend || null; }

  function fmtPrice(l){
    const sym = CUR[l.currency] || l.currency;
    const n = Number(l.price);
    return sym + ' ' + (Number.isFinite(n) ? n.toLocaleString('es-UY', { maximumFractionDigits: 0 }) : l.price);
  }

  function distMeters(a, b){
    const R = 6371000, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function fmtDist(m){
    if(!Number.isFinite(m)) return '';
    if(m < 1000) return 'a ' + Math.round(m / 100) * 100 + ' m';
    return 'a ' + (m / 1000 < 10 ? (m / 1000).toFixed(1).replace('.', ',') : Math.round(m / 1000)) + ' km';
  }
  function withDist(l){
    if(!userLoc || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) return null;
    return distMeters(userLoc, { lat: l.lat, lng: l.lng });
  }
  function daysAgo(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if(days <= 0) return 'hoy';
    if(days === 1) return 'hace 1 día';
    if(days < 30) return 'hace ' + days + ' días';
    return 'hace ' + Math.floor(days / 30) + ' mes' + (Math.floor(days / 30) === 1 ? '' : 'es');
  }

  function gridEl(){ return document.getElementById('mktGrid'); }
  function detailEl(){ return document.getElementById('mktDetail'); }

  /* ================= Explorar ================= */
  function cardHTML(l){
    const d = withDist(l);
    const meta = [l.city, d != null ? `<span class="mkt-dist-badge">${fmtDist(d)}</span>` : ''].filter(Boolean).join(' · ');
    const img = l.photos[0] ? `style="background-image:url('${esc(l.photos[0])}')"` : 'style="background:#15251b"';
    return `<article class="product-card" data-ml-open="${esc(l.id)}" style="cursor:pointer">
      <div class="product-img" ${img}></div>
      <div class="product-body">
        <div class="price">${esc(fmtPrice(l))}</div>
        <b>${esc(l.title)}</b>
        <div class="meta">${meta}</div>
        <div class="seller" style="margin-top:6px">${esc(l.username)}</div>
      </div></article>`;
  }

  async function renderExplore(){
    const grid = gridEl();
    if(!grid || !B()) return;
    showGrid();
    grid.innerHTML = '<div class="meta" style="grid-column:1/-1;margin-top:10px">Cargando publicaciones...</div>';
    cache = await B().listListings({ category: activeCat });
    let list = cache.slice();
    if(userLoc){
      list.forEach(l => { l.__d = withDist(l); });
      if(distKm > 0) list = list.filter(l => l.__d != null && l.__d <= distKm * 1000);
      list.sort((a, b) => (a.__d == null ? 1 : b.__d == null ? -1 : a.__d - b.__d));
    }
    if(!list.length){
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>
        <b>${userLoc && distKm ? 'Nada en ese rango' : 'Todavía no hay publicaciones acá'}</b>
        ${userLoc && distKm ? 'Probá ampliando la distancia.' : 'Publicá lo que ya no uses y dale una segunda vida.'}</div>`;
      return;
    }
    grid.innerHTML = list.map(cardHTML).join('');
  }

  /* ================= Mis publicaciones ================= */
  async function renderMine(){
    const grid = gridEl();
    if(!grid || !B()) return;
    showGrid();
    grid.innerHTML = '<div class="meta" style="grid-column:1/-1;margin-top:10px">Cargando tus publicaciones...</div>';
    const mine = await B().listMyListings();
    if(!mine.length){
      grid.innerHTML = '<div class="meta" style="grid-column:1/-1;margin-top:10px">Todavía no publicaste nada. Tocá "Publicar" y vendé lo que ya no uses.</div>';
      return;
    }
    grid.innerHTML = '<div style="grid-column:1/-1">' + mine.map(l => {
      const st = l.sold ? 'Vendido' : STATUS_LABEL[l.status] || l.status;
      const cls = l.sold ? '' : l.status === 'approved' ? 'on' : l.status === 'pending' ? 'warn' : 'off';
      const actions = [];
      if(!l.sold && l.status === 'approved') actions.push(`<span class="ev-chip" data-ml-sold="${esc(l.id)}" style="cursor:pointer">Marcar vendido</span>`);
      actions.push(`<span class="ev-chip" data-ml-del="${esc(l.id)}" style="cursor:pointer">Eliminar</span>`);
      return `<div class="ml-row${l.sold ? ' sold' : ''}">
        <div class="thumb" style="${l.photos[0] ? `background-image:url('${esc(l.photos[0])}')` : ''}"></div>
        <div style="flex:1;min-width:0">
          <b style="font-size:13.5px">${esc(l.title)}</b>
          <div style="color:var(--green-hot);font-size:12px;margin-top:1px">${esc(fmtPrice(l))}</div>
          <div class="ev-chips" style="margin-top:5px"><span class="ev-chip ${cls}">${esc(st)}</span>${actions.join('')}</div>
        </div></div>`;
    }).join('') + '</div>';
  }

  function showGrid(){
    const d = detailEl(); if(d){ d.style.display = 'none'; d.innerHTML = ''; }
    const g = gridEl(); if(g) g.style.display = '';
    const cats = document.getElementById('mktCats'); if(cats) cats.style.display = activeTab === 'explore' ? '' : 'none';
    const dist = document.getElementById('mktDist'); if(dist) dist.style.display = activeTab === 'explore' ? '' : 'none';
    current = null;
  }

  /* ================= Detalle ================= */
  function openDetail(id){
    const l = cache.find(x => x.id === id);
    if(!l){ toast('No se pudo abrir la publicación.'); return; }
    current = l;
    const d = detailEl(); const g = gridEl();
    if(!d || !g) return;
    g.style.display = 'none';
    const cats = document.getElementById('mktCats'); if(cats) cats.style.display = 'none';
    const dist = document.getElementById('mktDist'); if(dist) dist.style.display = 'none';
    const dd = withDist(l);
    const num = String(l.whatsapp || '').replace(/[^\d]/g, '');
    const wa = num ? `https://wa.me/${num}?text=${encodeURIComponent('Hola! Vi tu publicación "' + l.title + '" en SPOTRA. ¿Sigue disponible?')}` : '';
    const thumbs = l.photos.length > 1
      ? `<div style="display:flex;gap:7px;margin-top:8px">${l.photos.map((p, i) => `<div data-ml-photo="${i}" style="width:52px;height:44px;border-radius:11px;background:url('${esc(p)}') center/cover;border:1px solid ${i === 0 ? 'var(--green-hot)' : 'rgba(255,255,255,.14)'};cursor:pointer"></div>`).join('')}</div>`
      : '';
    d.style.display = '';
    d.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin:10px 0 12px;cursor:pointer" data-ml-back>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;color:var(--muted)"><path d="M15 6l-6 6 6 6"/></svg>
        <span class="meta">Volver al market</span></div>
      <div id="mlMainPhoto" class="cover" style="height:230px;border-radius:18px;background:${l.photos[0] ? `url('${esc(l.photos[0])}') center/cover` : '#15251b'};border:1px solid rgba(255,255,255,.1)"></div>
      ${thumbs}
      <div class="ev-chips" style="margin-top:12px">
        <span class="ev-chip on">${esc(CAT_LABEL[l.category] || l.category)}</span>
        <span class="ev-chip">${esc(COND_LABEL[l.condition] || l.condition)}</span>
      </div>
      <div style="font-family:var(--display);font-size:30px;color:var(--green-hot);margin-top:8px">${esc(fmtPrice(l))}</div>
      <h2 style="font-size:19px;margin-top:2px">${esc(l.title)}</h2>
      <div class="meta" style="margin-top:4px">${esc(l.username)}${l.city ? ' · ' + esc(l.city) : ''}${dd != null ? ' · ' + fmtDist(dd) : ''} · ${daysAgo(l.createdAt)}</div>
      ${l.description ? `<p class="spot-desc">${esc(l.description)}</p>` : ''}
      ${wa ? `<a class="primary-btn" href="${esc(wa)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;margin-top:16px;text-decoration:none">Contactar por WhatsApp</a>` : ''}`;
  }

  /* ================= Cerca de mí ================= */
  function locate(){
    if(!navigator.geolocation){ toast('Tu dispositivo no permite ubicación.'); return; }
    const btn = document.getElementById('mktNearBtn');
    if(btn) btn.classList.add('active');
    toast('Buscando tu ubicación...');
    navigator.geolocation.getCurrentPosition(pos => {
      userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const chips = document.getElementById('mktDistChips');
      if(chips) chips.style.display = '';
      renderExplore();
    }, () => {
      if(btn) btn.classList.remove('active');
      toast('No pudimos obtener tu ubicación. Revisá los permisos.');
    }, { enableHighAccuracy: true, timeout: 9000 });
  }

  /* ================= Publicar ================= */
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
    const box = document.getElementById('mlPhotoPreview');
    if(!box) return;
    box.innerHTML = photoFiles.map((f, i) =>
      `<span class="ml-thumb" style="background-image:url('${URL.createObjectURL(f)}')"><b data-ml-rmphoto="${i}">×</b></span>`).join('');
  }

  async function submitFromForm(){
    const g = id => (document.getElementById(id) || {}).value || '';
    const title = g('mlTitle').trim();
    const price = parseFloat(g('mlPrice'));
    const whatsapp = g('mlWhatsapp').trim();
    const city = g('mlCity').trim();
    if(!title || !Number.isFinite(price) || price <= 0 || !whatsapp || !city){
      toast('Completá título, precio, ciudad y WhatsApp.');
      return;
    }
    if(!photoFiles.length){ toast('Subí al menos una foto del producto.'); return; }
    const btn = document.querySelector('[data-submit="product"]');
    if(btn){ btn.disabled = true; btn.textContent = 'Subiendo fotos...'; }
    const photos = [];
    for(const f of photoFiles){
      const blob = await compress(f);
      if(!blob) continue;
      const up = await B().uploadListingImage(blob, 'jpg');
      if(up.ok) photos.push(up.url);
    }
    if(!photos.length){
      if(btn){ btn.disabled = false; btn.textContent = 'Enviar a aprobación'; }
      toast('No se pudieron subir las fotos. Probá de nuevo.');
      return;
    }
    if(btn) btn.textContent = 'Enviando...';
    const lat = parseFloat(g('mlLat')), lng = parseFloat(g('mlLng'));
    const res = await B().createListing({
      title,
      price,
      currency: g('mlCurrency') || 'UYU',
      category: g('mlCategory') || 'otros',
      condition: g('mlCondition') || 'bueno',
      description: g('mlDesc').trim(),
      whatsapp,
      city,
      lat: Number.isFinite(lat) ? Math.round(lat * 100) / 100 : null,
      lng: Number.isFinite(lng) ? Math.round(lng * 100) / 100 : null,
      photos
    });
    if(btn){ btn.disabled = false; btn.textContent = 'Enviar a aprobación'; }
    if(!res.ok){
      toast(res.error === 'auth' ? 'Iniciá sesión para publicar.' : 'No se pudo publicar. Probá de nuevo.');
      return;
    }
    photoFiles = [];
    renderPhotoPreviews();
    ['mlTitle', 'mlPrice', 'mlDesc', 'mlCity', 'mlWhatsapp', 'mlLat', 'mlLng'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const locBtn = document.getElementById('mlLocBtn');
    if(locBtn){ locBtn.textContent = 'Usar mi ubicación (para "cerca de mí")'; locBtn.style.color = ''; }
    if(typeof window.closeModal === 'function') window.closeModal();
    toast('Publicación enviada. Queda pendiente de aprobación.');
    if(activeTab === 'mine') renderMine();
  }

  /* ================= Wiring ================= */
  document.addEventListener('click', async e => {
    const open = e.target.closest('[data-ml-open]');
    if(open){ openDetail(open.dataset.mlOpen); return; }
    if(e.target.closest('[data-ml-back]')){ activeTab === 'explore' ? renderExplore() : renderMine(); return; }
    const tab = e.target.closest('[data-mkt-tab]');
    if(tab){
      activeTab = tab.dataset.mktTab;
      document.querySelectorAll('#mktTabs button').forEach(b => b.classList.toggle('active', b === tab));
      activeTab === 'explore' ? renderExplore() : renderMine();
      return;
    }
    const cat = e.target.closest('[data-mkt-cat]');
    if(cat){
      activeCat = cat.dataset.mktCat;
      document.querySelectorAll('#mktCats button').forEach(b => b.classList.toggle('active', b === cat));
      renderExplore();
      return;
    }
    if(e.target.closest('[data-mkt-near]')){ locate(); return; }
    const dist = e.target.closest('[data-mkt-dist]');
    if(dist){
      distKm = parseInt(dist.dataset.mktDist, 10) || 0;
      document.querySelectorAll('#mktDistChips button').forEach(b => b.classList.toggle('active', b === dist));
      renderExplore();
      return;
    }
    const photoIdx = e.target.closest('[data-ml-photo]');
    if(photoIdx && current){
      const i = parseInt(photoIdx.dataset.mlPhoto, 10);
      const main = document.getElementById('mlMainPhoto');
      if(main && current.photos[i]) main.style.background = `url('${current.photos[i]}') center/cover`;
      document.querySelectorAll('[data-ml-photo]').forEach(el => { el.style.border = '1px solid rgba(255,255,255,.14)'; });
      photoIdx.style.border = '1px solid var(--green-hot)';
      return;
    }
    const rm = e.target.closest('[data-ml-rmphoto]');
    if(rm){ photoFiles.splice(parseInt(rm.dataset.mlRmphoto, 10), 1); renderPhotoPreviews(); return; }
    const sold = e.target.closest('[data-ml-sold]');
    if(sold){
      if(!window.confirm('¿Marcar como vendido? Deja de aparecer en el market.')) return;
      const res = await B().markListingSold(sold.dataset.mlSold);
      toast(res.ok ? 'Marcado como vendido.' : 'No se pudo. Probá de nuevo.');
      if(res.ok) renderMine();
      return;
    }
    const del = e.target.closest('[data-ml-del]');
    if(del){
      if(!window.confirm('¿Eliminar la publicación? No se puede deshacer.')) return;
      const res = await B().deleteListing(del.dataset.mlDel);
      toast(res.ok ? 'Publicación eliminada.' : 'No se pudo eliminar.');
      if(res.ok) renderMine();
      return;
    }
    if(e.target.closest('#mlLocBtn')){
      if(!navigator.geolocation){ toast('Tu dispositivo no permite ubicación.'); return; }
      const b = document.getElementById('mlLocBtn');
      b.textContent = 'Obteniendo ubicación...';
      navigator.geolocation.getCurrentPosition(pos => {
        const la = document.getElementById('mlLat'), ln = document.getElementById('mlLng');
        if(la) la.value = pos.coords.latitude;
        if(ln) ln.value = pos.coords.longitude;
        b.textContent = 'Ubicación lista ✓';
        b.style.color = 'var(--green-hot)';
      }, () => {
        b.textContent = 'Usar mi ubicación (para "cerca de mí")';
        toast('No pudimos obtener tu ubicación. Revisá los permisos.');
      }, { enableHighAccuracy: true, timeout: 9000 });
      return;
    }
  });

  document.addEventListener('change', e => {
    if(e.target && e.target.id === 'mlPhotos'){
      const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
      for(const f of files){
        if(photoFiles.length >= 3){ toast('Máximo 3 fotos.'); break; }
        photoFiles.push(f);
      }
      e.target.value = '';
      renderPhotoPreviews();
    }
  });

  function watchView(){
    const v = document.querySelector('[data-view="market"]');
    if(!v) return;
    const load = () => { activeTab === 'explore' ? renderExplore() : renderMine(); };
    if(v.classList.contains('active')) load();
    new MutationObserver(() => { if(v.classList.contains('active')) load(); }).observe(v, { attributes: true, attributeFilter: ['class'] });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchView);
  else watchView();

  window.SpotraMarket = { submitFromForm };
})();
