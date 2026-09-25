/* SPOTRA · Sesiones de riders
   Un rider publica que va a rodar en un spot (día, desde, hasta). Se ve en el mapa hasta que termina.
   Otros riders se suman. Las reglas (spot aprobado, máx. 7 días, máx. 8 h, máx. 3 activas)
   las valida el servidor (sesiones.sql). */
(function(){
  const B = () => window.SpotraBackend;
  const DISC = { todas: 'Todas', skate: 'Skate', bmx: 'BMX', rollers: 'Rollers' };
  let sessions = [];
  let byPlace = new Map();
  let myId = null;
  let currentPlace = null;
  let busy = false;

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function say(msg){ if(window.toast) window.toast(msg); }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }

  /* ---------- datos ---------- */
  async function load(){
    const c = await db();
    if(!c) return;
    try { myId = await B().getUserId(); } catch(e){ myId = null; }
    if(!myId){ sessions = []; reindex(); return; }
    const { data, error } = await c.from('sessions')
      .select('id, place_id, created_by, username, avatar_url, discipline, note, starts_at, ends_at, session_participants(profile_id, username, avatar_url)')
      .gt('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(500);
    if(error){ console.warn('[SPOTRA] sesiones:', error.message); return; }
    sessions = data || [];
    reindex();
  }

  function reindex(){
    byPlace = new Map();
    sessions.forEach(s => {
      if(!byPlace.has(s.place_id)) byPlace.set(s.place_id, []);
      byPlace.get(s.place_id).push(s);
    });
    updatePill();
    window.dispatchEvent(new Event('spotra-sessions'));
    if(currentPlace) renderForPlace(currentPlace);
  }

  function ridersAt(placeId){
    const list = byPlace.get(placeId);
    if(!list) return 0;
    return list.reduce((n, s) => n + 1 + (s.session_participants || []).length, 0);
  }

  /* ---------- textos de fecha ---------- */
  const hm = d => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
  function dayStart(d){ const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function whenLabel(s){
    const a = new Date(s.starts_at), b = new Date(s.ends_at), now = new Date();
    if(a <= now) return 'En curso · hasta ' + hm(b);
    const diff = Math.round((dayStart(a) - dayStart(now)) / 86400000);
    const day = diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana'
      : a.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'numeric' });
    return day.charAt(0).toUpperCase() + day.slice(1) + ' ' + hm(a) + ' – ' + hm(b);
  }

  function updatePill(){
    const pill = document.getElementById('mapSessionsPill');
    if(!pill) return;
    const n = sessions.length;
    if(!n){ pill.hidden = true; return; }
    const endToday = dayStart(new Date()); endToday.setDate(endToday.getDate() + 1);
    const today = sessions.filter(s => new Date(s.starts_at) < endToday).length;
    const txt = today
      ? today + (today === 1 ? ' sesión hoy' : ' sesiones hoy')
      : n + (n === 1 ? ' sesión próxima' : ' sesiones próximas');
    pill.querySelector('span').textContent = txt;
    pill.hidden = false;
  }

  /* ---------- ficha del spot ---------- */
  function avatarHTML(name, url, cls){
    const initial = esc(String(name || '?').charAt(0).toUpperCase());
    return url
      ? `<span class="${cls}" style="background-image:url('${esc(url)}')"></span>`
      : `<span class="${cls}">${initial}</span>`;
  }

  function cardHTML(s){
    const parts = s.session_participants || [];
    const mine = s.created_by === myId;
    const joined = parts.some(p => p.profile_id === myId);
    const faces = parts.slice(0, 5).map(p => avatarHTML(p.username, p.avatar_url, 'ses-face')).join('');
    const going = parts.length
      ? `<div class="ses-riders">${faces}<small>${parts.length === 1 ? '1 se suma' : parts.length + ' se suman'}</small></div>`
      : `<div class="ses-riders"><small>${mine ? 'Todavía no se sumó nadie.' : 'Sé el primero en sumarte.'}</small></div>`;
    let action;
    if(mine) action = `<button type="button" class="ghost-btn ses-btn ses-end" data-ses-end="${esc(s.id)}">Terminar sesión</button>`;
    else if(joined) action = `<button type="button" class="ghost-btn ses-btn" data-ses-leave="${esc(s.id)}">Me bajo</button>`;
    else action = `<button type="button" class="primary-btn ses-btn" data-ses-join="${esc(s.id)}">Me sumo</button>`;
    return `<div class="ses-card">`
      + `<div class="ses-top">${avatarHTML(s.username, s.avatar_url, 'ses-av')}<div class="ses-tx">`
      + `<b><span class="ses-name">${esc(s.username)}</span> va a rodar</b>`
      + `<small>${esc(whenLabel(s))} · ${esc(DISC[s.discipline] || 'Todas')}</small></div></div>`
      + (s.note ? `<p class="ses-note">“${esc(s.note)}”</p>` : '')
      + going + action + '</div>';
  }

  function renderForPlace(place){
    currentPlace = place;
    const box = document.getElementById('spotSessions');
    if(!box) return;
    if(!place || !place.id || place.isGoogleResult){ box.innerHTML = ''; return; }
    const list = byPlace.get(place.id) || [];
    const cards = list.map(cardHTML).join('');
    const create = myId
      ? '<button type="button" class="ghost-btn ses-create" data-ses-new>Crear sesión acá</button>'
      : '';
    box.innerHTML = (list.length || create)
      ? `<div class="section-head ses-head"><h3>Sesiones</h3></div>${cards}${create}`
      : '';
  }

  /* ---------- crear ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const $ = id => document.getElementById(id);

  function openCreate(place){
    if(!myId){ say('Iniciá sesión para crear sesiones.'); return; }
    if(!place || !place.id || place.isGoogleResult){ say('Elegí un spot de SPOTRA en el mapa.'); return; }
    $('sesPlaceId').value = place.id;
    $('sesPlaceName').textContent = place.name;
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600000);
    $('sesFrom').value = hhmm(start);
    $('sesTo').value = hhmm(end);
    const max = new Date(now.getTime() + 7 * 86400000);
    $('sesDate').min = ymd(now);
    $('sesDate').max = ymd(max);
    $('sesDate').value = ymd(now);
    setDay('0');
    $('sesNote').value = '';
    $('sesError').textContent = '';
    document.querySelectorAll('#sesDisc button').forEach((b, i) => b.classList.toggle('active', i === 0));
    if(window.openModal) window.openModal('session');
  }

  function setDay(v){
    document.querySelectorAll('#sesDay button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
    $('sesDateWrap').style.display = v === 'other' ? '' : 'none';
    if(v !== 'other'){
      const d = new Date();
      d.setDate(d.getDate() + Number(v));
      $('sesDate').value = ymd(d);
    }
  }

  async function submit(){
    if(busy) return;
    const err = $('sesError');
    err.textContent = '';
    const placeId = $('sesPlaceId').value;
    const date = $('sesDate').value;
    const from = $('sesFrom').value;
    const to = $('sesTo').value;
    if(!placeId || !date || !from || !to){ err.textContent = 'Completá día y horario.'; return; }
    const start = new Date(date + 'T' + from);
    let end = new Date(date + 'T' + to);
    if(end <= start) end = new Date(end.getTime() + 86400000); // termina pasada la medianoche
    const now = Date.now();
    if(start.getTime() < now - 15 * 60000){ err.textContent = 'La sesión no puede empezar en el pasado.'; return; }
    if(start.getTime() > now + 7 * 86400000){ err.textContent = 'Solo podés crear sesiones hasta 7 días adelante.'; return; }
    if(end - start > 8 * 3600000){ err.textContent = 'La sesión puede durar hasta 8 horas.'; return; }
    const discBtn = document.querySelector('#sesDisc button.active');
    const note = $('sesNote').value.trim().slice(0, 140);
    const btn = $('sesSubmit');
    busy = true; btn.disabled = true; btn.textContent = 'Publicando...';
    try {
      const c = await db();
      const { error } = await c.from('sessions').insert({
        place_id: placeId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        discipline: discBtn ? discBtn.dataset.v : 'todas',
        note: note || null
      });
      if(error){ err.textContent = error.message || 'No se pudo publicar. Probá de nuevo.'; return; }
      if(window.closeModal) window.closeModal();
      say('Sesión publicada. Ya se ve en el mapa.');
      await load();
      if(window.SpotraMaps && window.SpotraMaps.openPlaceById) window.SpotraMaps.openPlaceById(placeId);
    } catch(e){
      err.textContent = 'No se pudo publicar. Revisá tu conexión.';
    } finally {
      busy = false; btn.disabled = false; btn.textContent = 'Publicar sesión';
    }
  }

  /* ---------- sumarse / bajarse / terminar ---------- */
  async function act(kind, id, btn){
    if(busy) return;
    const c = await db();
    if(!c || !myId){ say('Iniciá sesión para usar las sesiones.'); return; }
    if(kind === 'end' && !confirm('¿Terminar la sesión? Deja de verse en el mapa.')) return;
    busy = true;
    if(btn) btn.disabled = true;
    let res;
    if(kind === 'join') res = await c.from('session_participants').insert({ session_id: id });
    else if(kind === 'leave') res = await c.from('session_participants').delete().eq('session_id', id).eq('profile_id', myId);
    else res = await c.from('sessions').delete().eq('id', id);
    busy = false;
    if(btn) btn.disabled = false;
    if(res.error){ say(res.error.message || 'No se pudo completar. Probá de nuevo.'); return; }
    say(kind === 'join' ? 'Te sumaste a la sesión.' : kind === 'leave' ? 'Te bajaste de la sesión.' : 'Sesión terminada.');
    await load();
  }

  document.addEventListener('click', e => {
    const t = e.target;
    let el;
    if((el = t.closest('[data-ses-join]'))){ e.preventDefault(); act('join', el.dataset.sesJoin, el); return; }
    if((el = t.closest('[data-ses-leave]'))){ e.preventDefault(); act('leave', el.dataset.sesLeave, el); return; }
    if((el = t.closest('[data-ses-end]'))){ e.preventDefault(); act('end', el.dataset.sesEnd, el); return; }
    if(t.closest('[data-ses-new]')){ e.preventDefault(); openCreate(currentPlace); return; }
    if(t.closest('[data-ses-menu]')){
      e.preventDefault();
      const cur = window.SpotraMaps && window.SpotraMaps.current ? window.SpotraMaps.current() : null;
      if(cur && cur.id && !cur.isGoogleResult){ openCreate(cur); return; }
      if(window.closeModal) window.closeModal();
      if(window.setRoute) window.setRoute('map');
      say('Tocá un spot en el mapa y después «Crear sesión acá».');
      return;
    }
    if((el = t.closest('#sesDay button'))){ setDay(el.dataset.v); return; }
    if(t.closest('#sesSubmit')){ e.preventDefault(); submit(); }
  });

  setTimeout(load, 1200);
  setInterval(() => { if(!document.hidden) load(); }, 90000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) load(); });

  window.SpotraSessions = { load, ridersAt, renderForPlace, openCreate };
})();
