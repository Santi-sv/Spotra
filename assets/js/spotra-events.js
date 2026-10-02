/* SPOTRA · Eventos (v4)
   - v4: resultados por categoría (organizador) + ranking por disciplina.
   - v3: el organizador puede editar y cancelar sus eventos.
   - Sección Eventos: Próximos / Mis eventos, filtro por disciplina, detalle con inscripción.
   - Inscripción con categorías (multi), cupo, cierre, contacto del organizador.
   - Organizador: estado de sus eventos + lista de inscriptos por categoría.
   - Crear evento: elegir spot en el mapa (overlay con buscador) + campos de competencia.
   - Muestra eventos aprobados en Inicio y en la ficha del spot del mapa. */
(function(){
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DISC_LABEL = { todas: '', skate: 'Skate', bmx: 'BMX', rollers: 'Rollers' };
  const STATUS_LABEL = { pending: 'Pendiente de aprobación', approved: 'Aprobado', rejected: 'Rechazado', archived: 'Cancelado' };

  let uid = null;
  let myRegs = {};            /* eventId -> [categorias] */
  let upcomingCache = [];
  let activeTab = 'upcoming';
  let activeDisc = 'all';
  let currentEvent = null;
  let pickedPlace = null;
  let editingId = null;

  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function B(){ return window.SpotraBackend || null; }

  function fmtWhen(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
  }
  function fmtShortDate(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  function isFull(ev){ return !!(ev.capacity && ev.regCount >= ev.capacity); }
  function isClosed(ev){ return !!(ev.closesAt && Date.now() > ev.closesAt.getTime()); }
  function isPast(ev){ return !!(ev.startsAt && Date.now() > ev.startsAt.getTime() + 3 * 3600 * 1000); }
  function regChip(ev){
    if(ev.capacity) return `${ev.regCount}/${ev.capacity} inscriptos`;
    return `${ev.regCount} inscripto${ev.regCount === 1 ? '' : 's'}`;
  }
  function whatsappUrl(phone){
    const num = String(phone || '').replace(/[^\d]/g, '');
    return num ? 'https://wa.me/' + num : '';
  }

  /* ================= Tarjetas ================= */
  function cardHTML(ev, opts){
    const o = opts || {};
    const d = ev.startsAt;
    const chips = [];
    if(DISC_LABEL[ev.discipline]) chips.push(`<span class="ev-chip on">${esc(DISC_LABEL[ev.discipline])}</span>`);
    if(o.myCategories && o.myCategories.length) chips.push(`<span class="ev-chip on">Inscripto</span>`);
    else if(myRegs[ev.id]) chips.push(`<span class="ev-chip on">Inscripto</span>`);
    if(o.showStatus){
      const cls = ev.status === 'approved' ? 'on' : ev.status === 'pending' ? 'warn' : 'off';
      chips.push(`<span class="ev-chip ${cls}">${esc(STATUS_LABEL[ev.status] || ev.status)}</span>`);
    }
    if(!o.showStatus) chips.push(`<span class="ev-chip">${esc(regChip(ev))}</span>`);
    const metaBits = [];
    if(ev.placeName) metaBits.push(ev.placeName + (ev.placeCity ? ' · ' + ev.placeCity : ''));
    if(o.myCategories && o.myCategories.length) metaBits.push('Inscripto en: ' + o.myCategories.join(', '));
    else if(d) metaBits.push(fmtWhen(d));
    return `<div class="ev-card" data-ev-open="${esc(ev.id)}">
      <div class="ev-datebox${ev.status === 'pending' ? ' pend' : ''}"><div><b>${d ? d.getDate() : '--'}</b><span>${d ? MONTHS[d.getMonth()] : ''}</span></div></div>
      <div class="ev-body"><b>${esc(ev.title)}</b><div class="meta">${esc(metaBits.join(' · '))}</div>
        <div class="ev-chips">${chips.join('')}</div></div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--muted);flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>
    </div>`;
  }

  /* ================= v5: estilo Eventos de Facebook ================= */
  const EI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const EV_ICON = {
    heart: EI('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
    share: EI('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/>'),
    cal: EI('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>'),
    map: EI('<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z"/><path d="M9 4v13.5M15 6.5V20"/>'),
    sun: EI('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>'),
    rain: EI('<path d="M7 16a4 4 0 1 1 .6-7.95A5 5 0 0 1 17 9a3.5 3.5 0 0 1 0 7"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/>')
  };
  let activeWhen = 'all';
  let interests = new Set();
  let interestCount = {};
  let evLoc = null;
  let deepEvent = null;
  try { deepEvent = new URLSearchParams(location.search).get('event'); } catch(e){}
  const T = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const LOCALE = () => (window.SpotraI18n ? window.SpotraI18n.mapsLang() : 'es');

  function dateBadge(d, big){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const wd = d.toLocaleDateString(LOCALE(), { weekday: 'short' }).replace('.', '').toUpperCase();
    const mo = d.toLocaleDateString(LOCALE(), { month: 'short' }).replace('.', '').toUpperCase();
    return `<div class="evx-date${big ? ' big' : ''}"><small>${esc(wd)}</small><b>${d.getDate()}</b><span>${esc(mo)}</span></div>`;
  }
  function hhmm(d){ return d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ''; }
  function evDist(ev){
    if(!evLoc || !Number.isFinite(ev.placeLat) || !Number.isFinite(ev.placeLng)) return null;
    const R = 6371, rad = x => x * Math.PI / 180;
    const dLat = rad(ev.placeLat - evLoc.lat), dLng = rad(ev.placeLng - evLoc.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(evLoc.lat)) * Math.cos(rad(ev.placeLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function goingText(ev){
    const n = ev.regCount || 0, i = interestCount[ev.id] || 0, L = window.SpotraI18n ? window.SpotraI18n.lang() : 'es';
    const parts = [];
    if(n) parts.push(({ es: `${n} ${n === 1 ? 'va' : 'van'}`, pt: `${n} ${n === 1 ? 'vai' : 'vão'}`, en: `${n} going` })[L]);
    if(i) parts.push(({ es: `${i} interesados`, pt: `${i} interessados`, en: `${i} interested` })[L]);
    if(ev.capacity) parts.push(`${T('Cupo')} ${n}/${ev.capacity}`);
    return parts.join(' · ');
  }
  function metaLine(ev){
    const d = evDist(ev);
    return [hhmm(ev.startsAt), ev.placeName, ev.placeCity, d != null ? (d < 1 ? '< 1 km' : Math.round(d) + ' km') : ''].filter(Boolean).join(' · ');
  }
  function whenFilter(ev){
    if(activeWhen === 'all' || !ev.startsAt) return true;
    const now = new Date(), s = ev.startsAt;
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const days = (s - startToday) / 86400000;
    if(activeWhen === 'today') return days >= 0 && days < 1;
    if(activeWhen === 'week') return days >= 0 && days < 7;
    if(activeWhen === 'month') return days >= 0 && days < 31;
    if(activeWhen === 'near'){ const d = evDist(ev); return d != null && d <= 50; }
    return true;
  }
  function heartBtn(ev){
    return `<button type="button" class="evx-heart${interests.has(ev.id) ? ' on' : ''}" data-ev-interest="${esc(ev.id)}" aria-label="${esc(T('Me interesa'))}">${EV_ICON.heart}</button>`;
  }
  function featuredHTML(ev){
    const cover = ev.imageUrl || 'assets/banners/banner-skatepark-4.webp';
    const reg = myRegs[ev.id];
    return `<article class="evx-feat" data-ev-open="${esc(ev.id)}">
      <div class="evx-cover" style="background-image:url('${esc(cover)}')">${dateBadge(ev.startsAt, true)}<span class="evx-tag">${esc(T('Destacado'))}</span></div>
      <div class="evx-fbody">
        <h3>${esc(ev.title)}</h3>
        <div class="evx-meta">${esc(metaLine(ev))}</div>
        ${goingText(ev) ? `<div class="evx-going">${esc(goingText(ev))}</div>` : ''}
        <div class="evx-fbtns">
          <button type="button" class="primary-btn" data-ev-open="${esc(ev.id)}">${esc(T(reg ? 'Inscripto' : 'Inscribirme'))}</button>
          <button type="button" class="ghost-btn evx-int${interests.has(ev.id) ? ' on' : ''}" data-ev-interest="${esc(ev.id)}">${EV_ICON.heart}<span>${esc(T('Me interesa'))}</span></button>
        </div>
      </div></article>`;
  }
  function rowHTML(ev, opts){
    const o = opts || {};
    const chips = [];
    if(DISC_LABEL[ev.discipline]) chips.push(`<span class="ev-chip on">${esc(DISC_LABEL[ev.discipline])}</span>`);
    if((o.myCategories && o.myCategories.length) || myRegs[ev.id]) chips.push(`<span class="ev-chip on">${esc(T('Inscripto'))}</span>`);
    if(o.showStatus){
      const cls = ev.status === 'approved' ? 'on' : ev.status === 'pending' ? 'warn' : 'off';
      chips.push(`<span class="ev-chip ${cls}">${esc(T(STATUS_LABEL[ev.status] || ev.status))}</span>`);
    }
    const going = goingText(ev);
    return `<article class="evx-row" data-ev-open="${esc(ev.id)}">
      ${ev.imageUrl ? `<div class="evx-thumb" style="background-image:url('${esc(ev.imageUrl)}')">${dateBadge(ev.startsAt)}</div>` : dateBadge(ev.startsAt)}
      <div class="evx-rbody"><b>${esc(ev.title)}</b><div class="evx-meta">${esc(metaLine(ev))}</div>
        ${going ? `<div class="evx-going">${esc(going)}</div>` : ''}
        ${chips.length ? `<div class="ev-chips">${chips.join('')}</div>` : ''}</div>
      ${o.showStatus ? '' : heartBtn(ev)}
    </article>`;
  }

  async function loadInterests(){
    interests = new Set(); interestCount = {};
    if(!B() || !uid) return;
    try {
      const c = await B().getClient();
      const [mine, counts] = await Promise.all([c.from('event_interests').select('event_id'), c.rpc('event_interest_counts')]);
      (mine.data || []).forEach(r => interests.add(r.event_id));
      (counts.data || []).forEach(r => { interestCount[r.event_id] = r.interested; });
    } catch(e){}
  }

  async function toggleInterest(id){
    if(!uid){ toast(T('Iniciá sesión para guardar eventos.')); return; }
    const c = await B().getClient();
    const on = !interests.has(id);
    on ? interests.add(id) : interests.delete(id);
    interestCount[id] = Math.max(0, (interestCount[id] || 0) + (on ? 1 : -1));
    document.querySelectorAll(`[data-ev-interest="${id}"]`).forEach(b => b.classList.toggle('on', on));
    const res = on ? await c.from('event_interests').insert({ event_id: id }) : await c.from('event_interests').delete().eq('event_id', id).eq('profile_id', uid);
    if(res.error && !(on && res.error.code === '23505')){
      on ? interests.delete(id) : interests.add(id);
      document.querySelectorAll(`[data-ev-interest="${id}"]`).forEach(b => b.classList.toggle('on', !on));
      toast(T('No se pudo. Probá de nuevo.'));
      return;
    }
    toast(T(on ? 'Guardado en Mis eventos.' : 'Quitado de Mis eventos.'));
  }

  function locateEvents(){
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      evLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if(activeTab === 'upcoming' && !currentEvent) renderUpcoming(true);
    }, () => { toast(T('No pudimos obtener tu ubicación. Revisá los permisos.')); }, { timeout: 9000, maximumAge: 600000 });
  }

  // Clima previsto para el día y hora del evento (si es dentro de 7 días)
  async function eventWeather(ev){
    const box = document.getElementById('evWeather');
    if(!box || !ev.startsAt || !Number.isFinite(ev.placeLat)) return;
    const days = (ev.startsAt - Date.now()) / 86400000;
    if(days < -0.2 || days > 7){ box.remove(); return; }
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ev.placeLat.toFixed(3)}&longitude=${ev.placeLng.toFixed(3)}&hourly=temperature_2m,precipitation_probability&forecast_days=8&timezone=auto`);
      const j = await r.json();
      const key = ev.startsAt.toLocaleString('sv-SE', { timeZone: j.timezone }).slice(0, 13).replace(' ', 'T');
      const i = (j.hourly.time || []).findIndex(x => x.slice(0, 13) === key);
      if(i < 0){ box.remove(); return; }
      const temp = Math.round(j.hourly.temperature_2m[i]), p = j.hourly.precipitation_probability[i] || 0;
      const L = window.SpotraI18n ? window.SpotraI18n.lang() : 'es';
      const txt = p >= 40 ? ({ es: `${p}% de probabilidad de lluvia`, pt: `${p}% de chance de chuva`, en: `${p}% chance of rain` })[L] : ({ es: 'Sin lluvia prevista', pt: 'Sem chuva prevista', en: 'No rain expected' })[L];
      box.className = 'ev-info-row' + (p >= 40 ? ' rain' : '');
      box.innerHTML = `${p >= 40 ? EV_ICON.rain : EV_ICON.sun}<span>${esc(T('Pronóstico'))}: ${temp}° · ${esc(txt)}</span>`;
    } catch(e){ box.remove(); }
  }

  function icsFor(ev){
    const pad = n => String(n).padStart(2, '0');
    const f = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
    const end = new Date(ev.startsAt.getTime() + 3 * 3600000);
    const clean = s => String(s || '').replace(/[,;\\]/g, ' ').replace(/\n/g, ' ');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SPOTRA//ES', 'BEGIN:VEVENT', 'UID:' + ev.id + '@spotra', 'DTSTAMP:' + f(new Date()),
      'DTSTART:' + f(ev.startsAt), 'DTEND:' + f(end), 'SUMMARY:' + clean(ev.title), 'LOCATION:' + clean([ev.placeName, ev.placeCity].filter(Boolean).join(' - ')),
      'DESCRIPTION:' + clean(location.origin + '/?event=' + ev.id + '#events'),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + clean(ev.title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  function addToCalendar(ev){
    if(!ev || !ev.startsAt) return;
    const blob = new Blob([icsFor(ev)], { type: 'text/calendar' });
    const file = new File([blob], 'spotra-evento.ics', { type: 'text/calendar' });
    if(navigator.canShare && navigator.canShare({ files: [file] })){ navigator.share({ files: [file], title: ev.title }).catch(() => {}); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'spotra-evento.ics';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ================= Sección Eventos ================= */
  function listEl(){ return document.getElementById('eventsList'); }
  function detailEl(){ return document.getElementById('eventDetail'); }

  async function refreshState(){
    if(!B()) return;
    uid = await B().getUserId();
    myRegs = {};
    if(uid){
      const regs = await B().listMyRegistrations();
      regs.forEach(r => { myRegs[r.event.id] = r.myCategories; });
    }
    await loadInterests();
  }

  async function renderSection(){
    const wrap = listEl();
    if(!wrap) return;
    showList();
    if(activeTab === 'upcoming') await renderUpcoming();
    else if(activeTab === 'ranking') await renderRanking();
    else await renderMine();
  }

  async function renderUpcoming(cached){
    const wrap = listEl();
    if(!wrap || !B()) return;
    if(!cached || !upcomingCache.length){
      wrap.innerHTML = `<div class="meta" style="margin-top:14px">${esc(T('Cargando eventos...'))}</div>`;
      upcomingCache = await B().listEvents({ limit: 50 });
    }
    const list = upcomingCache
      .filter(ev => activeDisc === 'all' || ev.discipline === activeDisc || ev.discipline === 'todas')
      .filter(whenFilter)
      .sort((x, y) => (x.startsAt || 0) - (y.startsAt || 0));
    if(!list.length){
      const any = activeDisc !== 'all' || activeWhen !== 'all';
      wrap.innerHTML = `<div class="empty-state">${EV_ICON.cal}<b>${esc(T(any ? 'No hay eventos con esos filtros' : 'No hay eventos próximos'))}</b>${esc(T(any ? 'Probá con otra fecha o disciplina.' : 'Creá el primero desde el botón +.'))}</div>`;
      return;
    }
    const [feat, ...rest] = list;
    wrap.innerHTML = featuredHTML(feat) + (rest.length ? `<div class="evx-sub">${esc(T('Próximos'))}</div><div class="evx-list">${rest.map(ev => rowHTML(ev)).join('')}</div>` : '');
    if(deepEvent){ const id = deepEvent; deepEvent = null; try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){} openDetail(id); }
  }

  async function renderMine(){
    const wrap = listEl();
    if(!wrap || !B()) return;
    wrap.innerHTML = '<div class="meta" style="margin-top:14px">Cargando tus eventos...</div>';
    if(!uid){ wrap.innerHTML = '<div class="meta" style="margin-top:14px">Iniciá sesión para ver tus eventos.</div>'; return; }
    const [regs, mine] = await Promise.all([B().listMyRegistrations(), B().listMyOrganizedEvents()]);
    const parts = [];
    const organizedIds = {};
    if(mine.length){
      parts.push('<div class="kicker" style="font-size:10px;margin-top:14px">Organizás vos</div>');
      mine.forEach(ev => { organizedIds[ev.id] = true; parts.push(rowHTML(ev, { showStatus: true })); });
    }
    const regOnly = regs.filter(r => !organizedIds[r.event.id]);
    if(regOnly.length){
      parts.push('<div class="kicker" style="font-size:10px;margin-top:16px">Inscripto</div>');
      regOnly.forEach(r => parts.push(rowHTML(r.event, { myCategories: r.myCategories })));
    }
    if(!upcomingCache.length) upcomingCache = await B().listEvents({ limit: 50 });
    const regIds = new Set(regs.map(r => r.event.id));
    const intOnly = upcomingCache.filter(ev => interests.has(ev.id) && !organizedIds[ev.id] && !regIds.has(ev.id));
    if(intOnly.length){
      parts.push(`<div class="kicker" style="font-size:10px;margin-top:16px">${esc(T('Me interesa'))}</div>`);
      intOnly.forEach(ev => parts.push(rowHTML(ev)));
    }
    wrap.innerHTML = parts.length ? parts.join('') : '<div class="meta" style="margin-top:14px">Todavía no tenés eventos: inscribite a uno o creá el tuyo desde el +.</div>';
  }

  function showList(){
    const d = detailEl(); if(d){ d.style.display = 'none'; d.innerHTML = ''; }
    const l = listEl(); if(l) l.style.display = '';
    const tabs = document.getElementById('eventsTabs'); if(tabs) tabs.style.display = '';
    const disc = document.getElementById('eventsDisc'); if(disc) disc.style.display = activeTab === 'upcoming' ? '' : 'none';
    const when = document.getElementById('eventsWhen'); if(when) when.style.display = activeTab === 'upcoming' ? '' : 'none';
    /* el ranking dibuja su propio selector de disciplina */
    currentEvent = null;
  }


  /* ================= Ranking ================= */
  let rankDisc = 'skate';

  async function renderRanking(){
    const wrap = listEl();
    if(!wrap || !B()) return;
    const segs = ['skate', 'bmx', 'rollers'];
    const segHtml = `<div class="filter-row" style="margin-top:12px">${segs.map(s =>
      `<button class="${s === rankDisc ? 'active' : ''}" data-rank-disc="${s}">${DISC_LABEL[s]}</button>`).join('')}</div>`;
    wrap.innerHTML = segHtml + '<div class="meta" style="margin-top:12px">Cargando ranking...</div>';
    const rows = await B().listRanking(rankDisc);
    const seg = wrap.querySelector('.filter-row').outerHTML;
    if(!rows.length){
      wrap.innerHTML = seg + '<div class="meta" style="margin-top:14px">Todavía no hay puntos en ' + DISC_LABEL[rankDisc] + '. Los podios de los eventos SPOTRA suman acá: 1º 100 pts · 2º 60 · 3º 30.</div>';
      return;
    }
    wrap.innerHTML = seg + rows.map((r, i) =>
      `<div class="rk-row top${i + 1}">
        <div class="rk-pos">${i + 1}</div>
        <div class="rk-name">${esc(r.username || 'rider')}<div class="meta">${r.podiums} podio${r.podiums === 1 ? '' : 's'}${r.golds ? ' · ' + r.golds + ' oro' + (r.golds === 1 ? '' : 's') : ''}</div></div>
        <div class="rk-pts">${r.total_points}<span>pts</span></div>
      </div>`).join('');
  }

  /* ================= Detalle ================= */
  async function openDetail(eventId){
    let ev = upcomingCache.find(e => e.id === eventId) || null;
    if(!ev && B()){
      const regs = await B().listMyRegistrations();
      const hit = regs.find(r => r.event.id === eventId);
      if(hit) ev = hit.event;
      if(!ev){
        const mine = await B().listMyOrganizedEvents();
        ev = mine.find(e => e.id === eventId) || null;
      }
    }
    if(!ev){ toast('No se pudo abrir el evento.'); return; }
    currentEvent = ev;
    const d = detailEl(); const l = listEl();
    if(!d || !l) return;
    l.style.display = 'none';
    const tabs = document.getElementById('eventsTabs'); if(tabs) tabs.style.display = 'none';
    const disc = document.getElementById('eventsDisc'); if(disc) disc.style.display = 'none';
    const when = document.getElementById('eventsWhen'); if(when) when.style.display = 'none';
    d.style.display = '';
    d.innerHTML = detailHTML(ev);
    renderAttendees(ev);
    renderResults(ev);
    eventWeather(ev);
    window.scrollTo(0, 0);
  }

  function detailHTML(ev){
    const mine = myRegs[ev.id];
    const isOrganizer = uid && ev.organizerId === uid;
    const full = isFull(ev); const closed = isClosed(ev); const past = isPast(ev);
    const chips = [];
    if(DISC_LABEL[ev.discipline]) chips.push(`<span class="ev-chip on">${esc(DISC_LABEL[ev.discipline])}</span>`);
    chips.push(`<span class="ev-chip">${esc(regChip(ev))}</span>`);
    if(ev.status && ev.status !== 'approved') chips.push(`<span class="ev-chip ${ev.status === 'pending' ? 'warn' : 'off'}">${esc(STATUS_LABEL[ev.status])}</span>`);

    let when = fmtWhen(ev.startsAt);
    if(ev.closesAt) when += ' — inscripción hasta ' + fmtShortDate(ev.closesAt);

    const rows = [];
    rows.push(`<div class="ev-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/></svg>${esc(when)}</div>`);
    rows.push(`<div class="ev-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.4"/></svg>${esc(ev.placeName + (ev.placeCity ? ' · ' + ev.placeCity : ''))}</div>`);
    if(ev.registrationInfo) rows.push(`<div class="ev-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16v8H4z"/><path d="M4 12h16"/></svg>Inscripción: ${esc(ev.registrationInfo)}</div>`);
    if(ev.prizes) rows.push(`<div class="ev-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h12v3a6 6 0 0 1-12 0V4Z"/><path d="M9 14v3M15 14v3M8 20h8"/></svg>Premios: ${esc(ev.prizes)}</div>`);
    if(ev.rainReschedule) rows.push(`<div class="ev-info-row rain"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15a5 5 0 1 1 1-9.9A6 6 0 0 1 19 8a4 4 0 0 1 0 7H7Z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>Si llueve se reprograma</div>`);

    let cats = '';
    if(ev.categories.length){
      cats = `<div class="f-label" style="margin-top:14px">Categorías</div><div class="ev-cats">${ev.categories.map(c => `<span class="ev-cat">${esc(c)}</span>`).join('')}</div>`;
    }
    let desc = ev.description ? `<div class="f-label" style="margin-top:14px">Info del evento</div><p class="spot-desc" style="margin-top:4px">${esc(ev.description)}</p>` : '';

    let action = '';
    if(isOrganizer){
      if(ev.status === 'archived'){
        action = `<div class="ev-info-row off" style="border-color:rgba(255,122,122,.4);background:rgba(255,122,122,.08);color:#ff7a7a">Evento cancelado</div>
          <button class="primary-btn" data-ev-attendlist="${esc(ev.id)}" style="width:100%;min-height:52px;margin-top:9px">Ver inscriptos (${ev.regCount})</button>`;
      } else if(past){
        action = `<button class="primary-btn" data-ev-results="${esc(ev.id)}" style="width:100%;min-height:52px;margin-top:14px">Cargar resultados</button>
          <button class="ghost-btn" data-ev-attendlist="${esc(ev.id)}" style="width:100%;min-height:48px;margin-top:9px">Ver inscriptos (${ev.regCount})</button>`;
      } else {
        action = `<button class="primary-btn" data-ev-attendlist="${esc(ev.id)}" style="width:100%;min-height:52px;margin-top:14px">Ver inscriptos (${ev.regCount})</button>
          <div class="ev-actions-2"><button class="ghost-btn" data-ev-edit="${esc(ev.id)}">Editar</button><button class="ghost-btn" data-ev-cancelev="${esc(ev.id)}" style="color:#ff7a7a;border-color:rgba(255,122,122,.4)">Cancelar evento</button></div>`;
      }
    } else if(ev.status === 'archived'){
      action = `<div class="ev-info-row off" style="border-color:rgba(255,122,122,.4);background:rgba(255,122,122,.08);color:#ff7a7a">Este evento fue cancelado por el organizador.</div>`;
    } else if(mine){
      action = `<div class="ev-info-row" style="border-color:rgba(46,232,77,.5);color:var(--green-hot)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12l5 5L20 6"/></svg>Inscripto${mine.length ? ' en: ' + esc(mine.join(', ')) : ''}</div>
        <button class="ghost-btn" data-ev-cancel="${esc(ev.id)}" style="width:100%;min-height:48px;margin-top:9px">Cancelar inscripción</button>`;
    } else if(past){
      action = `<div class="ev-info-row">Este evento ya pasó.</div>`;
    } else if(ev.status !== 'approved'){
      action = '';
    } else if(full){
      action = `<div class="ev-info-row off" style="border-color:rgba(255,122,122,.4);background:rgba(255,122,122,.08);color:#ff7a7a">Cupo completo</div>`;
    } else if(closed){
      action = `<div class="ev-info-row">La inscripción cerró.</div>`;
    } else {
      action = `<button class="primary-btn" data-ev-register="${esc(ev.id)}" style="width:100%;min-height:52px;margin-top:14px">Inscribirme</button>`;
    }

    const dirUrl = (Number.isFinite(ev.placeLat) && Number.isFinite(ev.placeLng))
      ? `https://www.google.com/maps/search/?api=1&query=${ev.placeLat},${ev.placeLng}` : '';
    const wa = whatsappUrl(ev.contactPhone);
    const btns = [];
    if(ev.placeId) btns.push(`<button type="button" class="ghost-btn" data-ev-map="${esc(ev.placeId)}">${esc(T('Ver en el mapa'))}</button>`);
    if(dirUrl) btns.push(`<a class="ghost-btn" href="${esc(dirUrl)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Cómo llegar</a>`);
    if(wa) btns.push(`<a class="ghost-btn" href="${esc(wa)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Contactar</a>`);

    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;cursor:pointer" data-ev-back>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;color:var(--muted)"><path d="M15 6l-6 6 6 6"/></svg>
        <span class="meta">Volver a eventos</span></div>
      <div class="evx-dcover" style="background-image:url('${esc(ev.imageUrl || 'assets/banners/banner-skatepark-4.webp')}')" ${ev.imageUrl ? `data-lightbox="${esc(ev.imageUrl)}"` : ''}>${dateBadge(ev.startsAt, true)}</div>
      <div class="ev-chips" style="margin-top:12px">${chips.join('')}</div>
      <h2 style="font-family:var(--display);font-size:27px;margin-top:8px">${esc(ev.title)}</h2>
      ${goingText(ev) ? `<div class="evx-going" style="margin-top:4px">${esc(goingText(ev))}</div>` : ''}
      ${ev.capacity ? `<div class="evx-cap"><span style="width:${Math.min(100, Math.round(100 * (ev.regCount || 0) / ev.capacity))}%"></span></div>` : ''}
      <div class="evx-dbtns">
        <button type="button" class="evx-dbtn${interests.has(ev.id) ? ' on' : ''}" data-ev-interest="${esc(ev.id)}">${EV_ICON.heart}<span>${esc(T('Me interesa'))}</span></button>
        <button type="button" class="evx-dbtn" data-ev-share>${EV_ICON.share}<span>${esc(T('Compartir'))}</span></button>
        <button type="button" class="evx-dbtn" data-ev-cal>${EV_ICON.cal}<span>${esc(T('Calendario'))}</span></button>
      </div>
      ${rows.join('')}
      <div id="evWeather" class="ev-info-row"><span class="meta">${esc(T('Cargando clima...'))}</span></div>
      ${cats}
      <div id="evResultsBlock"></div>
      <div class="f-label" style="margin-top:14px" id="evAttendHead" hidden>Van</div>
      <div class="ev-chips" id="evAttendList"></div>
      ${desc}
      ${action}
      ${btns.length ? `<div class="ev-actions-2">${btns.join('')}</div>` : ''}`;
  }

  async function renderAttendees(ev){
    const head = document.getElementById('evAttendHead');
    const wrap = document.getElementById('evAttendList');
    if(!head || !wrap || !B() || !uid) return;
    const regs = await B().listEventRegistrations(ev.id);
    if(!regs.length || !currentEvent || currentEvent.id !== ev.id) return;
    head.hidden = false;
    head.textContent = `Van (${regs.length})`;
    const names = regs.slice(0, 12).map(r => `<span class="ev-chip">${esc(r.username || 'rider')}</span>`);
    if(regs.length > 12) names.push(`<span class="ev-chip">+${regs.length - 12} más</span>`);
    wrap.innerHTML = names.join('');
  }


  const MEDALS = ['1º', '2º', '3º'];

  async function renderResults(ev){
    const box = document.getElementById('evResultsBlock');
    if(!box || !B()) return;
    const rows = await B().listEventResults(ev.id);
    if(!rows.length || !currentEvent || currentEvent.id !== ev.id) return;
    const groups = {};
    rows.forEach(r => { (groups[r.category] = groups[r.category] || []).push(r); });
    box.innerHTML = '<div class="f-label" style="margin-top:14px">Resultados</div>' +
      Object.keys(groups).map(cat =>
        `<div class="ev-info-row" style="flex-direction:column;align-items:stretch;gap:6px">
          <b style="font-size:12px;letter-spacing:.12em;color:var(--green-hot);text-transform:uppercase">${esc(cat)}</b>
          ${groups[cat].map(r => `<div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(MEDALS[r.position - 1] || r.position)} ${esc(r.username || 'rider')}</span><span style="color:var(--green-hot)">${r.points} pts</span></div>`).join('')}
        </div>`).join('');
  }

  /* ================= Cargar resultados (organizador) ================= */
  async function openResults(ev){
    const regs = await B().listEventRegistrations(ev.id);
    if(!regs.length){ toast('No hay inscriptos para cargar resultados.'); return; }
    ensureResOverlay();
    const o = document.getElementById('evResOverlay');
    document.getElementById('evResTitle').textContent = 'Resultados · ' + ev.title;
    const cats = ev.categories.length ? ev.categories : ['General'];
    const body = document.getElementById('evResBody');
    body.innerHTML = cats.map((cat, ci) => {
      const pool = ev.categories.length ? regs.filter(r => (r.categories || []).includes(cat)) : regs;
      if(!pool.length) return `<div style="margin-top:14px"><b style="font-size:12px;letter-spacing:.12em;color:#2ee84d;text-transform:uppercase">${esc(cat)}</b><div style="color:#9aa69f;font-size:12.5px;margin-top:4px">Sin inscriptos en esta categoría.</div></div>`;
      const opts = '<option value="">—</option>' + pool.map(r => `<option value="${esc(r.profile_id)}">${esc(r.username || 'rider')}</option>`).join('');
      return `<div data-res-cat="${esc(cat)}" style="margin-top:14px">
        <b style="font-size:12px;letter-spacing:.12em;color:#2ee84d;text-transform:uppercase">${esc(cat)}</b>
        ${[0, 1, 2].map(p => `<div style="display:flex;align-items:center;gap:9px;margin-top:7px">
          <span style="width:30px;color:#9aa69f;font-size:13px">${MEDALS[p]}</span>
          <select data-res-pos="${p}" style="flex:1;height:42px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:#101712;color:#fff;padding:0 10px;font-size:13.5px">${opts}</select>
        </div>`).join('')}
      </div>`;
    }).join('');
    o.dataset.eventId = ev.id;
    o.style.display = 'flex';
  }

  function ensureResOverlay(){
    if(document.getElementById('evResOverlay')) return;
    const o = document.createElement('div');
    o.id = 'evResOverlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:none;align-items:flex-end;justify-content:center';
    o.innerHTML = `<div style="width:min(560px,100%);background:#0a100b;border:1px solid rgba(46,232,77,.4);border-radius:24px 24px 0 0;padding:20px 18px;max-height:88vh;overflow-y:auto">
      <div style="width:52px;height:5px;border-radius:999px;background:rgba(255,255,255,.25);margin:0 auto 14px"></div>
      <b id="evResTitle" style="font-size:17px;color:#fff;display:block"></b>
      <div style="color:#9aa69f;font-size:12.5px;margin:4px 0 2px">Elegí el podio de cada categoría. Puntos al ranking: 1º 100 · 2º 60 · 3º 30. Guardar reemplaza resultados anteriores.</div>
      <div id="evResBody"></div>
      <button id="evResSave" style="width:100%;height:52px;border-radius:15px;background:#2ee84d;color:#06130a;border:0;font-weight:800;font-size:15px;cursor:pointer;margin-top:16px">Guardar resultados</button>
      <button id="evResClose" style="width:100%;height:46px;border-radius:15px;background:transparent;color:#dce3dd;border:1px solid rgba(255,255,255,.18);font-weight:700;font-size:13.5px;cursor:pointer;margin-top:9px">Cerrar</button>
    </div>`;
    document.body.appendChild(o);
    o.addEventListener('click', e => { if(e.target === o) o.style.display = 'none'; });
    document.getElementById('evResClose').addEventListener('click', () => { o.style.display = 'none'; });
    document.getElementById('evResSave').addEventListener('click', saveResults);
  }

  async function saveResults(){
    const o = document.getElementById('evResOverlay');
    const evId = o.dataset.eventId;
    const blocks = Array.from(o.querySelectorAll('[data-res-cat]'));
    let saved = 0, skipped = 0;
    for(const block of blocks){
      const cat = block.dataset.resCat;
      const podium = [0, 1, 2].map(p => (block.querySelector(`[data-res-pos="${p}"]`) || {}).value || null);
      if(!podium[0]){ skipped++; continue; }
      if((podium[1] && podium[1] === podium[0]) || (podium[2] && (podium[2] === podium[0] || podium[2] === podium[1]))){
        toast('Hay riders repetidos en el podio de ' + cat + '.');
        return;
      }
      const res = await B().saveEventResults(evId, cat, podium);
      if(!res.ok){ toast('No se pudo guardar ' + cat + ': revisá e intentá de nuevo.'); return; }
      saved++;
    }
    if(!saved){ toast('Elegí al menos el 1º puesto de alguna categoría.'); return; }
    o.style.display = 'none';
    toast('Resultados guardados. Ya suman al ranking.');
    if(currentEvent && currentEvent.id === evId) openDetail(evId);
  }

  /* ================= Inscripción ================= */
  function openRegister(ev){
    if(!uid){ toast('Iniciá sesión para inscribirte.'); return; }
    if(!ev.categories.length){ doRegister(ev, []); return; }
    ensureRegOverlay();
    const o = document.getElementById('evRegOverlay');
    document.getElementById('evRegTitle').textContent = 'Inscribirme a ' + ev.title;
    const box = document.getElementById('evRegCats');
    box.innerHTML = ev.categories.map(c =>
      `<label style="display:flex;align-items:center;gap:11px;padding:13px;border-radius:14px;border:1px solid rgba(255,255,255,.14);margin-bottom:8px;cursor:pointer;font-size:14px">
        <input type="checkbox" value="${esc(c)}" style="width:19px;height:19px;accent-color:#2ee84d">${esc(c)}</label>`).join('');
    o.dataset.eventId = ev.id;
    o.style.display = 'flex';
  }

  function ensureRegOverlay(){
    if(document.getElementById('evRegOverlay')) return;
    const o = document.createElement('div');
    o.id = 'evRegOverlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:none;align-items:flex-end;justify-content:center';
    o.innerHTML = `<div style="width:min(560px,100%);background:#0a100b;border:1px solid rgba(46,232,77,.4);border-radius:24px 24px 0 0;padding:20px 18px;max-height:85vh;overflow-y:auto">
      <div style="width:52px;height:5px;border-radius:999px;background:rgba(255,255,255,.25);margin:0 auto 14px"></div>
      <b id="evRegTitle" style="font-size:17px;color:#fff;display:block"></b>
      <div style="color:#9aa69f;font-size:12.5px;margin:4px 0 14px">Elegí en qué categorías competís (podés marcar más de una)</div>
      <div id="evRegCats"></div>
      <button id="evRegConfirm" style="width:100%;height:52px;border-radius:15px;background:#2ee84d;color:#06130a;border:0;font-weight:800;font-size:15px;cursor:pointer;margin-top:6px">Confirmar inscripción</button>
      <button id="evRegClose" style="width:100%;height:46px;border-radius:15px;background:transparent;color:#dce3dd;border:1px solid rgba(255,255,255,.18);font-weight:700;font-size:13.5px;cursor:pointer;margin-top:9px">Cancelar</button>
    </div>`;
    document.body.appendChild(o);
    o.addEventListener('click', e => { if(e.target === o) o.style.display = 'none'; });
    document.getElementById('evRegClose').addEventListener('click', () => { o.style.display = 'none'; });
    document.getElementById('evRegConfirm').addEventListener('click', () => {
      const cats = Array.from(o.querySelectorAll('#evRegCats input:checked')).map(i => i.value);
      if(!cats.length){ toast('Marcá al menos una categoría.'); return; }
      const ev = currentEvent && currentEvent.id === o.dataset.eventId ? currentEvent : null;
      if(!ev){ o.style.display = 'none'; return; }
      o.style.display = 'none';
      doRegister(ev, cats);
    });
  }

  async function doRegister(ev, cats){
    toast('Inscribiendo...');
    const res = await B().registerToEvent(ev.id, cats);
    if(!res.ok){
      toast(res.error === 'ya-inscripto' ? 'Ya estabas inscripto en este evento.'
        : res.error === 'auth' ? 'Iniciá sesión para inscribirte.'
        : 'No se pudo inscribir. Probá de nuevo.');
      return;
    }
    myRegs[ev.id] = cats;
    ev.regCount += 1;
    toast('Inscripción confirmada.');
    if(currentEvent && currentEvent.id === ev.id) openDetail(ev.id);
    renderHomeEvents();
  }

  async function doCancel(ev){
    toast('Cancelando...');
    const res = await B().unregisterFromEvent(ev.id);
    if(!res.ok){ toast('No se pudo cancelar. Probá de nuevo.'); return; }
    delete myRegs[ev.id];
    ev.regCount = Math.max(0, ev.regCount - 1);
    toast('Inscripción cancelada.');
    if(currentEvent && currentEvent.id === ev.id) openDetail(ev.id);
  }

  /* ================= Lista de inscriptos (organizador) ================= */
  async function openAttendList(ev){
    const regs = await B().listEventRegistrations(ev.id);
    ensureAttendOverlay();
    const o = document.getElementById('evAttOverlay');
    document.getElementById('evAttTitle').textContent = 'Inscriptos · ' + ev.title;
    document.getElementById('evAttMeta').textContent = regs.length + (ev.capacity ? ' de ' + ev.capacity : '') + (ev.closesAt ? ' · cierre ' + fmtShortDate(ev.closesAt) : '');
    const groups = {};
    regs.forEach(r => {
      const cats = (r.categories && r.categories.length) ? r.categories : ['Sin categoría'];
      cats.forEach(c => { (groups[c] = groups[c] || []).push(r.username || 'rider'); });
    });
    const box = document.getElementById('evAttBody');
    if(!regs.length){
      box.innerHTML = '<div style="color:#9aa69f;font-size:13px">Todavía no hay inscriptos.</div>';
    } else {
      box.innerHTML = Object.keys(groups).map(c =>
        `<div style="font-size:11px;letter-spacing:.15em;color:#2ee84d;margin:10px 0 6px;text-transform:uppercase">${esc(c)} (${groups[c].length})</div>` +
        groups[c].map(n => `<div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);margin-bottom:5px;font-size:13px;color:#e8efe8">${esc(n)}</div>`).join('')
      ).join('');
    }
    o.dataset.copy = Object.keys(groups).map(c => c.toUpperCase() + ':\n' + groups[c].map(n => '- ' + n).join('\n')).join('\n\n');
    o.style.display = 'flex';
  }

  function ensureAttendOverlay(){
    if(document.getElementById('evAttOverlay')) return;
    const o = document.createElement('div');
    o.id = 'evAttOverlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:none;align-items:flex-end;justify-content:center';
    o.innerHTML = `<div style="width:min(560px,100%);background:#0a100b;border:1px solid rgba(46,232,77,.4);border-radius:24px 24px 0 0;padding:20px 18px;max-height:85vh;overflow-y:auto">
      <div style="width:52px;height:5px;border-radius:999px;background:rgba(255,255,255,.25);margin:0 auto 14px"></div>
      <b id="evAttTitle" style="font-size:17px;color:#fff;display:block"></b>
      <div id="evAttMeta" style="color:#9aa69f;font-size:12.5px;margin:4px 0 8px"></div>
      <div id="evAttBody"></div>
      <button id="evAttCopy" style="width:100%;height:48px;border-radius:14px;background:transparent;color:#2ee84d;border:1px solid #2ee84d;font-weight:700;font-size:13.5px;cursor:pointer;margin-top:12px">Copiar lista</button>
      <button id="evAttClose" style="width:100%;height:46px;border-radius:14px;background:transparent;color:#dce3dd;border:1px solid rgba(255,255,255,.18);font-weight:700;font-size:13.5px;cursor:pointer;margin-top:9px">Cerrar</button>
    </div>`;
    document.body.appendChild(o);
    o.addEventListener('click', e => { if(e.target === o) o.style.display = 'none'; });
    document.getElementById('evAttClose').addEventListener('click', () => { o.style.display = 'none'; });
    document.getElementById('evAttCopy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(o.dataset.copy || ''); toast('Lista copiada.'); }
      catch { toast('No se pudo copiar en este navegador.'); }
    });
  }

  /* ================= Elegir spot en el mapa (crear evento) ================= */
  let pickMap = null, pickMarkers = [], pickCandidate = null, pickPlaces = [];

  async function openSpotPicker(){
    ensurePickOverlay();
    const o = document.getElementById('evPickOverlay');
    o.style.display = 'flex';
    const ready = window.SpotraMaps && window.SpotraMaps.ensureApi ? await window.SpotraMaps.ensureApi() : !!(window.google && window.google.maps);
    const el = document.getElementById('evPickMap');
    if(!ready){ el.innerHTML = '<div style="padding:18px;color:#9aa6a0">No se pudo cargar el mapa. Revisá tu conexión.</div>'; return; }
    if(!B()) return;
    pickPlaces = (await B().listPlaces({ type: 'all' })).filter(p => p.id && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if(!pickMap){
      pickMap = new google.maps.Map(el, {
        center: { lat: -34.9011, lng: -56.1645 }, zoom: 7,
        disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0c1014' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#5b6b63' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0c1014' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2420' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1f16' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] }
        ]
      });
    }
    drawPickMarkers(pickPlaces);
    setTimeout(() => { google.maps.event.trigger(pickMap, 'resize'); }, 250);
    setPickCandidate(null);
    const q = document.getElementById('evPickSearch');
    if(q) q.value = '';
  }

  function drawPickMarkers(list){
    pickMarkers.forEach(m => m.setMap(null));
    pickMarkers = [];
    const bounds = new google.maps.LatLngBounds();
    list.forEach(p => {
      const m = new google.maps.Marker({ map: pickMap, position: { lat: p.lat, lng: p.lng }, title: p.name });
      m.addListener('click', () => setPickCandidate(p, m));
      pickMarkers.push(m);
      bounds.extend(m.getPosition());
    });
    if(list.length > 1) pickMap.fitBounds(bounds, 40);
    else if(list.length === 1){ pickMap.setCenter({ lat: list[0].lat, lng: list[0].lng }); pickMap.setZoom(14); }
  }

  function setPickCandidate(place){
    pickCandidate = place;
    const card = document.getElementById('evPickCard');
    const btn = document.getElementById('evPickConfirm');
    if(place){
      card.style.display = '';
      card.innerHTML = `<b style="color:#fff;font-size:14px">${esc(place.name)}</b><div style="color:#9aa69f;font-size:12px;margin-top:2px">${esc([place.label, place.city].filter(Boolean).join(' · '))}</div>`;
      btn.disabled = false; btn.style.opacity = '1';
    } else {
      card.style.display = 'none'; card.innerHTML = '';
      btn.disabled = true; btn.style.opacity = '.5';
    }
  }

  function filterPick(q){
    const term = String(q || '').trim().toLowerCase();
    const list = term ? pickPlaces.filter(p => (p.name + ' ' + (p.city || '')).toLowerCase().includes(term)) : pickPlaces;
    drawPickMarkers(list);
    if(term && list.length === 1) setPickCandidate(list[0]);
  }

  function ensurePickOverlay(){
    if(document.getElementById('evPickOverlay')) return;
    const o = document.createElement('div');
    o.id = 'evPickOverlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);display:none;align-items:center;justify-content:center;padding:14px';
    o.innerHTML = `<div style="width:min(560px,96vw);background:#0a100b;border:1px solid rgba(46,232,77,.4);border-radius:20px;padding:14px;display:flex;flex-direction:column;max-height:92vh">
      <b style="color:#fff;font-size:16px;margin-bottom:10px">Elegí el spot del evento</b>
      <input id="evPickSearch" placeholder="Buscar por nombre o ciudad..." style="height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#fff;padding:0 13px;font-size:14px;outline:0;margin-bottom:10px">
      <div id="evPickMap" style="height:min(46vh,380px);border-radius:14px;overflow:hidden;background:#0c1014;flex-shrink:0"></div>
      <div id="evPickCard" style="display:none;margin-top:10px;padding:11px 13px;border-radius:13px;border:1px solid rgba(46,232,77,.5);background:rgba(46,232,77,.08)"></div>
      <div style="display:flex;gap:9px;margin-top:12px">
        <button id="evPickCancel" style="flex:1;height:48px;border-radius:13px;background:transparent;border:1px solid rgba(255,255,255,.18);color:#dce3dd;font-weight:700;cursor:pointer">Cancelar</button>
        <button id="evPickConfirm" disabled style="flex:2;height:48px;border-radius:13px;background:#2ee84d;border:0;color:#06130a;font-weight:800;cursor:pointer;opacity:.5">Confirmar spot</button>
      </div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', e => { if(e.target === o) o.style.display = 'none'; });
    document.getElementById('evPickCancel').addEventListener('click', () => { o.style.display = 'none'; });
    document.getElementById('evPickSearch').addEventListener('input', e => filterPick(e.target.value));
    document.getElementById('evPickConfirm').addEventListener('click', () => {
      if(!pickCandidate) return;
      pickedPlace = pickCandidate;
      const idInput = document.getElementById('eventPlaceId');
      const label = document.getElementById('eventPlaceLabel');
      if(idInput) idInput.value = pickCandidate.id;
      if(label){ label.textContent = pickCandidate.name + (pickCandidate.city ? ' · ' + pickCandidate.city : ''); label.style.color = 'var(--text)'; }
      o.style.display = 'none';
    });
  }


  /* ================= Editar / cancelar (organizador) ================= */
  function pad2(n){ return String(n).padStart(2, '0'); }

  function openEdit(evd){
    editingId = evd.id;
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val == null ? '' : val; };
    set('eventTitle', evd.title);
    set('eventPlaceId', evd.placeId);
    const label = document.getElementById('eventPlaceLabel');
    if(label){ label.textContent = evd.placeName + (evd.placeCity ? ' · ' + evd.placeCity : ''); label.style.color = 'var(--text)'; }
    if(evd.startsAt){
      set('eventDate', `${evd.startsAt.getFullYear()}-${pad2(evd.startsAt.getMonth() + 1)}-${pad2(evd.startsAt.getDate())}`);
      set('eventTime', `${pad2(evd.startsAt.getHours())}:${pad2(evd.startsAt.getMinutes())}`);
    }
    set('eventDesc', evd.description);
    set('eventCategories', evd.categories.join(', '));
    set('eventRegInfo', evd.registrationInfo);
    set('eventPrizes', evd.prizes);
    set('eventCapacity', evd.capacity || '');
    if(evd.closesAt) set('eventCloses', `${evd.closesAt.getFullYear()}-${pad2(evd.closesAt.getMonth() + 1)}-${pad2(evd.closesAt.getDate())}`);
    else set('eventCloses', '');
    set('eventContact', evd.contactPhone);
    const rain = document.getElementById('eventRain'); if(rain) rain.checked = !!evd.rainReschedule;
    document.querySelectorAll('[data-seg="eventDiscipline"] button').forEach(b => b.classList.toggle('active', b.dataset.v === (evd.discipline || 'todas')));
    const btn = document.querySelector('[data-submit="event"]');
    if(btn) btn.textContent = 'Guardar cambios';
    if(typeof window.openModal === 'function') window.openModal('event');
  }

  function resetEditState(){
    editingId = null;
    const btn = document.querySelector('[data-submit="event"]');
    if(btn && btn.textContent !== 'Enviar a aprobación') btn.textContent = 'Enviar a aprobación';
  }

  async function doCancelEvent(evd){
    if(!window.confirm('¿Cancelar "' + evd.title + '"? Los inscriptos lo verán como cancelado. Esto no se puede deshacer.')) return;
    toast('Cancelando evento...');
    const res = await B().organizerCancelEvent(evd.id);
    if(!res.ok){ toast('No se pudo cancelar. Probá de nuevo.'); return; }
    evd.status = 'archived';
    toast('Evento cancelado.');
    if(currentEvent && currentEvent.id === evd.id) openDetail(evd.id);
    renderHomeEvents();
  }

  /* ================= Crear evento ================= */
  // portada del evento: lado mayor 1600 px, JPG
  function coverBlob(file){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => resolve(b), 'image/jpeg', 0.84);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }
  document.addEventListener('change', e => {
    if(e.target && e.target.id === 'eventCover'){
      const f = e.target.files && e.target.files[0];
      const lbl = document.getElementById('eventCoverName');
      if(lbl) lbl.textContent = f ? f.name : T('Elegir imagen de portada');
    }
  });

  async function submitFromForm(){
    const g = id => (document.getElementById(id) || {}).value || '';
    const title = g('eventTitle');
    const placeId = g('eventPlaceId');
    const date = g('eventDate');
    const time = g('eventTime');
    if(!title.trim() || !date || !time){ toast('Completá nombre, fecha y hora.'); return; }
    if(!placeId){ toast('Elegí el spot del evento en el mapa.'); return; }
    const startsAt = new Date(date + 'T' + time);
    if(isNaN(startsAt)){ toast('Fecha u hora inválida.'); return; }
    if(startsAt.getTime() < Date.now() - 3600 * 1000){ toast('La fecha del evento ya pasó. Elegí una futura.'); return; }
    let closesAt = null;
    if(g('eventCloses')){
      const c = new Date(g('eventCloses') + 'T23:59');
      if(!isNaN(c)){
        if(c.getTime() > startsAt.getTime()){ toast('El cierre de inscripción no puede ser después del evento.'); return; }
        closesAt = c.toISOString();
      }
    }
    const capRaw = parseInt(g('eventCapacity'), 10);
    const discBtn = document.querySelector('[data-seg="eventDiscipline"] .active');
    const payload = {
      placeId,
      title: title.trim(),
      description: g('eventDesc').trim(),
      discipline: (discBtn && discBtn.dataset.v) || 'todas',
      categories: g('eventCategories').split(',').map(s => s.trim()).filter(Boolean).slice(0, 12),
      registrationInfo: g('eventRegInfo').trim(),
      prizes: g('eventPrizes').trim(),
      capacity: Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null,
      closesAt,
      contactPhone: g('eventContact').trim(),
      rainReschedule: !!(document.getElementById('eventRain') || {}).checked,
      startsAt: startsAt.toISOString()
    };
    const isEdit = !!editingId;
    if(isEdit) payload.id = editingId;
    const btn = document.querySelector('[data-submit="event"]');
    if(btn){ btn.disabled = true; btn.textContent = T('Enviando...'); }
    const coverInput = document.getElementById('eventCover');
    const coverFile = coverInput && coverInput.files && coverInput.files[0];
    if(coverFile){
      if(btn) btn.textContent = T('Subiendo foto...');
      const blob = await coverBlob(coverFile);
      const up = blob ? await B().uploadListingImage(blob, 'jpg') : { ok: false };
      if(up.ok) payload.imageUrl = up.url;
      else toast(T('No se pudo subir la portada. El evento se guarda sin ella.'));
      if(btn) btn.textContent = T('Enviando...');
    }
    const result = B() ? (isEdit ? await B().organizerUpdateEvent(payload) : await B().createEvent(payload)) : { ok: false };
    if(btn){ btn.disabled = false; btn.textContent = 'Enviar a aprobación'; }
    if(!result.ok){
      toast(result.error === 'auth' ? 'Iniciá sesión para crear un evento.' : 'No se pudo guardar el evento. Probá de nuevo.');
      return;
    }
    if(isEdit && payload.imageUrl){
      try { const c = await B().getClient(); await c.rpc('organizer_set_event_image', { p_event_id: payload.id, p_url: payload.imageUrl }); } catch(e){}
    }
    if(coverInput) coverInput.value = '';
    const cp = document.getElementById('eventCoverName'); if(cp) cp.textContent = T('Elegir imagen de portada');
    if(typeof window.resetForm === 'function') window.resetForm('eventForm');
    const idInput = document.getElementById('eventPlaceId'); if(idInput) idInput.value = '';
    const label = document.getElementById('eventPlaceLabel'); if(label){ label.textContent = 'Elegir spot en el mapa'; label.style.color = 'var(--muted)'; }
    const rain = document.getElementById('eventRain'); if(rain) rain.checked = false;
    document.querySelectorAll('[data-seg="eventDiscipline"] button').forEach((b, i) => b.classList.toggle('active', i === 0));
    pickedPlace = null;
    if(typeof window.closeModal === 'function') window.closeModal();
    toast(isEdit ? 'Cambios guardados.' : 'Evento enviado. Queda pendiente de aprobación.');
    if(isEdit){
      const id = editingId;
      resetEditState();
      upcomingCache = [];
      if(currentEvent && currentEvent.id === id){ await refreshState(); openDetail(id); }
      renderHomeEvents();
    }
    if(activeTab === 'mine') renderMine();
  }

  /* ================= Inicio + ficha del mapa ================= */
  async function renderHomeEvents(){
    const wrap = document.getElementById('homeEvents');
    if(!wrap || !B()) return;
    const events = await B().listEvents({ limit: 5 });
    if(!events.length){
      wrap.innerHTML = '<div class="meta">Todavía no hay eventos publicados. Creá el primero desde el botón +.</div>';
      return;
    }
    wrap.innerHTML = events.map(ev => cardHTML(ev)).join('');
  }

  let spotToken = 0;
  async function renderSpotEvents(place){
    const head = document.getElementById('spotEventsHead');
    const wrap = document.getElementById('spotEvents');
    if(!head || !wrap) return;
    head.style.display = 'none';
    wrap.innerHTML = '';
    if(!place || !place.id || place.isGoogleResult || !B()) return;
    const token = ++spotToken;
    const events = await B().listEvents({ placeId: place.id, limit: 5 });
    if(token !== spotToken) return;
    if(!events.length) return;
    head.style.display = '';
    wrap.innerHTML = events.map(ev => cardHTML(ev)).join('');
  }

  /* ================= Wiring ================= */
  document.addEventListener('click', async e => {
    const openCard = e.target.closest('[data-ev-open]');
    if(openCard){
      const id = openCard.dataset.evOpen;
      if(!document.querySelector('[data-view="events"].active') && typeof window.setRoute === 'function') window.setRoute('events');
      await refreshState();
      openDetail(id);
      return;
    }
    const intr = e.target.closest('[data-ev-interest]');
    if(intr){ e.preventDefault(); e.stopPropagation(); toggleInterest(intr.dataset.evInterest); return; }
    if(e.target.closest('[data-ev-back]')){ renderSection(); return; }
    const wh = e.target.closest('[data-ev-when]');
    if(wh){
      activeWhen = wh.dataset.evWhen;
      document.querySelectorAll('#eventsWhen button').forEach(b => b.classList.toggle('active', b === wh));
      if(activeWhen === 'near' && !evLoc){ locateEvents(); }
      renderUpcoming(true);
      return;
    }
    if(e.target.closest('[data-ev-share]') && currentEvent){
      const ev = currentEvent, L = window.SpotraI18n ? window.SpotraI18n.lang() : 'es';
      const when = ev.startsAt ? ev.startsAt.toLocaleDateString(LOCALE(), { weekday: 'long', day: 'numeric', month: 'long' }) + ' ' + hhmm(ev.startsAt) : '';
      const text = ({ es: `${ev.title} · ${when} en ${ev.placeName}. Sumate en SPOTRA`, pt: `${ev.title} · ${when} em ${ev.placeName}. Participe pelo SPOTRA`, en: `${ev.title} · ${when} at ${ev.placeName}. Join on SPOTRA` })[L];
      if(window.spotraShare) window.spotraShare({ title: ev.title, text, url: location.origin + '/?event=' + encodeURIComponent(ev.id) + '#events' });
      return;
    }
    if(e.target.closest('[data-ev-cal]') && currentEvent){ addToCalendar(currentEvent); return; }
    const mp = e.target.closest('[data-ev-map]');
    if(mp){
      const pid = mp.dataset.evMap;
      if(window.setRoute) window.setRoute('map');
      let tries = 0;
      const go = () => { if(document.querySelector('#spotSheet.open')) return; if(window.SpotraMaps && window.SpotraMaps.openPlaceById) window.SpotraMaps.openPlaceById(pid); if(++tries < 8) setTimeout(go, 800); };
      setTimeout(go, 600);
      return;
    }
    const tab = e.target.closest('[data-ev-tab]');
    if(tab){
      activeTab = tab.dataset.evTab;
      document.querySelectorAll('#eventsTabs button').forEach(b => b.classList.toggle('active', b === tab));
      renderSection();
      return;
    }
    const disc = e.target.closest('[data-ev-disc]');
    if(disc){
      activeDisc = disc.dataset.evDisc;
      document.querySelectorAll('#eventsDisc button').forEach(b => b.classList.toggle('active', b === disc));
      renderUpcoming();
      return;
    }
    const reg = e.target.closest('[data-ev-register]');
    if(reg && currentEvent){ openRegister(currentEvent); return; }
    const can = e.target.closest('[data-ev-cancel]');
    if(can && currentEvent){ doCancel(currentEvent); return; }
    const att = e.target.closest('[data-ev-attendlist]');
    if(att && currentEvent){ openAttendList(currentEvent); return; }
    const rk = e.target.closest('[data-rank-disc]');
    if(rk){ rankDisc = rk.dataset.rankDisc; renderRanking(); return; }
    const res = e.target.closest('[data-ev-results]');
    if(res && currentEvent){ openResults(currentEvent); return; }
    const edt = e.target.closest('[data-ev-edit]');
    if(edt && currentEvent){ openEdit(currentEvent); return; }
    const cev = e.target.closest('[data-ev-cancelev]');
    if(cev && currentEvent){ doCancelEvent(currentEvent); return; }
    if(e.target.closest('[data-open-modal]') || e.target.closest('[data-close-modal]')){ resetEditState(); }
    if(e.target.closest('#eventPlacePick')){ e.preventDefault(); openSpotPicker(); return; }
  });

  function watchView(){
    const v = document.querySelector('[data-view="events"]');
    if(!v) return;
    const load = async () => { await refreshState(); renderSection(); };
    if(v.classList.contains('active')) load();
    new MutationObserver(() => { if(v.classList.contains('active')) load(); }).observe(v, { attributes: true, attributeFilter: ['class'] });
  }

  function init(){
    renderHomeEvents();
    watchView();
    if(deepEvent) setTimeout(() => { if(window.setRoute && document.body.classList.contains('is-authed')) window.setRoute('events'); }, 1800);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SpotraEvents = { submitFromForm, renderHomeEvents, renderSpotEvents, openDetail };
})();
