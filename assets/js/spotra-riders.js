/* SPOTRA · Perfiles de riders + visor de fotos (v6)
   - v6 (24/10/2026): aviso "Cuenta protegida" en el perfil de un menor que todavía no te aceptó.
   - v5 (19/10/2026): pestañas vacías con ícono, título, texto y botón (Crear publicación, Ir al mapa, Publicar producto).
   - v4 (13/10/2026): rediseño.
   - Mi perfil y el perfil de otros riders comparten el mismo diseño (.pf).
   - Pestañas: Publicaciones (grilla), Sesiones (activas y próximas) y Market (sus productos).
   - Perfil ajeno: Seguir, menú ··· (compartir / reportar o bloquear) y "Andando ahora · spot"
     (solo si lo seguís, si el rider lo permite y nunca para menores: lo decide el servidor en rider_profile).
   - Link para compartir un perfil: /?rider=ID
   - Tocar una foto la abre en grande (doble toque para acercar). */
(function(){
  const B = () => window.SpotraBackend;
  let myId = null;
  const $ = id => document.getElementById(id);
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }
  async function me(){ if(myId) return myId; try { myId = await B().getUserId(); } catch(e){} return myId; }
  const count = v => (Array.isArray(v) && v[0] ? v[0].count : 0) || 0;
  const lang = () => { try { return (window.SpotraI18n && window.SpotraI18n.lang()) || 'es'; } catch(e){ return 'es'; } };
  const locale = () => ({ es: 'es-UY', pt: 'pt-BR', en: 'en-US' })[lang()] || 'es-UY';
  const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-7.6 7-13a7 7 0 0 0-14 0c0 5.4 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4"/></svg>',
    verified: '<svg class="pf-verified" viewBox="0 0 24 24" role="img" aria-label="Cuenta verificada"><circle cx="12" cy="12" r="11" fill="#74ff3a"/><path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#051006" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.8 2.3 4.5 5 4.8"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V21M6 11h8"/></svg>'
  };

  /* ---------- visor de fotos ---------- */
  function lightbox(url, caption){
    let lb = $('spotraLightbox');
    if(!lb){
      lb = document.createElement('div');
      lb.id = 'spotraLightbox';
      lb.className = 'lb';
      lb.innerHTML = '<button type="button" class="lb-close" aria-label="Cerrar">×</button><div class="lb-scroll"><img alt=""></div><div class="lb-cap"></div>';
      document.body.appendChild(lb);
      const img = lb.querySelector('img');
      let last = 0;
      img.addEventListener('click', e => {
        e.stopPropagation();
        const now = Date.now();
        if(now - last < 350) img.classList.toggle('zoom');   // doble toque: acercar / alejar
        last = now;
      });
      lb.addEventListener('click', e => { if(e.target === lb || e.target.closest('.lb-close') || e.target.classList.contains('lb-scroll')) close(); });
      document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
    }
    const img = lb.querySelector('img');
    img.classList.remove('zoom');
    img.src = url || '';
    img.style.display = url ? '' : 'none';
    const cap = lb.querySelector('.lb-cap');
    cap.innerHTML = caption || '';
    cap.style.display = caption ? '' : 'none';
    lb.classList.add('open');
    document.body.classList.add('lb-open');
  }
  function close(){
    const lb = $('spotraLightbox');
    if(lb) lb.classList.remove('open');
    document.body.classList.remove('lb-open');
  }

  /* ---------- datos ---------- */
  async function postsOf(id){
    const c = await db();
    if(!c) return [];
    const { data } = await c.from('posts')
      .select('id, author_id, username, avatar_url, content, image_url, created_at, post_likes(count), post_comments(count)')
      .eq('author_id', id).order('created_at', { ascending: false }).limit(60);
    return data || [];
  }

  // sesiones activas y próximas: las que creó y a las que se sumó (las terminadas ya no se pueden leer)
  async function sessionsOf(id){
    const c = await db();
    if(!c) return [];
    const now = new Date().toISOString();
    const cols = 'id, place_id, created_by, discipline, starts_at, ends_at, places(name), session_participants(profile_id)';
    const [own, joined] = await Promise.all([
      c.from('sessions').select(cols).eq('created_by', id).gt('ends_at', now),
      c.from('session_participants').select('session_id').eq('profile_id', id)
    ]);
    const list = (own.data || []).slice();
    const ids = (joined.data || []).map(r => r.session_id).filter(sid => !list.some(s => s.id === sid));
    if(ids.length){
      const { data } = await c.from('sessions').select(cols).in('id', ids.slice(0, 50)).gt('ends_at', now);
      (data || []).forEach(s => list.push(s));
    }
    return list.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  // productos: los tuyos todos (con su estado); los de otros, solo aprobados y sin vender (lo decide la base)
  async function listingsOf(id){
    const c = await db();
    if(!c) return [];
    const { data } = await c.from('listings')
      .select('id, title, price, currency, photos, status, sold, created_at')
      .eq('seller_id', id).order('created_at', { ascending: false }).limit(60);
    return data || [];
  }

  /* 19/10/2026: pantalla vacía común (ícono + título + texto + botón) */
  const EMPTY_IC = {
    posts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    sessions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5M16 2v4M8 2v4M3 10h5"/><circle cx="16" cy="16" r="6"/><path d="M16 14v2l1 1"/></svg>',
    market: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/></svg>'
  };
  function emptyHTML(kind, title, text, btn){
    return `<div class="empty-state pf-es"><span class="es-ic">${EMPTY_IC[kind]}</span><b>${esc(t(title))}</b>${text ? `<p>${esc(t(text))}</p>` : ''}${btn ? `<div class="es-actions"><button type="button" class="primary-btn" ${btn.attrs}>${esc(t(btn.label))}</button></div>` : ''}</div>`;
  }

  /* ---------- pestañas ---------- */
  function tabsHTML(){
    const tab = (k, label, on) => `<button type="button" role="tab" aria-selected="${on ? 'true' : 'false'}" data-pf-tab="${k}">${esc(t(label))}</button>`;
    return `<div class="pf-tabs pf-bleed" role="tablist" aria-label="${esc(t('Contenido del perfil'))}">${tab('posts', 'Publicaciones', true)}${tab('sessions', 'Sesiones')}${tab('market', 'Market')}</div><div data-pf-panel></div>`;
  }

  let gridCache = new Map();
  function gridHTML(posts, mine){
    if(!posts.length){
      return mine
        ? emptyHTML('posts', 'Todavía no publicaste nada', 'Compartí tu primera sesión, un truco o un spot con la comunidad.', { label: 'Crear publicación', attrs: 'data-open-modal="post"' })
        : emptyHTML('posts', 'Todavía no publicó nada');
    }
    posts.forEach(p => gridCache.set(p.id, p));
    return '<div class="pf-grid pf-bleed">' + posts.map(p => p.image_url
      ? `<button type="button" class="pf-tile" data-rp-post="${esc(p.id)}" style="background-image:url('${esc(p.image_url)}')" aria-label="${esc(t('Ver publicación'))}"></button>`
      : `<button type="button" class="pf-tile txt" data-rp-post="${esc(p.id)}"><span>${esc(String(p.content || '').slice(0, 90))}</span></button>`).join('') + '</div>';
  }

  const DISC = { todas: 'Todas', skate: 'Skate', bmx: 'BMX', rollers: 'Rollers', roller: 'Roller', scooter: 'Scooter' };
  function sessionsHTML(list, viewer, mine){
    if(!list.length){
      return mine
        ? emptyHTML('sessions', 'No tenés sesiones activas', 'Armá una sesión en un spot del mapa y avisale a los riders de tu zona.', { label: 'Ir al mapa', attrs: 'data-route="map"' })
        : emptyHTML('sessions', 'No tiene sesiones activas ahora');
    }
    const loc = locale();
    const hm = d => d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
    const today = new Date().toDateString();
    return '<div class="pf-list">' + list.map(s => {
      const a = new Date(s.starts_at), b = new Date(s.ends_at), now = Date.now();
      const live = a.getTime() <= now && b.getTime() > now;
      const parts = s.session_participants || [];
      const n = parts.length + 1;
      const joined = parts.some(p => p.profile_id === viewer);
      const place = (s.places && s.places.name) || t('Spot');
      const when = live ? `${t('Hasta las')} ${hm(b)}` : `${hm(a)} – ${hm(b)}`;
      const who = n === 1 ? t('1 rider va') : `${n} ${t('riders van')}`;
      const date = live
        ? `<div class="pf-date"><span>${esc(t('Ahora'))}</span>${ICON.live}</div>`
        : `<div class="pf-date"><span>${esc(a.toDateString() === today ? t('Hoy') : a.toLocaleDateString(loc, { weekday: 'short' }).replace('.', ''))}</span><b>${a.getDate()}</b><span>${esc(a.toLocaleDateString(loc, { month: 'short' }).replace('.', ''))}</span></div>`;
      let act;
      if(s.created_by === viewer) act = `<span class="pf-ses-own">${esc(t('Tu sesión'))}</span>`;
      else if(joined) act = `<button type="button" class="pf-ses-act" data-ses-leave="${esc(s.id)}">${esc(t('Me bajo'))}</button>`;
      else act = `<button type="button" class="pf-ses-act${live ? ' go' : ''}" data-ses-join="${esc(s.id)}">${esc(t('Me sumo'))}</button>`;
      return `<div class="pf-ses${live ? ' live' : ''}">${date}
        <button type="button" class="pf-ses-tx" data-pf-place="${esc(s.place_id)}"><b>${esc(place)}</b><span>${esc(when)} · ${esc(t(DISC[s.discipline] || 'Todas'))}</span><small>${esc(who)}</small></button>
        ${act}</div>`;
    }).join('') + '</div>';
  }

  const SYM = { UYU: '$U', USD: 'US$', ARS: '$', BRL: 'R$' };
  function money(n, cur){
    const v = Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: 0 });
    return (SYM[cur] || cur || '$') + ' ' + v;
  }
  function marketHTML(list, mine){
    if(!list.length){
      return mine
        ? emptyHTML('market', 'No tenés productos publicados', 'Vendé lo que ya no uses: tablas, trucks, ruedas, zapatillas.', { label: 'Publicar producto', attrs: 'data-open-modal="product"' })
        : emptyHTML('market', 'No tiene productos a la venta');
    }
    return '<div class="pf-mk">' + list.map(l => {
      const photo = (l.photos || [])[0];
      let badge = '';
      if(l.sold) badge = `<span class="pf-badge">${esc(t('Vendido'))}</span>`;
      else if(l.status === 'pending') badge = `<span class="pf-badge warn">${esc(t('En revisión'))}</span>`;
      else if(l.status === 'rejected') badge = `<span class="pf-badge bad">${esc(t('Rechazado'))}</span>`;
      return `<button type="button" class="pf-item" data-pf-listing="${esc(l.id)}">
        <span class="pf-item-img"${photo ? ` style="background-image:url('${esc(photo)}')"` : ''}>${badge}</span>
        <b>${esc(money(l.price, l.currency))}</b><span>${esc(l.title)}</span></button>`;
    }).join('') + '</div>';
  }

  async function renderTab(root, tab){
    if(!root) return;
    const panel = root.querySelector('[data-pf-panel]');
    if(!panel) return;
    tab = tab || root.dataset.tab || 'posts';
    const changed = root.dataset.tab !== tab;
    root.dataset.tab = tab;
    root.querySelectorAll('[data-pf-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.pfTab === tab ? 'true' : 'false'));
    const uid = root.dataset.uid, mine = root.dataset.mine === '1';
    if(!uid){ panel.innerHTML = ''; return; }
    const req = String(Date.now() + Math.random());
    root.dataset.req = req;
    if(changed || !panel.innerHTML.trim()) panel.innerHTML = `<div class="pf-empty">${esc(t('Cargando...'))}</div>`;
    let html = '';
    try {
      if(tab === 'sessions') html = sessionsHTML(await sessionsOf(uid), await me(), mine);
      else if(tab === 'market') html = marketHTML(await listingsOf(uid), mine);
      else html = gridHTML(await postsOf(uid), mine);
    } catch(e){
      html = `<div class="pf-empty">${esc(t('No se pudo cargar. Probá de nuevo.'))}</div>`;
    }
    if(root.dataset.req === req) panel.innerHTML = html;
  }

  function openPost(id){
    const p = gridCache.get(id);
    if(!p) return;
    if(window.SpotraForum && window.SpotraForum.openViewer){
      window.SpotraForum.openViewer({ id: p.id, authorId: p.author_id, username: p.username || 'rider', avatarUrl: p.avatar_url || '',
        content: p.content || '', imageUrl: p.image_url || '', createdAt: p.created_at, likes: count(p.post_likes), comments: count(p.post_comments) });
      return;
    }
    const date = new Date(p.created_at).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
    const cap = `<p>${esc(p.content || '')}</p><small>${count(p.post_likes)} · ${count(p.post_comments)} · ${esc(date)}</small>`;
    lightbox(p.image_url || '', cap);
  }

  /* ---------- mi perfil ---------- */
  async function renderMine(){
    const box = $('myPosts');
    if(!box) return;
    const id = await me();
    if(!id){ box.innerHTML = ''; box.removeAttribute('data-uid'); return; }
    const first = box.dataset.uid !== id || !box.querySelector('[data-pf-panel]');
    box.setAttribute('data-pf-root', '');
    box.dataset.uid = id;
    box.dataset.mine = '1';
    if(first){ box.innerHTML = tabsHTML(); box.dataset.tab = 'posts'; }
    renderTab(box, box.dataset.tab || 'posts');
  }

  /* ---------- perfil de otro rider ---------- */
  function socialUrl(platform, raw){
    raw = String(raw || '').trim();
    if(!raw) return '';
    if(/^https?:\/\//i.test(raw)) return raw;
    const h = raw.replace(/^@/, '');
    if(platform === 'instagram') return 'https://instagram.com/' + encodeURIComponent(h);
    if(platform === 'tiktok') return 'https://tiktok.com/@' + encodeURIComponent(h);
    if(platform === 'facebook') return 'https://facebook.com/' + encodeURIComponent(h);
    return '';
  }

  function shellHTML(inner){
    return `<section class="pf"><div class="pf-top other"><button type="button" class="pf-icon" data-rp-back aria-label="${esc(t('Volver'))}">${ICON.back}</button><span class="pf-handle"></span><span class="pf-icon" aria-hidden="true"></span></div><div class="pf-empty">${esc(t(inner))}</div></section>`;
  }

  let lastRoute = 'community';
  async function openRider(id){
    if(!id) return;
    const mine = await me();
    if(id === mine){ if(window.setRoute) window.setRoute('profile'); return; }
    if(window.setRoute) window.setRoute('rider');
    const box = $('riderView');
    if(!box) return;
    box.innerHTML = shellHTML('Cargando...');
    const c = await db();
    const { data: r } = c ? await c.rpc('rider_profile', { p_id: id }) : { data: null };
    if(!r){ box.innerHTML = shellHTML('Este perfil no está disponible.'); return; }
    const name = r.name || r.username || 'Rider';
    const user = r.username || '';
    const initial = esc(name.charAt(0).toUpperCase());
    const loc = [r.city, ({ UY: 'Uruguay', AR: 'Argentina', BR: 'Brasil' })[r.country_code] || r.country_code].filter(Boolean).join(', ');
    const now = r.now && r.now.place_id ? `<button type="button" class="pf-now" data-pf-place="${esc(r.now.place_id)}"><i></i><span>${esc(t('Andando ahora'))} · ${esc(r.now.name || t('Spot'))}</span></button>` : '';
    const socials = ['instagram', 'tiktok', 'facebook'].map(k => {
      const url = socialUrl(k, r[k]);
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(k.charAt(0).toUpperCase() + k.slice(1))}">${ICON[k]}</a>` : '';
    }).join('');
    const rep = `data-report="user" data-report-id="${esc(r.id)}" data-report-user="${esc(r.id)}" data-report-name="${esc(user)}"`;
    box.innerHTML = `<section class="pf">
      <div class="pf-top other">
        <button type="button" class="pf-icon" data-rp-back aria-label="${esc(t('Volver'))}">${ICON.back}</button>
        <span class="pf-handle">@${esc(user || 'rider')}</span>
        <div class="pf-menu-wrap">
          <button type="button" class="pf-icon" data-pf-more aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('Más opciones'))}">${ICON.more}</button>
          <div class="pf-menu" role="menu">
            <button type="button" role="menuitem" data-pf-share="${esc(r.id)}" data-pf-share-name="${esc(user)}">${ICON.share}<span>${esc(t('Compartir perfil'))}</span></button>
            <button type="button" role="menuitem" class="danger" ${rep}>${ICON.flag}<span>${esc(t('Reportar o bloquear'))}</span></button>
          </div>
        </div>
      </div>
      <div class="pf-cover"${r.cover_url ? ` style="background-image:url('${esc(r.cover_url)}')"` : ''}>${now}</div>
      <div class="pf-body">
        <div class="pf-row">
          <div class="pf-avatar${r.avatar_url ? ' has-img' : ''}"${r.avatar_url ? ` style="background-image:url('${esc(r.avatar_url)}')" data-lightbox="${esc(r.avatar_url)}"` : ''}><span class="pf-initial">${initial}</span></div>
          <div class="pf-counts"><div><b>${(Number(r.followers) || 0).toLocaleString(locale())}</b><span>${esc(t('Seguidores'))}</span></div><div><b>${(Number(r.following) || 0).toLocaleString(locale())}</b><span>${esc(t('Siguiendo'))}</span></div></div>
        </div>
        <h1 class="pf-name"><span>${esc(name)}</span>${r.verified ? ICON.verified : ''}</h1>
        <div class="pf-meta">${r.discipline ? `<span class="pf-chip">${esc(t(DISC[r.discipline] || r.discipline))}</span>` : ''}${loc ? `<span class="pf-loc">${ICON.pin}<span>${esc(loc)}</span></span>` : ''}</div>
        ${r.bio ? `<p class="pf-bio">${esc(r.bio)}</p>` : ''}
        ${r.protected && r.follow_state !== 'following' ? `<p class="pf-bio" style="color:var(--muted);font-size:13px">${esc(({ es: 'Cuenta protegida. Si acepta tu solicitud, vas a ver más de su perfil y sus sesiones.', pt: 'Conta protegida. Se aceitar sua solicitação, você verá mais do perfil e as sessões.', en: 'Protected account. If they accept your request, you’ll see more of their profile and sessions.' })[window.SpotraI18n && window.SpotraI18n.lang ? window.SpotraI18n.lang() : 'es'] || '')}</p>` : ''}
        <div class="pf-actions other"><button type="button" class="pf-follow" data-follow="${esc(r.id)}" data-follow-name="${esc(user)}">${esc(t('Seguir'))}</button></div>
        ${socials ? `<div class="pf-social">${socials}</div>` : ''}
      </div>
      <div data-pf-root data-uid="${esc(r.id)}" data-mine="0" data-tab="posts">${tabsHTML()}</div>
    </section>`;
    renderTab(box.querySelector('[data-pf-root]'), 'posts');
  }

  /* ---------- compartir perfil ---------- */
  async function shareProfile(id, name){
    if(id === 'me'){
      id = await me();
      const h = document.querySelector('[data-profile-handle]');
      name = h ? h.textContent.replace(/^@/, '') : '';
    }
    if(!id) return;
    const url = location.origin + '/?rider=' + encodeURIComponent(id);
    const text = name ? `${t('Mirá el perfil de')} @${name} ${t('en SPOTRA')}` : t('Mirá este perfil en SPOTRA');
    if(typeof window.spotraShare === 'function') window.spotraShare({ title: 'SPOTRA', text, url });
    else if(navigator.share) navigator.share({ title: 'SPOTRA', text, url }).catch(() => {});
  }

  function closeMenus(except){
    document.querySelectorAll('.pf-menu.open').forEach(m => {
      if(m === except) return;
      m.classList.remove('open');
      const b = m.parentElement && m.parentElement.querySelector('[data-pf-more]');
      if(b) b.setAttribute('aria-expanded', 'false');
    });
  }

  function goToPlace(placeId){
    if(!placeId) return;
    if(window.setRoute) window.setRoute('map');
    setTimeout(() => { if(window.SpotraMaps && window.SpotraMaps.openPlaceById) window.SpotraMaps.openPlaceById(placeId); }, 350);
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', e => {
    const el = e.target;
    let b;
    if((b = el.closest('[data-pf-more]'))){
      e.preventDefault();
      const m = b.parentElement.querySelector('.pf-menu');
      const open = !m.classList.contains('open');
      closeMenus(m);
      m.classList.toggle('open', open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if(!el.closest('.pf-menu') || el.closest('.pf-menu button')) setTimeout(() => closeMenus(), 0);
    if((b = el.closest('[data-pf-share]'))){ e.preventDefault(); shareProfile(b.dataset.pfShare, b.dataset.pfShareName || ''); return; }
    if((b = el.closest('[data-pf-tab]'))){ e.preventDefault(); renderTab(b.closest('[data-pf-root]'), b.dataset.pfTab); return; }
    if((b = el.closest('[data-pf-listing]'))){
      e.preventDefault();
      if(window.SpotraMarket && window.SpotraMarket.openById) window.SpotraMarket.openById(b.dataset.pfListing);
      return;
    }
    if((b = el.closest('[data-pf-place]'))){ e.preventDefault(); goToPlace(b.dataset.pfPlace); return; }
    if((b = el.closest('[data-lightbox]'))){ e.preventDefault(); lightbox(b.dataset.lightbox, b.dataset.caption || ''); return; }
    if((b = el.closest('[data-rp-post]'))){ e.preventDefault(); openPost(b.dataset.rpPost); return; }
    if((b = el.closest('[data-rider]'))){
      e.preventDefault();
      const cur = document.querySelector('[data-view].active');
      if(cur && cur.dataset.view !== 'rider') lastRoute = cur.dataset.view;
      openRider(b.dataset.rider);
      return;
    }
    if(el.closest('[data-rp-back]')){ e.preventDefault(); if(window.setRoute) window.setRoute(lastRoute || 'community'); }
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeMenus(); });

  // al sumarse / bajarse de una sesión, refrescar la pestaña Sesiones que esté abierta
  window.addEventListener('spotra-sessions', () => {
    document.querySelectorAll('[data-pf-root][data-tab="sessions"]').forEach(root => {
      if(root.offsetParent !== null) renderTab(root, 'sessions');
    });
  });
  window.addEventListener('spotra-lang', () => {
    document.querySelectorAll('[data-pf-root]').forEach(root => { if(root.offsetParent !== null) renderTab(root); });
  });
  window.addEventListener('spotra-user', () => { myId = null; });

  // al entrar a tu Perfil, cargar tus pestañas
  function hook(){
    if(!window.setRoute || window.setRoute.__rp) return;
    const orig = window.setRoute;
    window.setRoute = function(route, push){
      const r = orig.apply(this, arguments);
      if(route === 'profile') renderMine();
      return r;
    };
    Object.keys(orig).forEach(k => { if(!(k in window.setRoute)) window.setRoute[k] = orig[k]; });
    window.setRoute.__rp = true;
  }
  hook();
  document.addEventListener('DOMContentLoaded', hook);
  setTimeout(() => { const v = document.querySelector('[data-view="profile"].active'); if(v) renderMine(); }, 2200);

  /* ---------- link compartido: /?rider=ID ---------- */
  let deepRider = null;
  try { deepRider = new URLSearchParams(location.search).get('rider'); } catch(e){}
  if(!isUuid(deepRider)) deepRider = null;
  function tryDeep(){
    if(!deepRider || !document.body.classList.contains('is-authed')) return;
    const id = deepRider;
    deepRider = null;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){}
    openRider(id);
  }
  window.addEventListener('spotra-user', () => setTimeout(tryDeep, 1200));
  setTimeout(tryDeep, 2600);

  window.SpotraRiders = { open: openRider, lightbox, renderMine };
})();
