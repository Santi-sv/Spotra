/* SPOTRA · Riders andando ahora (presencia automática con consentimiento)
   - La primera vez se pregunta con un cartel. El rider puede cambiarlo en Configuración.
   - Mientras SPOTRA está abierta, cada 3 minutos se envía la ubicación al servidor, que decide
     si el rider está en un spot (a menos de 150 m). La ubicación exacta no se guarda.
   - Los pines muestran cuántos riders andan ahora; la ficha muestra a los que seguís. */
(function(){
  const B = () => window.SpotraBackend;
  const PING_MS = 3 * 60000;
  let uid = null;
  let prefs = null;          // { enabled: true|false|null, visible: bool }
  let counts = new Map();    // place_id -> riders ahora
  let current = null;
  let timer = null;
  const $ = id => document.getElementById(id);
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const lang = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  const say = m => { if(window.toast) window.toast(t(m)); };
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }
  const modalOpen = () => { const m = $('modalBg'); return !!(m && m.classList.contains('open')); };

  /* ---------- preferencias ---------- */
  async function load(){
    const c = await db();
    if(!c) return;
    try { uid = await B().getUserId(); } catch(e){ uid = null; }
    if(!uid){ prefs = null; stop(); return; }
    const { data } = await c.from('profiles').select('presence_enabled, presence_visible, birth_date').eq('id', uid).maybeSingle();
    if(!data) return;
    prefs = { enabled: data.presence_enabled, visible: data.presence_visible !== false, birth: !!data.birth_date };
    syncSettings();
    if(prefs.enabled) start(); else stop();
    loadCounts();
    maybeAsk();
  }

  async function save(patch){
    const c = await db();
    if(!c || !uid) return false;
    const { error } = await c.from('profiles').update(patch).eq('id', uid);
    if(error){ say(error.message || 'No se pudo guardar. Probá de nuevo.'); return false; }
    Object.assign(prefs, { enabled: 'presence_enabled' in patch ? patch.presence_enabled : prefs.enabled, visible: 'presence_visible' in patch ? patch.presence_visible : prefs.visible });
    syncSettings();
    return true;
  }

  // cartel de la primera vez (cuando no hay otra hoja abierta y ya cargó la fecha de nacimiento)
  function maybeAsk(){
    if(!prefs || prefs.enabled !== null || !prefs.birth) return;
    if(document.body.classList.contains('auth-mode') || document.body.dataset.role === 'admin') return;
    if(modalOpen()){ setTimeout(maybeAsk, 4000); return; }
    if(window.openModal) window.openModal('presence');
  }

  function syncSettings(){
    const a = $('presenceOn'), b = $('presenceVisible');
    if(a) a.checked = !!(prefs && prefs.enabled);
    if(b) b.checked = !!(prefs && prefs.visible);
  }

  /* ---------- envío de ubicación (solo con la app abierta) ---------- */
  function ping(){
    if(!prefs || !prefs.enabled || document.hidden || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      const c = await db();
      if(!c) return;
      await c.rpc('presence_ping', { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
      loadCounts();
    }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function start(){ if(timer) return; ping(); timer = setInterval(ping, PING_MS); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  /* ---------- cantidades para los pines ---------- */
  async function loadCounts(){
    const c = await db();
    if(!c || !uid) return;
    const { data, error } = await c.rpc('presence_counts');
    if(error) return;
    counts = new Map((data || []).map(r => [r.place_id, r.riders]));
    window.dispatchEvent(new Event('spotra-presence'));
    if(current) renderForPlace(current);
  }
  function countAt(id){ return counts.get(id) || 0; }

  /* ---------- ficha del spot ---------- */
  async function renderForPlace(place){
    current = place;
    const box = $('spotPresence');
    if(!box) return;
    if(!place || !place.id || place.isGoogleResult || !uid){ box.innerHTML = ''; return; }
    const c = await db();
    const { data } = c ? await c.rpc('spot_presence', { p_place: place.id }) : { data: null };
    if(current !== place) return;
    const n = data ? data.count : 0;
    const friends = (data && data.friends) || [];
    if(!n){ box.innerHTML = ''; return; }
    const L = lang();
    const main = ({ es: n === 1 ? '1 rider andando ahora' : `${n} riders andando ahora`,
                    pt: n === 1 ? '1 rider andando agora' : `${n} riders andando agora`,
                    en: n === 1 ? '1 rider here now' : `${n} riders here now` })[L];
    const fr = friends.length ? ({ es: ` · ${friends.length} que seguís`, pt: ` · ${friends.length} que você segue`, en: ` · ${friends.length} you follow` })[L] : '';
    const faces = friends.slice(0, 6).map(f => {
      const ini = esc(String(f.username || 'R').charAt(0).toUpperCase());
      return f.avatar_url
        ? `<button type="button" class="pr-face" style="background-image:url('${esc(f.avatar_url)}')" data-rider="${esc(f.id)}" title="@${esc(f.username)}"></button>`
        : `<button type="button" class="pr-face" data-rider="${esc(f.id)}" title="@${esc(f.username)}">${ini}</button>`;
    }).join('');
    box.innerHTML = `<div class="pr-box"><span class="pr-dot"></span><div class="pr-tx"><b>${esc(main)}</b>${fr ? `<small>${esc(fr.slice(3))}</small>` : ''}</div>${faces ? `<div class="pr-faces">${faces}</div>` : ''}</div>`;
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', async e => {
    const el = e.target;
    if(el.closest('[data-presence-yes]')){
      e.preventDefault();
      if(window.closeModal) window.closeModal();
      if(await save({ presence_enabled: true })){
        say('Listo. Cuando estés en un spot, los riders lo van a ver.');
        start();
      }
      return;
    }
    if(el.closest('[data-presence-no]')){
      e.preventDefault();
      if(window.closeModal) window.closeModal();
      await save({ presence_enabled: false });
      say('Podés activarlo cuando quieras en Configuración.');
      return;
    }
  });
  document.addEventListener('change', async e => {
    if(e.target.id === 'presenceOn'){
      const on = e.target.checked;
      if(await save({ presence_enabled: on })){
        if(on){ start(); say('Ubicación en spots activada.'); }
        else { stop(); const c = await db(); if(c) c.rpc('presence_leave'); say('Ubicación en spots desactivada.'); }
      } else e.target.checked = !on;
    }
    if(e.target.id === 'presenceVisible'){
      const on = e.target.checked;
      if(!(await save({ presence_visible: on }))) e.target.checked = !on;
    }
  });

  document.addEventListener('visibilitychange', () => { if(!document.hidden){ ping(); loadCounts(); } });
  window.addEventListener('spotra-user', load);
  setTimeout(load, 2600);
  setInterval(() => { if(!document.hidden) loadCounts(); }, 60000);

  window.SpotraPresence = { load, countAt, renderForPlace };
})();
