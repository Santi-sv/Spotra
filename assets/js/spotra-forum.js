/* SPOTRA · Foro (v1)
   - Posts reales con foto opcional, publicados al instante.
   - Likes y comentarios reales. El autor (o el admin) puede eliminar posts y comentarios.
   - La preview de Inicio muestra los últimos posts reales. */
(function(){
  let uid = null;
  let isAdmin = false;
  let cache = [];

  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function B(){ return window.SpotraBackend || null; }

  function timeAgo(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if(s < 60) return 'ahora';
    if(s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    if(s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
    if(s < 2592000) return 'hace ' + Math.floor(s / 86400) + ' d';
    return 'hace ' + Math.floor(s / 2592000) + ' mes' + (Math.floor(s / 2592000) === 1 ? '' : 'es');
  }

  async function refreshIdentity(){
    if(!B()) return;
    uid = await B().getUserId();
    isAdmin = false;
    if(uid && B().getClient){
      const c = await B().getClient();
      const { data } = await c.auth.getSession();
      isAdmin = !!(data?.session?.user?.app_metadata?.role === 'admin');
    }
  }

  /* ================= Feed ================= */
  /* ================= Foro v6: diseño street + actividad + spot etiquetado ================= */
  const FI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const F_ICON = {
    heart: FI('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
    cmt: FI('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>'),
    send: FI('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/>'),
    pin: FI('<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.4"/>'),
    tack: FI('<path d="M9 4h6l-1 6 3 3H7l3-3-1-6ZM12 13v8"/>'),
    flag: FI('<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>'),
    plus: FI('<path d="M12 5v14M5 12h14"/>'),
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };
  const TT = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const LG = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  let feedTab = 'foryou';
  let verified = new Set();
  let followingIds = null;
  let activity = [];
  let feedLoc = null;
  let postSpot = null;           // spot elegido al publicar { id, name }

  function feedShell(){
    const v = document.querySelector('[data-view="community"]');
    if(!v) return null;
    if(!document.getElementById('fxTabs')){
      v.innerHTML = `<div class="fx-head"><h1>${esc(TT('Foro'))}<span>.</span></h1><button type="button" class="fx-new" data-open-modal="post" aria-label="${esc(TT('Crear publicación'))}">${F_ICON.plus}</button></div>
        <div class="fx-tiles" id="fxTiles"></div>
        <div class="fx-tabs" id="fxTabs"></div>
        <div id="feed"><div class="meta" style="margin-top:12px">${esc(TT('Cargando el foro...'))}</div></div>`;
    }
    return v;
  }

  function tabsHTML(){
    return [['foryou', 'Para vos'], ['following', 'Siguiendo'], ['near', 'Cerca']]
      .map(([k, l]) => `<button type="button" data-fx-tab="${k}" class="${feedTab === k ? 'on' : ''}">${esc(TT(l))}</button>`).join('');
  }

  function tilesHTML(){
    const now = Date.now();
    const live = activity.filter(a => a.kind === 'live');
    const liveIds = new Set(live.map(a => a.place_id));
    const ses = activity.filter(a => a.kind === 'session' && !liveIds.has(a.place_id) && a.starts_at && new Date(a.starts_at) - now < 36 * 3600000);
    const seen = new Set();
    const tiles = [...live, ...ses].filter(a => { if(seen.has(a.place_id)) return false; seen.add(a.place_id); return true; }).slice(0, 12);
    if(!tiles.length) return '';
    return tiles.map(a => {
      const name = String(a.place_name || '').replace(/^(Skatepark|Pista de skate|Skate park)\s+/i, '');
      return `<button type="button" class="fx-tile" data-fx-place="${esc(a.place_id)}">
        <span class="fx-tp${a.kind === 'live' ? ' live' : ''}">${F_ICON.pin}${a.kind === 'live' ? `<b class="fx-cnt">${a.n}</b>` : ''}</span>
        <span class="fx-tn">${esc(name.slice(0, 14))}</span></button>`;
    }).join('');
  }

  function verifiedBadge(id){ return verified.has(id) ? `<span class="fx-ver" title="${esc(TT('Cuenta verificada'))}">${F_ICON.check}</span>` : ''; }

  function postHTML(p){
    const initial = esc(String(p.username || 'R').charAt(0).toUpperCase());
    const av = p.avatarUrl ? `style="background-image:url('${esc(p.avatarUrl)}')"` : '';
    const canDelete = uid && (p.authorId === uid || isAdmin);
    const head = `<div class="fx-au"><button type="button" class="fx-av${p.avatarUrl ? ' has-img' : ''}" ${av} data-rider="${esc(p.authorId)}" aria-label="@${esc(p.username)}">${p.avatarUrl ? '' : initial}</button>
        <div class="fx-who"><b class="rider-link" data-rider="${esc(p.authorId)}">${esc(p.username)}</b>${verifiedBadge(p.authorId)} <button type="button" class="follow-btn" data-follow="${esc(p.authorId)}" data-follow-name="${esc(p.username)}" hidden>${esc(TT('Seguir'))}</button>
        <small>${p.pinned ? esc(TT('Fijado')) + ' · ' : ''}${timeAgo(p.createdAt)}</small></div>
        ${p.pinned ? `<span class="fx-pinned">${F_ICON.tack}</span>` : ''}
        ${isAdmin ? `<button type="button" class="fx-mini" data-fx-pin="${esc(p.id)}" data-pinned="${p.pinned ? '1' : ''}" title="${esc(TT(p.pinned ? 'Desfijar' : 'Fijar'))}">${F_ICON.tack}</button>` : ''}
        ${canDelete ? `<button type="button" class="fx-mini" data-post-del="${esc(p.id)}" title="${esc(TT('Eliminar'))}">×</button>` : ''}
        <button type="button" class="fx-mini" data-report="post" data-report-id="${esc(p.id)}" data-report-user="${esc(p.authorId)}" data-report-name="${esc(p.username)}" title="${esc(TT('Reportar'))}">${F_ICON.flag}</button></div>`;
    const spot = p.placeId ? `<button type="button" class="fx-stk" data-fx-place="${esc(p.placeId)}">${F_ICON.pin}<span>${esc(p.placeName)}</span></button>` : '';
    const actions = `<div class="fx-acts"><button type="button" data-post-like="${esc(p.id)}" class="${p.likedByMe ? 'liked' : ''}">${F_ICON.heart}<span>${p.likes}</span></button>
        <button type="button" data-post-cmt="${esc(p.id)}">${F_ICON.cmt}<span>${p.comments}</span></button>
        <button type="button" data-fx-share="${esc(p.id)}">${F_ICON.send}</button></div>`;
    const caption = p.content ? `<p class="fx-cap"><b>${esc(p.username)}</b> ${esc(p.content)}</p>` : '';
    const more = p.comments ? `<button type="button" class="fx-more" data-pv-open="${esc(p.id)}">${esc(LG() === 'en' ? `View ${p.comments} comments` : LG() === 'pt' ? `Ver os ${p.comments} comentários` : `Ver los ${p.comments} comentarios`)}</button>` : '';
    if(p.imageUrl){
      return `<article class="feed-card fx-post fx-media${p.pinned ? ' is-pinned' : ''}" data-post-id="${esc(p.id)}" data-author="${esc(p.authorId)}">
        <div class="fx-img" data-fx-img="${esc(p.id)}"><img src="${esc(p.imageUrl)}" alt="" loading="lazy"><span class="fx-grain"></span>
          <div class="fx-ov">${head}</div>${spot ? `<div class="fx-stks">${spot}</div>` : ''}
          <div class="fx-bar">${actions}</div><span class="fx-burst">${F_ICON.heart}</span></div>
        ${caption}${more}
        <div class="cmt-box" data-cmt-box="${esc(p.id)}" style="display:none"></div>
      </article>`;
    }
    return `<article class="feed-card fx-post fx-text${p.pinned ? ' is-pinned' : ''}" data-post-id="${esc(p.id)}" data-author="${esc(p.authorId)}">
      <div class="fx-tbox">${head}<p class="fx-big">${esc(p.content)}</p>${spot ? `<div class="fx-stks static">${spot}</div>` : ''}<div class="fx-bar static">${actions}</div></div>
      ${more}
      <div class="cmt-box" data-cmt-box="${esc(p.id)}" style="display:none"></div>
    </article>`;
  }

  function ticketHTML(a){
    const L = LG();
    let txt = '', sub = '', go = 'IR', data = `data-fx-place="${esc(a.place_id)}"`;
    const when = a.starts_at ? new Date(a.starts_at) : null;
    const hh = when ? String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0') : '';
    if(a.kind === 'live'){
      txt = ({ es: `<b>${a.n} ${a.n === 1 ? 'rider' : 'riders'}</b> andando en ${esc(a.place_name)}`, pt: `<b>${a.n} riders</b> andando em ${esc(a.place_name)}`, en: `<b>${a.n} riders</b> riding at ${esc(a.place_name)}` })[L];
      sub = ({ es: 'ahora', pt: 'agora', en: 'now' })[L];
    } else if(a.kind === 'session'){
      txt = ({ es: `<b>@${esc(a.username)}</b> creó una sesión en <b>${esc(a.place_name)}</b>`, pt: `<b>@${esc(a.username)}</b> criou uma sessão em <b>${esc(a.place_name)}</b>`, en: `<b>@${esc(a.username)}</b> created a session at <b>${esc(a.place_name)}</b>` })[L];
      const day = when ? when.toLocaleDateString(window.SpotraI18n ? window.SpotraI18n.mapsLang() : 'es', { weekday: 'short', day: 'numeric' }) : '';
      sub = `${day} ${hh}` + (a.n ? ({ es: ` · ${a.n} se sumaron`, pt: ` · ${a.n} entraram`, en: ` · ${a.n} joined` })[L] : '');
      go = ({ es: 'VER', pt: 'VER', en: 'VIEW' })[L];
    } else if(a.kind === 'spot'){
      txt = ({ es: `Nuevo spot: <b>${esc(a.place_name)}</b>`, pt: `Novo spot: <b>${esc(a.place_name)}</b>`, en: `New spot: <b>${esc(a.place_name)}</b>` })[L];
      sub = a.city || '';
      go = ({ es: 'VER', pt: 'VER', en: 'VIEW' })[L];
    } else if(a.kind === 'event'){
      txt = ({ es: `Evento nuevo: <b>${esc(a.place_name)}</b>`, pt: `Evento novo: <b>${esc(a.place_name)}</b>`, en: `New event: <b>${esc(a.place_name)}</b>` })[L];
      sub = [when ? when.toLocaleDateString(window.SpotraI18n ? window.SpotraI18n.mapsLang() : 'es', { day: 'numeric', month: 'short' }) + ' ' + hh : '', a.city].filter(Boolean).join(' · ');
      data = `data-fx-event="${esc(a.id)}"`;
      go = ({ es: 'VER', pt: 'VER', en: 'VIEW' })[L];
    }
    return `<div class="fx-ticket fx-k-${esc(a.kind)}" ${data}><span class="fx-pulse"></span><div class="fx-tt">${txt}<small>${esc(sub)}</small></div><span class="fx-go">${go}</span></div>`;
  }

  async function loadExtras(){
    try {
      const c = await B().getClient();
      const tasks = [c.rpc('verified_ids')];
      if(uid) tasks.push(c.rpc('community_activity', { p_limit: 30 }));
      const [ver, act] = await Promise.all(tasks);
      verified = new Set((ver && ver.data || []).map(x => typeof x === 'string' ? x : x.verified_ids || x.id));
      activity = (act && act.data) || [];
    } catch(e){}
  }
  async function loadFollowing(){
    if(followingIds || !uid) return;
    try {
      const c = await B().getClient();
      const { data } = await c.from('follows').select('followed_id').eq('follower_id', uid);
      followingIds = new Set((data || []).map(r => r.followed_id));
    } catch(e){ followingIds = new Set(); }
  }
  function kmTo(p){
    if(!feedLoc || !Number.isFinite(p.placeLat)) return null;
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(p.placeLat - feedLoc.lat), dLng = rad(p.placeLng - feedLoc.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(feedLoc.lat)) * Math.cos(rad(p.placeLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function paintFeed(){
    const feed = document.getElementById('feed');
    if(!feed) return;
    const tabs = document.getElementById('fxTabs'); if(tabs) tabs.innerHTML = tabsHTML();
    const tiles = document.getElementById('fxTiles'); if(tiles){ tiles.innerHTML = tilesHTML(); tiles.style.display = tiles.innerHTML ? '' : 'none'; }
    let list = cache.slice();
    const empty = (t, s) => `<div class="empty-state">${F_ICON.cmt}<b>${esc(TT(t))}</b>${esc(TT(s))}</div>`;
    if(feedTab === 'following'){
      list = list.filter(p => followingIds && followingIds.has(p.authorId));
      if(!list.length){ feed.innerHTML = empty('Todavía no hay publicaciones de quienes seguís', 'Seguí riders desde el foro o sus perfiles para ver lo suyo acá.'); return; }
      feed.innerHTML = list.map(postHTML).join('');
      return;
    }
    if(feedTab === 'near'){
      if(!feedLoc){ feed.innerHTML = empty('Activá tu ubicación', 'Mostramos publicaciones etiquetadas en spots cerca tuyo.'); return; }
      list = list.filter(p => { const d = kmTo(p); return d != null && d <= 60; }).sort((a, b) => kmTo(a) - kmTo(b));
      if(!list.length){ feed.innerHTML = empty('No hay publicaciones cerca tuyo', 'Publicá algo y etiquetá el spot donde estás.'); return; }
      feed.innerHTML = list.map(postHTML).join('');
      return;
    }
    // Para vos: fijadas primero, y la actividad de la comunidad intercalada
    list.sort((a, b) => (b.pinned - a.pinned) || ((b.createdAt || 0) - (a.createdAt || 0)));
    const tickets = activity.filter(a => a.kind !== 'live' || a.n >= 2).slice(0, 12);
    if(!list.length && !tickets.length){ feed.innerHTML = empty('Todavía no hay publicaciones', 'Sé el primero: contá dónde patinás hoy.'); return; }
    const out = [];
    let t = 0;
    list.forEach((p, i) => {
      out.push(postHTML(p));
      if((i % 3 === 1) && t < tickets.length) out.push(ticketHTML(tickets[t++]));
    });
    while(t < tickets.length && t < 4) out.push(ticketHTML(tickets[t++]));
    feed.innerHTML = out.join('');
  }

  async function renderFeed(){
    if(!feedShell() || !B()) return;
    await refreshIdentity();
    const [posts] = await Promise.all([B().listPosts({ limit: 60 }), loadExtras()]);
    cache = posts;
    if(feedTab === 'following') await loadFollowing();
    paintFeed();
    setTimeout(openDeepPost, 0);
  }

  function goPlace(pid){
    if(window.setRoute) window.setRoute('map');
    let tries = 0;
    const go = () => { if(document.querySelector('#spotSheet.open')) return; if(window.SpotraMaps && window.SpotraMaps.openPlaceById) window.SpotraMaps.openPlaceById(pid); if(++tries < 8) setTimeout(go, 800); };
    setTimeout(go, 500);
  }

  // doble toque en la foto = me gusta (con corazón animado); un toque = abrir en grande
  let tapTimer = null, lastTapId = null;
  document.addEventListener('click', async e => {
    const t = e.target;
    let b;
    if((b = t.closest('[data-fx-tab]'))){
      feedTab = b.dataset.fxTab;
      if(feedTab === 'following') await loadFollowing();
      if(feedTab === 'near' && !feedLoc && navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos => { feedLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; paintFeed(); }, () => toast(TT('No pudimos obtener tu ubicación. Revisá los permisos.')), { timeout: 9000, maximumAge: 600000 });
      }
      paintFeed();
      return;
    }
    if((b = t.closest('[data-fx-place]')) && !t.closest('.fx-bar')){ e.preventDefault(); goPlace(b.dataset.fxPlace); return; }
    if((b = t.closest('[data-fx-event]'))){
      const id = b.dataset.fxEvent;
      if(window.setRoute) window.setRoute('events');
      setTimeout(() => { if(window.SpotraEvents && window.SpotraEvents.openDetail) window.SpotraEvents.openDetail(id); }, 1400);
      return;
    }
    if((b = t.closest('[data-fx-share]'))){
      const p = cache.find(x => x.id === b.dataset.fxShare);
      if(!p) return;
      const snippet = String(p.content || '').slice(0, 80);
      const text = ({ es: `@${p.username} en SPOTRA`, pt: `@${p.username} no SPOTRA`, en: `@${p.username} on SPOTRA` })[LG()] + (snippet ? `: "${snippet}"` : '');
      if(window.spotraShare) window.spotraShare({ title: 'SPOTRA', text, url: location.origin + '/?post=' + encodeURIComponent(p.id) + '#community' });
      return;
    }
    if((b = t.closest('[data-fx-pin]'))){
      const pin = !b.dataset.pinned;
      const c = await B().getClient();
      const { error } = await c.rpc('admin_pin_post', { p_post: b.dataset.fxPin, p_pinned: pin });
      toast(error ? (error.message || TT('No se pudo.')) : TT(pin ? 'Publicación fijada.' : 'Publicación desfijada.'));
      if(!error) renderFeed();
      return;
    }
    if((b = t.closest('[data-fx-img]')) && !t.closest('.fx-ov,.fx-bar,.fx-stks')){
      const id = b.dataset.fxImg;
      if(tapTimer && lastTapId === id){
        clearTimeout(tapTimer); tapTimer = null;
        const burst = b.querySelector('.fx-burst');
        if(burst){ burst.classList.remove('go'); void burst.offsetWidth; burst.classList.add('go'); }
        const like = b.querySelector('[data-post-like]');
        if(like && !like.classList.contains('liked')) like.click();
        return;
      }
      lastTapId = id;
      tapTimer = setTimeout(() => { tapTimer = null; const p = cache.find(x => x.id === id); if(p) openViewer(p); }, 280);
    }
  });

  // Etiquetar un spot al publicar
  let spotTimer = null;
  document.addEventListener('input', e => {
    if(e.target.id !== 'postSpotSearch') return;
    clearTimeout(spotTimer);
    const q = e.target.value.trim();
    const box = document.getElementById('postSpotResults');
    if(q.length < 2){ if(box) box.innerHTML = ''; return; }
    spotTimer = setTimeout(async () => {
      try {
        const c = await B().getClient();
        const { data } = await c.from('places').select('id, name, city').eq('status', 'approved').ilike('name', '%' + q.replace(/[%_]/g, '') + '%').limit(6);
        if(box) box.innerHTML = (data || []).map(p => `<button type="button" data-post-spot="${esc(p.id)}" data-name="${esc(p.name)}">${F_ICON.pin}<span>${esc(p.name)}<small>${esc(p.city || '')}</small></span></button>`).join('') || `<div class="meta">${esc(TT('No encontramos ese spot.'))}</div>`;
      } catch(err){}
    }, 250);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-post-spot]');
    if(b){
      postSpot = { id: b.dataset.postSpot, name: b.dataset.name };
      paintPostSpot();
      return;
    }
    if(e.target.closest('[data-post-spot-clear]')){ postSpot = null; paintPostSpot(); }
  });
  function paintPostSpot(){
    const sel = document.getElementById('postSpotChosen'), inp = document.getElementById('postSpotSearch'), box = document.getElementById('postSpotResults');
    if(box) box.innerHTML = '';
    if(sel) sel.innerHTML = postSpot ? `<span class="fx-stk static">${F_ICON.pin}<span>${esc(postSpot.name)}</span></span><button type="button" class="fx-mini" data-post-spot-clear>×</button>` : '';
    if(inp){ inp.value = ''; inp.style.display = postSpot ? 'none' : ''; }
  }

  /* ================= Preview en Inicio ================= */
  function renderHomeForum(){
    const box = document.getElementById('homeForum');
    if(!box) return;
    if(!cache.length){
      box.innerHTML = '<div class="meta">Todavía no hay publicaciones en el foro. Creá la primera.</div>';
      return;
    }
    box.innerHTML = cache.slice(0, 2).map(p =>
      `<div class="forum-preview-row" data-route="community" style="cursor:pointer">
        <div class="avatar" ${p.avatarUrl ? `style="background-image:url('${esc(p.avatarUrl)}')"` : ''}></div>
        <div><b style="font-size:13.5px">@${esc(p.username)}</b><p>${esc(p.content.length > 110 ? p.content.slice(0, 110) + '…' : p.content)}</p></div>
      </div>`).join('');
  }

  /* ================= Comentarios ================= */
  async function toggleComments(postId){
    const box = document.querySelector(`[data-cmt-box="${postId}"]`);
    if(!box) return;
    if(box.style.display !== 'none'){ box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = '';
    box.innerHTML = '<div class="meta">Cargando comentarios...</div>';
    const comments = await B().listPostComments(postId);
    renderComments(box, postId, comments);
  }

  function renderComments(box, postId, comments){
    const rows = comments.map(c => {
      const canDel = uid && (c.author_id === uid || isAdmin);
      return `<div class="cmt-row" data-author="${esc(c.author_id)}"><div><b>@${esc(c.username || 'rider')}</b> ${esc(c.content)}</div><span class="cmt-flag" data-report="comment" data-report-id="${esc(c.id)}" data-report-user="${esc(c.author_id)}" data-report-name="${esc(c.username || 'rider')}" title="Reportar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></svg></span>${canDel ? `<span class="del" data-cmt-del="${esc(c.id)}" data-cmt-post="${esc(postId)}">×</span>` : ''}</div>`;
    }).join('');
    box.innerHTML = (rows || '<div class="meta">Sin comentarios todavía.</div>') +
      `<div class="cmt-input"><input placeholder="Escribí un comentario..." data-cmt-input="${esc(postId)}" maxlength="500"><button data-cmt-send="${esc(postId)}">Enviar</button></div>`;
  }

  /* ================= Publicar ================= */
  function compress(file){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
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

  async function submitFromForm(){
    const input = document.querySelector('#postForm input');
    const content = (input && input.value || '').trim();
    if(!content){ toast('Escribí algo para publicar.'); return; }
    const fileInput = document.querySelector('#dzPost input[type="file"]');
    const file = fileInput && fileInput.files && fileInput.files[0];
    const btn = document.querySelector('[data-submit="post"]');
    if(btn){ btn.disabled = true; btn.textContent = file ? 'Subiendo foto...' : 'Publicando...'; }
    let imageUrl = '';
    if(file && file.type.startsWith('image/')){
      const blob = await compress(file);
      if(blob){
        const up = await B().uploadPostImage(blob, 'jpg');
        if(up.ok) imageUrl = up.url;
      }
    }
    const res = await B().createPost({ content, imageUrl, placeId: postSpot ? postSpot.id : null });
    if(btn){ btn.disabled = false; btn.textContent = 'Publicar en foro'; }
    if(!res.ok){
      toast(res.error === 'auth' ? 'Iniciá sesión para publicar.' : 'No se pudo publicar. Probá de nuevo.');
      return;
    }
    if(typeof window.resetForm === 'function') window.resetForm('postForm', 'dzPost');
    postSpot = null; paintPostSpot();
    if(typeof window.closeModal === 'function') window.closeModal();
    if(typeof window.setRoute === 'function') window.setRoute('community');
    toast('Publicado en el foro.');
    renderFeed();
  }

  /* ================= Wiring ================= */
  document.addEventListener('click', async e => {
    const like = e.target.closest('[data-post-like]');
    if(like){
      if(!uid){ toast('Iniciá sesión para dar me gusta.'); return; }
      const id = like.dataset.postLike;
      const p = cache.find(x => x.id === id);
      if(!p) return;
      const was = p.likedByMe;
      p.likedByMe = !was;
      p.likes += was ? -1 : 1;
      like.classList.toggle('liked', p.likedByMe);
      const span = like.querySelector('span');
      if(span) span.textContent = p.likes;
      const res = await B().togglePostLike(id, was);
      if(!res.ok){
        p.likedByMe = was;
        p.likes += was ? 1 : -1;
        like.classList.toggle('liked', p.likedByMe);
        if(span) span.textContent = p.likes;
        toast('No se pudo. Probá de nuevo.');
      }
      return;
    }
    const cmt = e.target.closest('[data-post-cmt]');
    if(cmt){ toggleComments(cmt.dataset.postCmt); return; }
    const send = e.target.closest('[data-cmt-send]');
    if(send){
      if(!uid){ toast('Iniciá sesión para comentar.'); return; }
      const postId = send.dataset.cmtSend;
      const input = document.querySelector(`[data-cmt-input="${postId}"]`);
      const content = (input && input.value || '').trim();
      if(!content){ toast('Escribí el comentario.'); return; }
      send.disabled = true;
      const res = await B().addPostComment(postId, content);
      send.disabled = false;
      if(!res.ok){ toast('No se pudo comentar.'); return; }
      const p = cache.find(x => x.id === postId);
      if(p){
        p.comments += 1;
        const btn = document.querySelector(`[data-post-cmt="${postId}"] span`);
        if(btn) btn.textContent = p.comments;
      }
      const box = document.querySelector(`[data-cmt-box="${postId}"]`);
      const comments = await B().listPostComments(postId);
      renderComments(box, postId, comments);
      return;
    }
    const cdel = e.target.closest('[data-cmt-del]');
    if(cdel){
      if(!window.confirm('¿Eliminar el comentario?')) return;
      const res = await B().deletePostComment(cdel.dataset.cmtDel);
      if(!res.ok){ toast('No se pudo eliminar.'); return; }
      const postId = cdel.dataset.cmtPost;
      const p = cache.find(x => x.id === postId);
      if(p){
        p.comments = Math.max(0, p.comments - 1);
        const btn = document.querySelector(`[data-post-cmt="${postId}"] span`);
        if(btn) btn.textContent = p.comments;
      }
      const box = document.querySelector(`[data-cmt-box="${postId}"]`);
      const comments = await B().listPostComments(postId);
      renderComments(box, postId, comments);
      return;
    }
    const pdel = e.target.closest('[data-post-del]');
    if(pdel){
      if(!window.confirm('¿Eliminar la publicación? No se puede deshacer.')) return;
      const res = await B().deletePost(pdel.dataset.postDel);
      if(!res.ok){ toast('No se pudo eliminar.'); return; }
      toast('Publicación eliminada.');
      renderFeed();
      return;
    }
  });


  /* ================= Visor de publicación (estilo Facebook) =================
     Foto en grande + autor, texto, me gusta, comentarios y compartir. */
  let pv = null;   // publicación abierta
  const T = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-4 4V5Z"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/></svg>';

  function pvEl(){
    let el = document.getElementById('postViewer');
    if(el) return el;
    el = document.createElement('div');
    el.id = 'postViewer';
    el.className = 'pv';
    el.innerHTML = '<button type="button" class="pv-close" data-pv-close aria-label="Cerrar">×</button><div class="pv-media"><img alt=""></div><div class="pv-panel"></div>';
    document.body.appendChild(el);
    const img = el.querySelector('img');
    let last = 0;
    img.addEventListener('click', ev => { ev.stopPropagation(); const n = Date.now(); if(n - last < 350) img.classList.toggle('zoom'); last = n; });
    el.querySelector('.pv-media').addEventListener('click', ev => { if(ev.target === ev.currentTarget) closeViewer(); });
    document.addEventListener('keydown', ev => { if(ev.key === 'Escape') closeViewer(); });
    return el;
  }

  function panelHTML(p){
    const initial = esc(String(p.username || 'R').charAt(0).toUpperCase());
    const av = p.avatarUrl ? `style="background-image:url('${esc(p.avatarUrl)}')"` : '';
    return `<div class="pv-author"><button type="button" class="avatar feed-av${p.avatarUrl ? ' has-img' : ''}" ${av} data-rider="${esc(p.authorId)}" data-pv-close-after>${p.avatarUrl ? '' : initial}</button>
        <div><b class="rider-link" data-rider="${esc(p.authorId)}" data-pv-close-after>@${esc(p.username)}</b><div class="meta">${timeAgo(p.createdAt)}</div></div></div>
      ${p.content ? `<p class="pv-text">${esc(p.content)}</p>` : ''}
      <div class="pv-actions">
        <button type="button" data-pv-like class="${p.likedByMe ? 'liked' : ''}">${HEART}<span>${p.likes}</span></button>
        <button type="button" data-pv-cmt>${BUBBLE}<span>${p.comments}</span></button>
        <button type="button" data-pv-share>${SHARE}<span>${esc(T('Compartir'))}</span></button>
      </div>
      <div class="pv-cmts" style="display:none"></div>`;
  }

  async function openViewer(post){
    if(!post) return;
    await refreshIdentity();
    const fromCache = cache.find(x => x.id === post.id);
    pv = fromCache || Object.assign({ likes: 0, comments: 0, likedByMe: false }, post);
    if(!fromCache && uid){
      try {
        const c = await B().getClient();
        const { data } = await c.from('post_likes').select('post_id').eq('post_id', pv.id).eq('profile_id', uid);
        pv.likedByMe = !!(data && data.length);
      } catch(e){}
    }
    const el = pvEl();
    const img = el.querySelector('img');
    img.classList.remove('zoom');
    img.src = pv.imageUrl || '';
    el.classList.toggle('no-img', !pv.imageUrl);
    el.querySelector('.pv-panel').innerHTML = panelHTML(pv);
    el.classList.add('open');
    document.body.classList.add('lb-open');
  }

  function closeViewer(){
    const el = document.getElementById('postViewer');
    if(el) el.classList.remove('open');
    document.body.classList.remove('lb-open');
    pv = null;
  }

  // mantiene igual la tarjeta del foro cuando se cambia algo en el visor
  function syncCard(p){
    const like = document.querySelector(`.feed-card [data-post-like="${p.id}"]`);
    if(like){ like.classList.toggle('liked', p.likedByMe); const s = like.querySelector('span'); if(s) s.textContent = p.likes; }
    const cm = document.querySelector(`.feed-card [data-post-cmt="${p.id}"] span`);
    if(cm) cm.textContent = p.comments;
  }

  async function pvComments(show){
    const box = document.querySelector('#postViewer .pv-cmts');
    if(!box || !pv) return;
    if(!show && box.style.display !== 'none'){ box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = `<div class="meta">${esc(T('Cargando comentarios...'))}</div>`;
    const comments = await B().listPostComments(pv.id);
    const rows = comments.map(c => `<div class="cmt-row" data-author="${esc(c.author_id)}"><div><b class="rider-link" data-rider="${esc(c.author_id)}" data-pv-close-after>@${esc(c.username || 'rider')}</b> ${esc(c.content)}</div></div>`).join('');
    box.innerHTML = (rows || `<div class="meta">${esc(T('Sin comentarios todavía.'))}</div>`)
      + `<div class="cmt-input"><input placeholder="${esc(T('Escribí un comentario...'))}" data-pv-input maxlength="500"><button type="button" data-pv-send>${esc(T('Enviar'))}</button></div>`;
  }

  document.addEventListener('click', async e => {
    const t = e.target;
    let b;
    if((b = t.closest('[data-pv-open]'))){
      e.preventDefault();
      openViewer(cache.find(x => x.id === b.dataset.pvOpen));
      return;
    }
    if(!pv) return;
    if(t.closest('[data-pv-close]')){ e.preventDefault(); closeViewer(); return; }
    if(t.closest('[data-pv-close-after]')){ closeViewer(); return; }   // abre el perfil (lo maneja otro módulo)
    if((b = t.closest('[data-pv-like]'))){
      e.preventDefault();
      if(!uid){ toast('Iniciá sesión para dar me gusta.'); return; }
      const was = pv.likedByMe;
      pv.likedByMe = !was; pv.likes += was ? -1 : 1;
      b.classList.toggle('liked', pv.likedByMe); b.querySelector('span').textContent = pv.likes; syncCard(pv);
      const res = await B().togglePostLike(pv.id, was);
      if(!res.ok){
        pv.likedByMe = was; pv.likes += was ? 1 : -1;
        b.classList.toggle('liked', pv.likedByMe); b.querySelector('span').textContent = pv.likes; syncCard(pv);
        toast('No se pudo. Probá de nuevo.');
      }
      return;
    }
    if(t.closest('[data-pv-cmt]')){ e.preventDefault(); pvComments(false); return; }
    if(t.closest('[data-pv-send]')){
      e.preventDefault();
      if(!uid){ toast('Iniciá sesión para comentar.'); return; }
      const input = document.querySelector('#postViewer [data-pv-input]');
      const content = (input && input.value || '').trim();
      if(!content){ toast('Escribí el comentario.'); return; }
      const res = await B().addPostComment(pv.id, content);
      if(!res.ok){ toast('No se pudo comentar.'); return; }
      pv.comments += 1;
      const s = document.querySelector('#postViewer [data-pv-cmt] span'); if(s) s.textContent = pv.comments;
      syncCard(pv);
      pvComments(true);
      return;
    }
    if(t.closest('[data-pv-share]')){
      e.preventDefault();
      const L = window.SpotraI18n ? window.SpotraI18n.lang() : 'es';
      const snippet = String(pv.content || '').slice(0, 80);
      const text = ({ es: `@${pv.username} en SPOTRA`, pt: `@${pv.username} no SPOTRA`, en: `@${pv.username} on SPOTRA` })[L] + (snippet ? `: "${snippet}"` : '');
      if(window.spotraShare) window.spotraShare({ title: 'SPOTRA', text, url: location.origin + '/?post=' + encodeURIComponent(pv.id) + '#community' });
    }
  }, true);

  // link compartido: /?post=ID abre el foro y la publicación
  let deepPost = null;
  try { deepPost = new URLSearchParams(location.search).get('post'); } catch(e){}
  function openDeepPost(){
    if(!deepPost) return;
    const p = cache.find(x => x.id === deepPost);
    if(!p) return;
    deepPost = null;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){}
    openViewer(p);
  }
  if(deepPost) setTimeout(() => { if(window.setRoute && document.body.classList.contains('is-authed')) window.setRoute('community'); }, 1800);

  function watchView(){
    const v = document.querySelector('[data-view="community"]');
    if(v){
      if(v.classList.contains('active')) renderFeed();
      new MutationObserver(() => { if(v.classList.contains('active')) renderFeed(); }).observe(v, { attributes: true, attributeFilter: ['class'] });
    }
    renderFeed(); /* carga inicial: alimenta la preview de Inicio */
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchView);
  else watchView();

  window.SpotraForum = { submitFromForm, renderFeed, openViewer };
})();
