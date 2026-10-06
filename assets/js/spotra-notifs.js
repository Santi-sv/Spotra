/* SPOTRA · Notificaciones de la campana
   Avisos que crea el servidor: alguien te siguió, le dio me gusta o comentó tu publicación, se sumó a tu sesión.
   Punto rojo con la cantidad sin leer; al abrir la campana se marcan como leídas. */
(function(){
  const B = () => window.SpotraBackend;
  let uid = null;
  let items = [];
  const $ = id => document.getElementById(id);
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const lang = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }

  function ago(iso){
    const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000)), L = lang();
    if(m < 60) return ({ es: `hace ${m} min`, pt: `há ${m} min`, en: `${m} min ago` })[L];
    const h = Math.round(m / 60);
    if(h < 24) return ({ es: `hace ${h} h`, pt: `há ${h} h`, en: `${h} h ago` })[L];
    const d = Math.round(h / 24);
    return ({ es: `hace ${d} d`, pt: `há ${d} d`, en: `${d} d ago` })[L];
  }
  function text(n){
    const who = `<b>@${esc(n.actor_name || 'rider')}</b>`, L = lang();
    const snippet = n.ref_text ? ` <span class="nt-q">"${esc(String(n.ref_text).slice(0, 50))}"</span>` : '';
    if(n.kind === 'follow') return ({ es: `${who} empezó a seguirte`, pt: `${who} começou a te seguir`, en: `${who} started following you` })[L];
    if(n.kind === 'like') return ({ es: `${who} le dio me gusta a tu publicación`, pt: `${who} curtiu seu post`, en: `${who} liked your post` })[L] + snippet;
    if(n.kind === 'comment') return ({ es: `${who} comentó:`, pt: `${who} comentou:`, en: `${who} commented:` })[L] + snippet;
    if(n.kind === 'spot_approved') return ({ es: `Tu spot <b>${esc(n.ref_text || '')}</b> fue aprobado y ya está en el mapa`, pt: `Seu spot <b>${esc(n.ref_text || '')}</b> foi aprovado e já está no mapa`, en: `Your spot <b>${esc(n.ref_text || '')}</b> was approved and is on the map` })[L];
    if(n.kind === 'session_join') return ({ es: `${who} se sumó a tu sesión en ${esc(n.ref_text || 'tu spot')}`, pt: `${who} entrou na sua sessão em ${esc(n.ref_text || 'seu spot')}`, en: `${who} joined your session at ${esc(n.ref_text || 'your spot')}` })[L];
    return who;
  }
  const ICON = {
    follow: '<path d="M15 19a6 6 0 0 0-12 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>',
    like: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    spot_approved: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    session_join: '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.4"/>'
  };

  function paintDot(){
    const btn = $('notifBtn');
    if(!btn) return;
    const unread = items.filter(n => !n.read_at).length;
    let dot = btn.querySelector('.nt-dot');
    if(unread){
      if(!dot){ dot = document.createElement('span'); dot.className = 'nt-dot'; btn.appendChild(dot); }
      dot.textContent = unread > 9 ? '9+' : unread;
    } else if(dot) dot.remove();
  }

  function render(){
    const box = $('notifList');
    if(!box) return;
    if(!items.length){ box.innerHTML = `<div class="nt-empty">${esc(t('Sin novedades por ahora.'))}</div>`; return; }
    box.innerHTML = items.map(n => {
      const av = n.actor_avatar ? `style="background-image:url('${esc(n.actor_avatar)}')"` : '';
      if(n.kind === 'spot_approved') n.actor_name = 'SPOTRA';
      return `<button type="button" class="nt-item${n.read_at ? '' : ' unread'}" data-nt="${esc(n.id)}">
        <span class="nt-av${n.actor_avatar ? ' has-img' : ''}" ${av}>${n.actor_avatar ? '' : esc(String(n.actor_name || 'R').charAt(0).toUpperCase())}<i class="nt-k nt-${esc(n.kind)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICON[n.kind] || ''}</svg></i></span>
        <span class="nt-tx">${text(n)}<small>${esc(ago(n.created_at))}</small></span></button>`;
    }).join('');
  }

  async function load(){
    const c = await db();
    if(!c) return;
    try { uid = await B().getUserId(); } catch(e){ uid = null; }
    if(!uid){ items = []; paintDot(); render(); return; }
    const { data, error } = await c.from('notifications').select('id, kind, actor_id, actor_name, actor_avatar, ref_id, ref_text, created_at, read_at').order('created_at', { ascending: false }).limit(40);
    if(error) return;
    items = data || [];
    paintDot(); render();
  }

  async function markRead(){
    if(!items.some(n => !n.read_at)) return;
    const c = await db();
    if(!c || !uid) return;
    const now = new Date().toISOString();
    await c.from('notifications').update({ read_at: now }).eq('profile_id', uid).is('read_at', null);
    items.forEach(n => { if(!n.read_at) n.read_at = now; });
    paintDot();
    setTimeout(render, 1500);
  }

  function closePanel(){
    const p = $('notifPanel'), b = $('notifBtn');
    if(p) p.classList.remove('open');
    if(b) b.setAttribute('aria-expanded', 'false');
  }

  // el botón de la campana frena la propagación, por eso se escucha en captura
  document.addEventListener('click', e => {
    if(e.target.closest('#notifBtn')) setTimeout(() => { const p = $('notifPanel'); if(p && p.classList.contains('open')){ render(); markRead(); } }, 60);
  }, true);
  document.addEventListener('click', e => {
    const it = e.target.closest('[data-nt]');
    if(!it) return;
    const n = items.find(x => x.id === it.dataset.nt);
    if(!n) return;
    closePanel();
    if(n.kind === 'follow' && n.actor_id && window.SpotraRiders){ window.SpotraRiders.open(n.actor_id); return; }
    if((n.kind === 'like' || n.kind === 'comment') && n.ref_id){
      if(window.setRoute) window.setRoute('community');
      setTimeout(() => { if(window.SpotraForum && window.SpotraForum.openPostById) window.SpotraForum.openPostById(n.ref_id); }, 900);
      return;
    }
    if((n.kind === 'session_join' || n.kind === 'spot_approved') && window.setRoute) window.setRoute('map');
  });

  window.addEventListener('spotra-user', load);
  setTimeout(load, 2200);
  setInterval(() => { if(!document.hidden) load(); }, 60000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) load(); });
  window.SpotraNotifs = { load };
})();
