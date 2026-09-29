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
  function postHTML(p){
    const avatar = p.avatarUrl ? `style="background-image:url('${esc(p.avatarUrl)}')"` : '';
    const initial = esc(String(p.username || 'R').charAt(0).toUpperCase());
    const canDelete = uid && (p.authorId === uid || isAdmin);
    return `<article class="feed-card" data-post-id="${esc(p.id)}" data-author="${esc(p.authorId)}">
      <div class="feed-head"><button type="button" class="avatar feed-av${p.avatarUrl ? ' has-img' : ''}" ${avatar} data-rider="${esc(p.authorId)}" aria-label="@${esc(p.username)}">${p.avatarUrl ? '' : initial}</button>
        <div><b class="rider-link" data-rider="${esc(p.authorId)}">@${esc(p.username)}</b> <button type="button" class="follow-btn" data-follow="${esc(p.authorId)}" data-follow-name="${esc(p.username)}" hidden>Seguir</button><div class="meta">${timeAgo(p.createdAt)}</div></div>
        ${canDelete ? `<span class="feed-del" data-post-del="${esc(p.id)}" title="Eliminar">×</span>` : ''}
        <span class="feed-flag" data-report="post" data-report-id="${esc(p.id)}" data-report-user="${esc(p.authorId)}" data-report-name="${esc(p.username)}" title="Reportar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></svg></span>
      </div>
      <p class="lead" style="font-size:15px;white-space:pre-line">${esc(p.content)}</p>
      ${p.imageUrl ? `<img class="feed-img" src="${esc(p.imageUrl)}" alt="" loading="lazy" data-pv-open="${esc(p.id)}">` : ''}
      <div class="feed-actions">
        <button data-post-like="${esc(p.id)}" class="${p.likedByMe ? 'liked' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg><span>${p.likes}</span></button>
        <button data-post-cmt="${esc(p.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-4 4V5Z"/></svg><span>${p.comments}</span></button>
      </div>
      <div class="cmt-box" data-cmt-box="${esc(p.id)}" style="display:none"></div>
    </article>`;
  }

  async function renderFeed(){
    const feed = document.getElementById('feed');
    if(!feed || !B()) return;
    await refreshIdentity();
    cache = await B().listPosts({ limit: 40 });
    setTimeout(openDeepPost, 0);
    if(!cache.length){
      feed.innerHTML = '<div class="meta" style="margin-top:12px">Todavía no hay publicaciones. Sé el primero: contá dónde patinás hoy.</div>';
      renderHomeForum();
      return;
    }
    feed.innerHTML = cache.map(postHTML).join('');
    renderHomeForum();
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
    const res = await B().createPost({ content, imageUrl });
    if(btn){ btn.disabled = false; btn.textContent = 'Publicar en foro'; }
    if(!res.ok){
      toast(res.error === 'auth' ? 'Iniciá sesión para publicar.' : 'No se pudo publicar. Probá de nuevo.');
      return;
    }
    if(typeof window.resetForm === 'function') window.resetForm('postForm', 'dzPost');
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
