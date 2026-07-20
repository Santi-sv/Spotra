/* SPOTRA · Eventos (v2)
   - Sección Eventos: Próximos / Mis eventos, filtro por disciplina, detalle con inscripción.
   - Inscripción con categorías (multi), cupo, cierre, contacto del organizador.
   - Organizador: estado de sus eventos + lista de inscriptos por categoría.
   - Crear evento: elegir spot en el mapa (overlay con buscador) + campos de competencia.
   - Muestra eventos aprobados en Inicio y en la ficha del spot del mapa. */
(function(){
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DISC_LABEL = { todas: '', skate: 'Skate', bmx: 'BMX', rollers: 'Rollers' };
  const STATUS_LABEL = { pending: 'Pendiente de aprobación', approved: 'Aprobado', rejected: 'Rechazado', archived: 'Archivado' };

  let uid = null;
  let myRegs = {};            /* eventId -> [categorias] */
  let upcomingCache = [];
  let activeTab = 'upcoming';
  let activeDisc = 'all';
  let currentEvent = null;
  let pickedPlace = null;

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
  }

  async function renderSection(){
    const wrap = listEl();
    if(!wrap) return;
    showList();
    if(activeTab === 'upcoming') await renderUpcoming();
    else await renderMine();
  }

  async function renderUpcoming(){
    const wrap = listEl();
    if(!wrap || !B()) return;
    wrap.innerHTML = '<div class="meta" style="margin-top:14px">Cargando eventos...</div>';
    upcomingCache = await B().listEvents({ limit: 50 });
    const list = upcomingCache.filter(ev => activeDisc === 'all' || ev.discipline === activeDisc || ev.discipline === 'todas');
    if(!list.length){
      wrap.innerHTML = '<div class="meta" style="margin-top:14px">No hay eventos próximos' + (activeDisc !== 'all' ? ' de esa disciplina' : '') + '. Creá el primero desde el botón +.</div>';
      return;
    }
    wrap.innerHTML = list.map(ev => cardHTML(ev)).join('');
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
      mine.forEach(ev => { organizedIds[ev.id] = true; parts.push(cardHTML(ev, { showStatus: true })); });
    }
    const regOnly = regs.filter(r => !organizedIds[r.event.id]);
    if(regOnly.length){
      parts.push('<div class="kicker" style="font-size:10px;margin-top:16px">Inscripto</div>');
      regOnly.forEach(r => parts.push(cardHTML(r.event, { myCategories: r.myCategories })));
    }
    wrap.innerHTML = parts.length ? parts.join('') : '<div class="meta" style="margin-top:14px">Todavía no tenés eventos: inscribite a uno o creá el tuyo desde el +.</div>';
  }

  function showList(){
    const d = detailEl(); if(d){ d.style.display = 'none'; d.innerHTML = ''; }
    const l = listEl(); if(l) l.style.display = '';
    const tabs = document.getElementById('eventsTabs'); if(tabs) tabs.style.display = '';
    const disc = document.getElementById('eventsDisc'); if(disc) disc.style.display = activeTab === 'upcoming' ? '' : 'none';
    currentEvent = null;
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
    d.style.display = '';
    d.innerHTML = detailHTML(ev);
    renderAttendees(ev);
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
      action = `<button class="primary-btn" data-ev-attendlist="${esc(ev.id)}" style="width:100%;min-height:52px;margin-top:14px">Ver inscriptos (${ev.regCount})</button>`;
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
    if(dirUrl) btns.push(`<a class="ghost-btn" href="${esc(dirUrl)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Cómo llegar</a>`);
    if(wa) btns.push(`<a class="ghost-btn" href="${esc(wa)}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Contactar</a>`);

    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;cursor:pointer" data-ev-back>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;color:var(--muted)"><path d="M15 6l-6 6 6 6"/></svg>
        <span class="meta">Volver a eventos</span></div>
      <div class="cover" style="height:150px;border-radius:18px;background:url('${esc(ev.imageUrl || 'assets/banners/banner-skatepark-4.webp')}') center/cover;border:1px solid rgba(255,255,255,.1)"></div>
      <div class="ev-chips" style="margin-top:12px">${chips.join('')}</div>
      <h2 style="font-family:var(--display);font-size:27px;margin-top:8px">${esc(ev.title)}</h2>
      ${rows.join('')}
      ${cats}
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

  /* ================= Crear evento ================= */
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
    const btn = document.querySelector('[data-submit="event"]');
    if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }
    const result = B() ? await B().createEvent(payload) : { ok: false };
    if(btn){ btn.disabled = false; btn.textContent = 'Enviar a aprobación'; }
    if(!result.ok){
      toast(result.error === 'auth' ? 'Iniciá sesión para crear un evento.' : 'No se pudo enviar el evento. Probá de nuevo.');
      return;
    }
    if(typeof window.resetForm === 'function') window.resetForm('eventForm');
    const idInput = document.getElementById('eventPlaceId'); if(idInput) idInput.value = '';
    const label = document.getElementById('eventPlaceLabel'); if(label){ label.textContent = 'Elegir spot en el mapa'; label.style.color = 'var(--muted)'; }
    const rain = document.getElementById('eventRain'); if(rain) rain.checked = false;
    document.querySelectorAll('[data-seg="eventDiscipline"] button').forEach((b, i) => b.classList.toggle('active', i === 0));
    pickedPlace = null;
    if(typeof window.closeModal === 'function') window.closeModal();
    toast('Evento enviado. Queda pendiente de aprobación.');
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
    if(e.target.closest('[data-ev-back]')){ renderSection(); return; }
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
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SpotraEvents = { submitFromForm, renderHomeEvents, renderSpotEvents, openDetail };
})();
