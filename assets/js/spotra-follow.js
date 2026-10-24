/* SPOTRA · Seguir riders
   Botón "Seguir" junto al nombre en el foro, en las sesiones y en los perfiles.
   En el Perfil: cantidad de seguidores y seguidos, con sus listas.
   24/10/2026 (v4): seguir a un menor (13–17) manda una SOLICITUD que el menor acepta o rechaza
   (privacidad-menores.sql). El botón muestra "Solicitado"; tocarlo de nuevo cancela la solicitud.
   Las solicitudes recibidas aparecen arriba de la lista de Seguidores y en la campana. */
(function(){
  const B = () => window.SpotraBackend;
  let uid = null;
  let following = new Map();   // id -> nombre
  let followers = new Map();
  let requested = new Set();   // solicitudes que mandé
  let incoming = 0;            // solicitudes que recibí
  const $ = id => document.getElementById(id);
  const say = m => { if(window.toast) window.toast(m); };
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const lang = () => (window.SpotraI18n && window.SpotraI18n.lang ? window.SpotraI18n.lang() : 'es');
  const T3 = (es, pt, en) => ({ es, pt, en })[lang()] || es;
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }

  async function load(){
    const c = await db();
    if(!c) return;
    try { uid = await B().getUserId(); } catch(e){ uid = null; }
    if(!uid){ following = new Map(); followers = new Map(); requested = new Set(); incoming = 0; paint(); return; }
    const { data, error } = await c.from('follows').select('follower_id, followed_id, follower_name, followed_name');
    if(error){ console.warn('[SPOTRA] seguir:', error.message); return; }
    following = new Map(); followers = new Map();
    (data || []).forEach(r => {
      if(r.follower_id === uid) following.set(r.followed_id, r.followed_name || 'rider');
      if(r.followed_id === uid) followers.set(r.follower_id, r.follower_name || 'rider');
    });
    requested = new Set(); incoming = 0;
    const rq = await c.from('follow_requests').select('requester_id, target_id');
    if(!rq.error){
      (rq.data || []).forEach(r => {
        if(r.requester_id === uid) requested.add(r.target_id);
        if(r.target_id === uid) incoming++;
      });
    }
    paint();
  }

  function isFollowing(id){ return following.has(id); }

  // pinta los botones y los contadores
  function paint(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-follow]').forEach(btn => {
      const id = btn.dataset.follow;
      const on = following.has(id);
      const req = !on && requested.has(id);
      btn.hidden = !uid || id === uid;
      btn.classList.toggle('on', on || req);
      btn.classList.toggle('req', req);
      btn.textContent = on ? t('Siguiendo') : req ? T3('Solicitado', 'Solicitado', 'Requested') : t('Seguir');
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
    } else if(requested.has(id)){
      ({ error } = await c.from('follow_requests').delete().eq('requester_id', uid).eq('target_id', id));
      if(!error){ requested.delete(id); say(T3('Cancelaste la solicitud.', 'Você cancelou a solicitação.', 'Request cancelled.')); }
    } else {
      const res = await c.rpc('follow_rider', { p_id: id });
      if(res.error && /follow_rider|function/i.test(res.error.message || '')){
        // por si la base todavía no tiene la función nueva
        ({ error } = await c.from('follows').insert({ followed_id: id }));
        if(error && error.code === '23505') error = null;
        if(!error){ following.set(id, btn.dataset.followName || 'rider'); say(t('Ahora seguís a este rider.')); }
      } else {
        error = res.error;
        if(!error && res.data === 'following'){ following.set(id, btn.dataset.followName || 'rider'); say(t('Ahora seguís a este rider.')); }
        else if(!error && res.data === 'requested'){ requested.add(id); say(T3('Solicitud enviada. Te avisamos cuando la acepte.', 'Solicitação enviada. Avisamos quando aceitar.', 'Request sent. We’ll let you know when it’s accepted.')); }
      }
    }
    btn.disabled = false;
    if(error){ say(error.message || t('No se pudo. Probá de nuevo.')); return; }
    paint();
    if(btn.closest('#followList')) renderList();
  }

  // aceptar / rechazar una solicitud recibida
  async function respond(id, accept){
    const c = await db();
    if(!c || !uid || !id) return false;
    const { data, error } = await c.rpc('respond_follow_request', { p_requester: id, p_accept: !!accept });
    if(error){ say(t('No se pudo. Probá de nuevo.')); return false; }
    if(data === 'accepted') say(T3('Listo, ahora te sigue.', 'Pronto, agora te segue.', 'Done, they follow you now.'));
    else if(data === 'rejected') say(T3('Solicitud rechazada.', 'Solicitação recusada.', 'Request declined.'));
    await load();
    if(window.SpotraNotifs && window.SpotraNotifs.load) window.SpotraNotifs.load();
    if($('followList') && $('followList').innerHTML) renderList();
    return true;
  }

  async function requestsHTML(c){
    if(listKind !== 'followers' || !incoming) return '';
    const { data } = await c.rpc('follow_requests_list');
    const rows = Array.isArray(data) ? data : [];
    if(!rows.length) return '';
    return `<div class="fl-req"><div class="fl-req-h">${esc(T3('Solicitudes para seguirte', 'Solicitações para te seguir', 'Follow requests'))} <b>${rows.length}</b></div>`
      + rows.map(r => {
        const av = r.avatar_url ? `style="background-image:url('${esc(r.avatar_url)}')"` : '';
        const ini = esc(String(r.username || 'R').charAt(0).toUpperCase());
        return `<div class="fl-row">
          <button type="button" class="fl-who" data-rider="${esc(r.id)}" data-close-modal>
            <span class="fl-av${r.avatar_url ? ' has-img' : ''}" ${av}>${r.avatar_url ? '' : ini}</span>
            <span class="fl-tx"><b>@${esc(r.username || 'rider')}${r.verified ? ' <i class="fl-ver">✓</i>' : ''}</b><small>${esc(T3('Quiere seguirte', 'Quer te seguir', 'Wants to follow you'))}</small></span>
          </button>
          <div class="fl-act"><button type="button" class="fl-btn main" data-freq-accept="${esc(r.id)}">${esc(T3('Aceptar', 'Aceitar', 'Accept'))}</button><button type="button" class="fl-btn ghost" data-freq-reject="${esc(r.id)}">${esc(T3('Rechazar', 'Recusar', 'Decline'))}</button></div>
        </div>`;
      }).join('') + '</div>';
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
    let rows = [], reqs = '';
    if(c && uid){
      const { data } = await c.rpc('follow_list', { p_kind: listKind });
      rows = data || [];
      reqs = await requestsHTML(c);
    }
    if(!rows.length){
      box.innerHTML = tabs + reqs + `<div class="fl-empty">${esc(t(listKind === 'followers' ? 'Todavía no te sigue nadie.' : 'Todavía no seguís a nadie.'))}</div>`;
      return;
    }
    box.innerHTML = tabs + reqs + '<div class="fl-list">' + rows.map(r => {
      const av = r.avatar_url ? `style="background-image:url('${esc(r.avatar_url)}')"` : '';
      const ini = esc(String(r.username || 'R').charAt(0).toUpperCase());
      const sub = listKind === 'following' && r.follows_me ? t('Te sigue') : (listKind === 'followers' && r.i_follow ? t('Se siguen mutuamente') : (r.name || ''));
      const req = !r.i_follow && requested.has(r.id);
      const label = r.i_follow ? t('Siguiendo') : req ? T3('Solicitado', 'Solicitado', 'Requested') : t(r.follows_me ? 'Seguir también' : 'Seguir');
      const followBtn = `<button type="button" class="fl-btn ${r.i_follow || req ? 'ghost' : 'main'}" data-follow="${esc(r.id)}" data-follow-name="${esc(r.username || '')}">${esc(label)}</button>`;
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

  // estilos de la sección de solicitudes (chicos, van acá para no tocar index.html)
  (function css(){
    if(document.getElementById('spotraFollowCss')) return;
    const s = document.createElement('style');
    s.id = 'spotraFollowCss';
    s.textContent = '.fl-req{margin:0 0 12px;padding:6px 10px 2px;border:1px solid var(--line);border-radius:14px}'
      + '.fl-req-h{font-size:13px;font-weight:800;color:var(--muted);padding:6px 2px 2px;text-transform:uppercase;letter-spacing:.04em}'
      + '.fl-req-h b{color:var(--text)}.fl-req .fl-row:last-child{border-bottom:0}';
    document.head.appendChild(s);
  })();

  document.addEventListener('click', e => {
    const el = e.target;
    let b;
    if((b = el.closest('[data-freq-accept]'))){ e.preventDefault(); e.stopPropagation(); b.disabled = true; respond(b.dataset.freqAccept, true); return; }
    if((b = el.closest('[data-freq-reject]'))){ e.preventDefault(); e.stopPropagation(); b.disabled = true; respond(b.dataset.freqReject, false); return; }
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

  window.SpotraFollow = { load, isFollowing, respond, ids: () => [...following.keys()] };
})();
