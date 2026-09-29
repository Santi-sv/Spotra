/* SPOTRA · Perfiles de riders (estilo Instagram) + visor de fotos
   - Tocar @usuario abre su perfil: portada, foto, bio, seguidores y sus publicaciones.
   - En tu Perfil aparecen tus publicaciones.
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

  /* ---------- publicaciones en grilla ---------- */
  async function postsOf(id){
    const c = await db();
    if(!c) return [];
    const { data } = await c.from('posts')
      .select('id, content, image_url, created_at, post_likes(count), post_comments(count)')
      .eq('author_id', id).order('created_at', { ascending: false }).limit(60);
    return data || [];
  }

  let gridCache = new Map();
  function gridHTML(posts, mine){
    if(!posts.length){
      return `<div class="rp-empty">${esc(t(mine ? 'Todavía no publicaste nada. Compartí tu primera sesión en el Foro.' : 'Todavía no publicó nada.'))}</div>`;
    }
    posts.forEach(p => gridCache.set(p.id, p));
    return '<div class="rp-grid">' + posts.map(p => p.image_url
      ? `<button type="button" class="rp-tile" data-rp-post="${esc(p.id)}" style="background-image:url('${esc(p.image_url)}')" aria-label="${esc(t('Ver publicación'))}"></button>`
      : `<button type="button" class="rp-tile rp-text" data-rp-post="${esc(p.id)}"><span>${esc(String(p.content || '').slice(0, 90))}</span></button>`).join('') + '</div>';
  }

  function openPost(id){
    const p = gridCache.get(id);
    if(!p) return;
    const date = new Date(p.created_at).toLocaleDateString(window.SpotraI18n ? window.SpotraI18n.mapsLang() : 'es', { day: 'numeric', month: 'short', year: 'numeric' });
    const cap = `<p>${esc(p.content || '')}</p><small>♥ ${count(p.post_likes)} · 💬 ${count(p.post_comments)} · ${esc(date)}</small>`;
    if(p.image_url) lightbox(p.image_url, cap);
    else lightbox('', cap);
  }

  /* ---------- mi perfil: mis publicaciones ---------- */
  async function renderMine(){
    const box = $('myPosts');
    if(!box) return;
    const id = await me();
    if(!id){ box.innerHTML = ''; return; }
    box.innerHTML = `<div class="rp-head"><h3>${esc(t('Publicaciones'))}</h3></div><div class="rp-empty">${esc(t('Cargando...'))}</div>`;
    const posts = await postsOf(id);
    box.innerHTML = `<div class="rp-head"><h3>${esc(t('Publicaciones'))}</h3><span>${posts.length}</span></div>` + gridHTML(posts, true);
  }

  /* ---------- perfil de otro rider ---------- */
  async function openRider(id){
    if(!id) return;
    const mine = await me();
    if(id === mine){ if(window.setRoute) window.setRoute('profile'); return; }
    if(window.setRoute) window.setRoute('rider');
    const box = $('riderView');
    if(!box) return;
    box.innerHTML = `<div class="rp-empty">${esc(t('Cargando...'))}</div>`;
    const c = await db();
    const { data: r } = c ? await c.rpc('rider_profile', { p_id: id }) : { data: null };
    if(!r){ box.innerHTML = `<div class="rp-empty">${esc(t('Este perfil no está disponible.'))}</div>`; return; }
    const name = r.name || r.username || 'Rider';
    const initial = esc(name.charAt(0).toUpperCase());
    const meta = [r.discipline, r.city, r.country_code].filter(Boolean).map(esc).join(' · ');
    box.innerHTML = `<button type="button" class="rp-back" data-rp-back>‹ ${esc(t('Volver'))}</button>
      <section class="panel profile-card">
        <div class="profile-hero">
          <div class="profile-cover${r.cover_url ? ' has-img' : ''}" ${r.cover_url ? `style="background-image:linear-gradient(180deg,transparent,rgba(0,0,0,.55)),url('${esc(r.cover_url)}')"` : ''}></div>
          <div class="profile-identity">
            <div class="profile-avatar${r.avatar_url ? ' has-img' : ''}" ${r.avatar_url ? `style="background-image:url('${esc(r.avatar_url)}')"` : ''} ${r.avatar_url ? `data-lightbox="${esc(r.avatar_url)}"` : ''}><span class="pa-initial">${initial}</span></div>
            <div>
              <h1><span>${esc(name)}</span></h1>
              <p>@${esc(r.username || '')}</p>
              ${meta ? `<div class="profile-meta"><span>${meta}</span></div>` : ''}
              ${r.bio ? `<p class="profile-bio" style="margin-top:8px;color:var(--muted);font-size:14px">${esc(r.bio)}</p>` : ''}
            </div>
          </div>
          <div class="rp-stats"><div><b>${r.posts}</b><span>${esc(t('Publicaciones'))}</span></div><div><b>${r.followers}</b><span>${esc(t('Seguidores'))}</span></div><div><b>${r.following}</b><span>${esc(t('Siguiendo'))}</span></div></div>
          <div class="rp-actions"><button type="button" class="follow-btn rp-follow" data-follow="${esc(r.id)}" data-follow-name="${esc(r.username || '')}">${esc(t('Seguir'))}</button>
          <button type="button" class="report-link" data-report="user" data-report-id="${esc(r.id)}" data-report-user="${esc(r.id)}" data-report-name="${esc(r.username || '')}">${esc(t('Reportar'))}</button></div>
        </div>
      </section>
      <div id="riderPosts"><div class="rp-empty">${esc(t('Cargando...'))}</div></div>`;
    const posts = await postsOf(id);
    const pb = $('riderPosts');
    if(pb) pb.innerHTML = `<div class="rp-head"><h3>${esc(t('Publicaciones'))}</h3></div>` + gridHTML(posts, false);
  }

  /* ---------- clicks ---------- */
  let lastRoute = 'community';
  document.addEventListener('click', e => {
    const el = e.target;
    let b;
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

  // al entrar a tu Perfil, cargar tus publicaciones
  function hook(){
    if(!window.setRoute || window.setRoute.__rp) return;
    const orig = window.setRoute;
    window.setRoute = function(route, push){
      const r = orig.apply(this, arguments);
      if(route === 'profile') renderMine();
      return r;
    };
    window.setRoute.__rp = true;
  }
  hook();
  document.addEventListener('DOMContentLoaded', hook);
  setTimeout(() => { const v = document.querySelector('[data-view="profile"].active'); if(v) renderMine(); }, 2200);

  window.SpotraRiders = { open: openRider, lightbox, renderMine };
})();
