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
    const canDelete = uid && (p.authorId === uid || isAdmin);
    return `<article class="feed-card" data-post-id="${esc(p.id)}">
      <div class="feed-head"><div class="avatar" ${avatar}></div>
        <div><b>@${esc(p.username)}</b><div class="meta">${timeAgo(p.createdAt)}</div></div>
        ${canDelete ? `<span class="feed-del" data-post-del="${esc(p.id)}" title="Eliminar">×</span>` : ''}
      </div>
      <p class="lead" style="font-size:15px;white-space:pre-line">${esc(p.content)}</p>
      ${p.imageUrl ? `<div class="feed-media" style="background-image:url('${esc(p.imageUrl)}')"></div>` : ''}
      <div class="feed-actions">
        <button data-post-like="${esc(p.id)}" class="${p.likedByMe ? 'liked' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-9.5-9C.5 8 2.5 4 6 4c2 0 3.2 1.2 4 2.3C10.8 5.2 12 4 14 4c3.5 0 5.5 4 3.5 8C19 16.5 12 21 12 21Z"/></svg><span>${p.likes}</span></button>
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
      return `<div class="cmt-row"><div><b>@${esc(c.username || 'rider')}</b> ${esc(c.content)}</div>${canDel ? `<span class="del" data-cmt-del="${esc(c.id)}" data-cmt-post="${esc(postId)}">×</span>` : ''}</div>`;
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

  window.SpotraForum = { submitFromForm, renderFeed };
})();
