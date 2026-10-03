/* SPOTRA · Seguir riders
   Botón "Seguir" junto al nombre en el foro y en las sesiones.
   En el Perfil: cantidad de seguidores y seguidos, con sus listas.
   Más adelante: aviso cuando alguien que seguís crea una sesión. Reglas en seguir.sql. */
(function(){
  const B = () => window.SpotraBackend;
  let uid = null;
  let following = new Map();   // id -> nombre
  let followers = new Map();
  const $ = id => document.getElementById(id);
  const say = m => { if(window.toast) window.toast(m); };
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }

  async function load(){
    const c = await db();
    if(!c) return;
    try { uid = await B().getUserId(); } catch(e){ uid = null; }
    if(!uid){ following = new Map(); followers = new Map(); paint(); return; }
    const { data, error } = await c.from('follows').select('follower_id, followed_id, follower_name, followed_name');
    if(error){ console.warn('[SPOTRA] seguir:', error.message); return; }
    following = new Map(); followers = new Map();
    (data || []).forEach(r => {
      if(r.follower_id === uid) following.set(r.followed_id, r.followed_name || 'rider');
      if(r.followed_id === uid) followers.set(r.follower_id, r.follower_name || 'rider');
    });
    paint();
  }

  function isFollowing(id){ return following.has(id); }

  // pinta los botones y los contadores
  function paint(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-follow]').forEach(btn => {
      const id = btn.dataset.follow;
      const on = following.has(id);
      btn.hidden = !uid || id === uid;
      btn.classList.toggle('on', on);
      btn.textContent = t(on ? 'Siguiendo' : 'Seguir');
    });
    const a = $('followersCount'), b = $('followingCount');
    if(a) a.textContent = followers.size;
    if(b) b.textContent = following.size;
  }

  async function toggle(btn){
    const id = btn.dataset.follow;
    if(!uid){ say(t('Iniciá sesión para seguir riders.')); return; }
    const c = await db();
    if(!c || id === uid) return;
    btn.disabled = true;
    let error;
    if(following.has(id)){
      ({ error } = await c.from('follows').delete().eq('follower_id', uid).eq('followed_id', id));
      if(!error){ following.delete(id); say(t('Dejaste de seguir a este rider.')); }
    } else {
      ({ error } = await c.from('follows').insert({ followed_id: id }));
      if(error && error.code === '23505') error = null;
      if(!error){ following.set(id, btn.dataset.followName || 'rider'); say(t('Ahora seguís a este rider.')); }
    }
    btn.disabled = false;
    if(error){ say(error.message || t('No se pudo. Probá de nuevo.')); return; }
    paint();
    if(btn.closest('#followList')) renderList();
  }

  let listKind = 'followers';
  async function renderList(kind){
    listKind = kind || listKind;
    const box = $('followList');
    if(!box) return;
    const title = $('modalTitle');
    if(title) title.textContent = t(listKind === 'followers' ? 'Seguidores' : 'Siguiendo');
    const tabs = `<div class="fl-tabs"><button type="button" data-follow-list="followers" class="${listKind === 'followers' ? 'on' : ''}">${esc(t('Seguidores'))} <b>${followers.size}</b></button><button type="button" data-follow-list="following" class="${listKind === 'following' ? 'on' : ''}">${esc(t('Siguiendo'))} <b>${following.size}</b></button></div>`;
    box.innerHTML = tabs + `<div class="meta" style="padding:10px 2px">${esc(t('Cargando...'))}</div>`;
    const c = await db();
    let rows = [];
    if(c && uid){ const { data } = await c.rpc('follow_list', { p_kind: listKind }); rows = data || []; }
    if(!rows.length){
      box.innerHTML = tabs + `<div class="fl-empty">${esc(t(listKind === 'followers' ? 'Todavía no te sigue nadie.' : 'Todavía no seguís a nadie.'))}</div>`;
      return;
    }
    box.innerHTML = tabs + '<div class="fl-list">' + rows.map(r => {
      const av = r.avatar_url ? `style="background-image:url('${esc(r.avatar_url)}')"` : '';
      const ini = esc(String(r.username || 'R').charAt(0).toUpperCase());
      const sub = listKind === 'following' && r.follows_me ? t('Te sigue') : (listKind === 'followers' && r.i_follow ? t('Se siguen mutuamente') : (r.name || ''));
      const followBtn = `<button type="button" class="fl-btn ${r.i_follow ? 'ghost' : 'main'}" data-follow="${esc(r.id)}" data-follow-name="${esc(r.username || '')}">${esc(t(r.i_follow ? 'Siguiendo' : (r.follows_me ? 'Seguir también' : 'Seguir')))}</button>`;
      return `<div class="fl-row">
        <button type="button" class="fl-who" data-rider="${esc(r.id)}" data-close-modal>
          <span class="fl-av${r.avatar_url ? ' has-img' : ''}" ${av}>${r.avatar_url ? '' : ini}</span>
          <span class="fl-tx"><b>@${esc(r.username || 'rider')}${r.verified ? ' <i class="fl-ver">✓</i>' : ''}</b><small>${esc(sub)}</small></span>
        </button>
        <div class="fl-act">${followBtn}${listKind === 'followers' ? `<button type="button" class="fl-btn ghost" data-follower-remove="${esc(r.id)}" title="${esc(t('Eliminar seguidor'))}">${esc(t('Eliminar'))}</button>` : ''}</div>
      </div>`;
    }).join('') + '</div>';
  }

  async function removeRow(kind, id){
    const c = await db();
    if(!c || !uid) return;
    const q = kind === 'followers'
      ? c.from('follows').delete().eq('follower_id', id).eq('followed_id', uid)
      : c.from('follows').delete().eq('follower_id', uid).eq('followed_id', id);
    const { error } = await q;
    if(error){ say(t('No se pudo. Probá de nuevo.')); return; }
    (kind === 'followers' ? followers : following).delete(id);
    paint();
    renderList(kind);
  }

  document.addEventListener('click', e => {
    const el = e.target;
    let b;
    if((b = el.closest('[data-follow]'))){ e.preventDefault(); e.stopPropagation(); toggle(b); return; }
    if((b = el.closest('[data-follow-list]'))){
      e.preventDefault();
      const kind = b.dataset.followList;
      if(window.openModal) window.openModal('follows');
      renderList(kind);
      return;
    }
    if((b = el.closest('[data-unfollow]'))){ e.preventDefault(); removeRow('following', b.dataset.unfollow); return; }
    if((b = el.closest('[data-follower-remove]'))){ e.preventDefault(); if(window.confirm(t('¿Eliminar a este seguidor? No se le avisa.'))) removeRow('followers', b.dataset.followerRemove); }
  }, true);

  // botones que los módulos agregan después (foro, sesiones)
  const obs = new MutationObserver(muts => {
    for(const m of muts){
      for(const n of m.addedNodes){
        if(n.nodeType === 1 && (n.matches('[data-follow]') || n.querySelector('[data-follow]'))){ paint(); return; }
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  setTimeout(load, 1600);
  window.addEventListener('spotra-user', load);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) load(); });

  window.SpotraFollow = { load, isFollowing, ids: () => [...following.keys()] };
})();
