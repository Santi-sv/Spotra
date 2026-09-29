/* SPOTRA · Avisos de sesiones: ubicación del rider
   Modos: "live" (mientras usás la app, solo +18), "zone" (zona fija) y "off".
   Se guarda redondeado (~1 km). El servidor valida la edad (avisos.sql)
   y manda los avisos (Edge Function session-push). */
(function(){
  const B = () => window.SpotraBackend;
  const ASKED = 'spotra_alerts_asked';
  let uid = null, adult = false;
  let row = null;                 // fila actual en rider_locations
  let draft = { mode: 'zone', radius: 10, lat: null, lng: null };
  const $ = id => document.getElementById(id);
  const say = m => { if(window.toast) window.toast(m); };
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }
  const lang = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch(e){ return null; } };

  async function load(){
    const c = await db();
    if(!c) return;
    try { uid = await B().getUserId(); } catch(e){ uid = null; }
    if(!uid) return;
    const [{ data: r }, { data: a }] = await Promise.all([
      c.from('rider_locations').select('mode, latitude, longitude, radius_km, lang').eq('profile_id', uid).maybeSingle(),
      c.rpc('is_adult', { uid })
    ]);
    row = r || null;
    adult = !!a;
    if(row && row.mode === 'live') refreshLive(false);
    else if(row && row.lang !== lang()) save({ mode: row.mode, radius: row.radius_km, lat: row.latitude, lng: row.longitude }, true);
    maybeAsk(c);
  }

  // se ofrece una vez, cuando ya cargó la fecha de nacimiento
  async function maybeAsk(c){
    let asked = false;
    try { asked = localStorage.getItem(ASKED) === '1'; } catch(e){}
    if(asked || row) return;
    if(document.body.classList.contains('auth-mode') || document.body.dataset.isAdmin === '1') return;
    const { data } = await c.from('profiles').select('birth_date').eq('id', uid).maybeSingle();
    if(!data || !data.birth_date) return;          // primero la fecha de nacimiento
    const bg = document.getElementById('modalBg');
    if(bg && bg.classList.contains('open')) return; // no pisar otra hoja abierta
    open();
  }

  /* ---------- la hoja ---------- */
  function open(){
    draft = row
      ? { mode: row.mode, radius: row.radius_km || 10, lat: row.latitude, lng: row.longitude }
      : { mode: adult ? 'live' : 'zone', radius: 10, lat: null, lng: null };
    if(draft.mode === 'live' && !adult) draft.mode = 'zone';
    paint();
    pushStatus();
    if(window.openModal) window.openModal('alerts');
    try { localStorage.setItem(ASKED, '1'); } catch(e){}
  }

  function paint(){
    document.querySelectorAll('[data-alert-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.alertMode === draft.mode);
      if(b.dataset.alertMode === 'live') b.classList.toggle('locked', !adult);
    });
    document.querySelectorAll('[data-alert-radius]').forEach(b => b.classList.toggle('active', Number(b.dataset.alertRadius) === draft.radius));
    const zone = $('alertZoneBox'); if(zone) zone.style.display = draft.mode === 'zone' ? '' : 'none';
    const rad = $('alertRadiusBox'); if(rad) rad.style.display = draft.mode === 'off' ? 'none' : '';
    const st = $('alertZoneState');
    if(st) st.textContent = t(draft.lat != null ? 'Zona marcada ✓' : 'Todavía no marcaste tu zona.');
    const err = $('alertError'); if(err) err.textContent = '';
  }

  async function pushStatus(){
    const box = $('alertPushBox');
    if(!box) return;
    let on = false;
    try {
      if('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker){
        const reg = await navigator.serviceWorker.getRegistration();
        on = !!(reg && await reg.pushManager.getSubscription());
      }
    } catch(e){}
    box.style.display = on ? 'none' : '';
  }

  function getPosition(){
    return new Promise((resolve, reject) => {
      if(!navigator.geolocation){ reject(new Error('geo')); return; }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        e => reject(e),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
    });
  }

  async function save(d, quiet){
    const c = await db();
    if(!c || !uid) return false;
    const payload = {
      profile_id: uid,
      mode: d.mode,
      radius_km: d.radius,
      latitude: d.mode === 'off' ? null : d.lat,
      longitude: d.mode === 'off' ? null : d.lng,
      lang: lang(),
      tz: tz()
    };
    const { error } = await c.from('rider_locations').upsert(payload, { onConflict: 'profile_id' });
    if(error){ if(!quiet){ const err = $('alertError'); if(err) err.textContent = error.message; } return false; }
    row = { mode: d.mode, latitude: payload.latitude, longitude: payload.longitude, radius_km: d.radius, lang: payload.lang };
    return true;
  }

  async function confirmAlerts(){
    const err = $('alertError');
    err.textContent = '';
    const btn = $('alertSave');
    btn.disabled = true;
    try {
      if(draft.mode === 'live'){
        if(!adult){ err.textContent = t('La ubicación mientras usás la app es solo para mayores de 18. Podés usar "Solo mi zona".'); return; }
        try { const p = await getPosition(); draft.lat = p.lat; draft.lng = p.lng; }
        catch(e){ err.textContent = t('No pudimos obtener tu ubicación. Revisá los permisos.'); return; }
      }
      if(draft.mode === 'zone' && draft.lat == null){ err.textContent = t('Marcá tu zona primero.'); return; }
      if(await save(draft)){
        if(window.closeModal) window.closeModal();
        say(t(draft.mode === 'off' ? 'Avisos de sesiones apagados.' : 'Listo. Te avisamos de sesiones cerca tuyo.'));
      }
    } finally { btn.disabled = false; }
  }

  // modo "mientras uso la app": actualiza la zona al abrir, sin volver a pedir permiso
  async function refreshLive(){
    if(!row || row.mode !== 'live') return;
    try {
      if(navigator.permissions){
        const st = await navigator.permissions.query({ name: 'geolocation' });
        if(st.state !== 'granted') return;
      }
      const p = await getPosition();
      if(row.latitude != null && Math.abs(p.lat - row.latitude) < 0.01 && Math.abs(p.lng - row.longitude) < 0.01 && row.lang === lang()) return;
      save({ mode: 'live', radius: row.radius_km || 10, lat: p.lat, lng: p.lng }, true);
    } catch(e){}
  }

  document.addEventListener('click', async e => {
    const el = e.target;
    let b;
    if((b = el.closest('[data-alert-mode]'))){
      e.preventDefault();
      if(b.dataset.alertMode === 'live' && !adult){ say(t('La ubicación mientras usás la app es solo para mayores de 18. Podés usar "Solo mi zona".')); return; }
      draft.mode = b.dataset.alertMode; paint(); return;
    }
    if((b = el.closest('[data-alert-radius]'))){ e.preventDefault(); draft.radius = Number(b.dataset.alertRadius); paint(); return; }
    if(el.closest('#alertZoneMe')){
      e.preventDefault();
      try { const p = await getPosition(); draft.lat = p.lat; draft.lng = p.lng; paint(); }
      catch(err){ say(t('No pudimos obtener tu ubicación. Revisá los permisos.')); }
      return;
    }
    if(el.closest('#alertZoneMap')){
      e.preventDefault();
      const c = window.SpotraMaps && window.SpotraMaps.center ? window.SpotraMaps.center() : null;
      if(!c){ say(t('Abrí el mapa y ubicalo en tu zona primero.')); return; }
      draft.lat = c.lat; draft.lng = c.lng; paint(); return;
    }
    if(el.closest('#alertPushBtn')){ e.preventDefault(); if(window.SpotraPush) await window.SpotraPush.enable(); pushStatus(); return; }
    if(el.closest('#alertSave')){ e.preventDefault(); confirmAlerts(); return; }
    if(el.closest('[data-open-alerts]')){ e.preventDefault(); if(window.closeModal) window.closeModal(); setTimeout(open, 50); }
  });

  window.addEventListener('spotra-lang', () => { if(row) save({ mode: row.mode, radius: row.radius_km, lat: row.latitude, lng: row.longitude }, true); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden) refreshLive(); });
  setInterval(() => { if(!document.hidden) refreshLive(); }, 10 * 60000);
  setTimeout(load, 3500);

  window.SpotraLocation = { open, load };
})();
