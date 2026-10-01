/* SPOTRA · Panel de aprobaciones (admin)
   - Lee envíos reales de place_submissions (solo admin, por RLS)
   - Aprobar/Rechazar llaman a las funciones SQL approve_submission / reject_submission
   - Usuarios: lista real vía RPC admin_list_users (solo admin) + KPI de usuarios
   El control real de quién es admin está en la base (app_metadata.role + funciones SECURITY DEFINER). */
(function(){
  const PIN  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/></svg>';
  const USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
  const OK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 12l5 5L20 6"/></svg>';
  const NO   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function notify(msg){ (window.toast || function(m){ console.log('[SPOTRA]', m); })(msg); }

  /* Envia una push sin bloquear ni romper el flujo. to = profileId; sin to va a todos. */
  function push(title, body, to){
    try {
      if(!(window.SpotraBackend && window.SpotraBackend.sendPush)) return;
      const payload = { title: title, body: body || '', url: '/' };
      if(to) payload.profileIds = [to];
      Promise.resolve(window.SpotraBackend.sendPush(payload)).catch(function(){});
    } catch(err){ console.warn('[SPOTRA] push:', err); }
  }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function db(){
    if(window.SpotraBackend && window.SpotraBackend.getClient) return await window.SpotraBackend.getClient();
    return null;
  }

  async function isAdmin(){
    const client = await db(); if(!client) return false;
    const { data } = await client.auth.getSession();
    const session = data ? data.session : null;
    return !!(session && session.user && session.user.app_metadata && session.user.app_metadata.role === 'admin');
  }

  function view(){ return document.querySelector('[data-view="admin-approvals"]'); }

  function clearRows(v){
    v.querySelectorAll('.approve-row, .admin-note').forEach(el => el.remove());
  }

  function hasCoords(s){ return Number.isFinite(s.lat) && Number.isFinite(s.lng) && !(s.lat === 0 && s.lng === 0); }

  function rowHTML(s){
    const missing = !hasCoords(s);
    return `<div class="approve-row" data-sub-id="${esc(s.id)}" data-author="${esc(s.submittedBy || '')}" data-lat="${missing ? '' : s.lat}" data-lng="${missing ? '' : s.lng}">
      <div class="thumb" style="background-image:url('${esc(s.imageUrl)}')"></div>
      <div><div class="kind">${esc(s.label)}</div><div class="name">${esc(s.name)}</div>
        <div class="ln">${PIN}${esc(s.address)}</div>
        ${missing ? `<div class="ln loc-missing" style="color:#ff7a7a">Sin ubicación — tocá "Ubicar"</div>` : ``}
        <div class="ln">${USER}comunidad</div></div>
      <div class="col">
        <button class="loc-btn" style="background:transparent;border:1px solid var(--green-hot);color:var(--green-hot);border-radius:12px;padding:8px 12px;font-weight:700;cursor:pointer">Ubicar</button>
        <button class="ok-btn">${OK}Aprobar</button><button class="no-btn">${NO}Rechazar</button></div>
    </div>`;
  }

  function photoRowHTML(p){
    return `<div class="approve-row" data-photo-id="${esc(p.id)}" data-author="${esc(p.uploadedBy || '')}">
      <div class="thumb" style="background-image:url('${esc(p.url)}')"></div>
      <div><div class="kind">Foto</div><div class="name">${esc(p.placeName)}</div>
        <div class="ln">${PIN}Imagen enviada para este lugar</div>
        <div class="ln">${USER}comunidad</div></div>
      <div class="col"><button class="ok-btn">${OK}Aprobar</button><button class="no-btn">${NO}Rechazar</button></div>
    </div>`;
  }

  const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/></svg>';

  function fmtEventDate(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + hh + ':' + mm;
  }

  function eventRowHTML(ev){
    return `<div class="approve-row" data-event-id="${esc(ev.id)}" data-author="${esc(ev.organizerId || '')}" data-place="${esc(ev.placeName || '')}">
      <div class="thumb" style="display:grid;place-items:center;color:var(--green-hot)">${CAL}</div>
      <div><div class="kind">Evento</div><div class="name">${esc(ev.title)}</div>
        <div class="ln">${PIN}${esc(ev.placeName || 'Spot')}${ev.placeCity ? ' · ' + esc(ev.placeCity) : ''}</div>
        <div class="ln">${CAL}${esc(fmtEventDate(ev.startsAt))}${ev.discipline && ev.discipline !== 'todas' ? ' · ' + esc(ev.discipline.toUpperCase()) : ''}</div>
        ${ev.description ? `<div class="ln">${esc(ev.description)}</div>` : ``}
        <div class="ln">${USER}comunidad</div></div>
      <div class="col"><button class="ok-btn">${OK}Aprobar</button><button class="no-btn">${NO}Rechazar</button></div>
    </div>`;
  }

  const TAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l8-8 8 8-8 8-8-8Z"/></svg>';

  function listingRowHTML(l){
    const cur = { UYU: '$U', USD: 'US$', ARS: 'AR$', BRL: 'R$' }[l.currency] || l.currency;
    return `<div class="approve-row" data-listing-id="${esc(l.id)}" data-author="${esc(l.sellerId || '')}">
      <div class="thumb" style="background-image:url('${esc(l.photos && l.photos[0] || '')}')"></div>
      <div><div class="kind">Producto</div><div class="name">${esc(l.title)}</div>
        <div class="ln">${TAG}${esc(cur)} ${esc(String(l.price))} · ${esc(l.category)} · ${esc(l.condition)}</div>
        <div class="ln">${PIN}${esc(l.city || 'Sin ciudad')}</div>
        ${l.description ? `<div class="ln">${esc(l.description)}</div>` : ``}
        <div class="ln">${USER}${esc(l.username || 'rider')}</div></div>
      <div class="col"><button class="ok-btn">${OK}Aprobar</button><button class="no-btn">${NO}Rechazar</button></div>
    </div>`;
  }

  function noteHTML(text){
    return `<div class="admin-note panel" style="margin-top:14px;color:var(--muted)">${esc(text)}</div>`;
  }

  function setCount(v, n){
    const chip = v.querySelector('.count-chip');
    if(chip) chip.textContent = n;
    const kpis = v.querySelectorAll('.kpi .num');
    if(kpis[1]) kpis[1].textContent = n;
  }

  /* ---- Enviar aviso a todos (manual) ---- */
  function ensureBroadcast(v){
    if(document.getElementById('admBroadcast')) return;
    const box = document.createElement('div');
    box.id = 'admBroadcast';
    box.style.cssText = 'margin-top:26px;padding:18px;border:1px solid rgba(116,255,58,.28);border-radius:20px;background:rgba(8,12,9,.7)';
    box.innerHTML = '<b style="display:block;color:#fff;font-family:var(--display);font-size:20px;margin-bottom:4px">Enviar aviso a todos</b>' +
      '<div style="color:var(--muted);font-size:13px;margin-bottom:14px">Le llega a todos los riders con notificaciones activadas.</div>' +
      '<input id="admBcTitle" maxlength="60" placeholder="Titulo (ej. Nueva competencia)" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);border-radius:13px;padding:13px;color:#fff;font-size:15px;margin-bottom:10px">' +
      '<input id="admBcBody" maxlength="120" placeholder="Texto del aviso" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);border-radius:13px;padding:13px;color:#fff;font-size:15px;margin-bottom:12px">' +
      '<button id="admBcSend" style="width:100%;background:var(--green-hot);color:#06100a;border:0;border-radius:13px;padding:14px;font-weight:800;font-size:15px;cursor:pointer">Enviar a todos</button>';
    v.appendChild(box);
    document.getElementById('admBcSend').addEventListener('click', sendBroadcast);
  }

  async function sendBroadcast(){
    const t = document.getElementById('admBcTitle');
    const b = document.getElementById('admBcBody');
    const btn = document.getElementById('admBcSend');
    const title = (t.value || '').trim();
    if(!title){ notify('Escribi un titulo para el aviso.'); t.focus(); return; }
    if(!window.confirm('Se va a enviar a TODOS los riders suscriptos. Confirmas?')) return;
    btn.disabled = true; btn.textContent = 'Enviando...';
    let res = { ok: false };
    if(window.SpotraBackend && window.SpotraBackend.sendPush){
      res = await window.SpotraBackend.sendPush({ title: title, body: (b.value || '').trim(), url: '/' });
    }
    btn.disabled = false; btn.textContent = 'Enviar a todos';
    if(res && res.ok){
      t.value = ''; b.value = '';
      notify('Aviso enviado a ' + (res.sent || 0) + ' de ' + (res.total || 0) + ' dispositivos.');
    } else {
      notify('No se pudo enviar. ' + ((res && res.error) || 'Probá de nuevo.'));
    }
  }


  /* ============ USUARIOS (lista real, solo admin) ============ */
  const PAGE = 50;
  let usersCache = null, usersLoading = null, uFilter = 'todos', uQuery = '', uShown = PAGE;

  async function fetchUsers(force){
    if(usersCache && !force) return usersCache;
    if(usersLoading) return usersLoading;
    usersLoading = (async function(){
      const client = await db();
      if(!client) return null;
      const { data, error } = await client.rpc('admin_list_users');
      if(error){ console.warn('[SPOTRA] admin_list_users:', error); return null; }
      usersCache = data || [];
      return usersCache;
    })();
    try { return await usersLoading; } finally { usersLoading = null; }
  }

  function setUsersKpi(n){
    const v = view(); if(!v) return;
    const k = v.querySelectorAll('.kpi .num');
    if(k[0]) k[0].textContent = (n == null ? '–' : n);
  }

  function fmtShort(iso){
    if(!iso) return '';
    const d = new Date(iso); if(isNaN(d)) return '';
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getFullYear()).slice(-2);
  }

  function initials(u){
    const base = (u.full_name || u.username || u.email || '?').trim();
    const parts = base.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0] || '?')[0] + ((parts[1] || '')[0] || '')).toUpperCase();
  }

  function waLink(phone, cc){
    let d = String(phone || '').replace(/\D/g, '');
    if(d.length < 6) return '';
    const pre = { UY:'598', AR:'54', BR:'55', CL:'56', PY:'595', MX:'52', CO:'57', PE:'51' }[String(cc || 'UY').toUpperCase()] || '';
    if(pre && !d.startsWith(pre)){ d = d.replace(/^0+/, ''); d = pre + d; }
    return 'https://wa.me/' + d;
  }

  function igText(v){
    if(!v) return '';
    const m = String(v).match(/instagram\.com\/([^/?#]+)/i);
    return '@' + (m ? m[1] : String(v).replace(/^@/, ''));
  }

  function userRowHTML(u){
    const isAdm = u.account_type === 'admin';
    const sub = [u.username ? '@' + u.username : '', (u.discipline || '').toLowerCase(), fmtShort(u.created_at)].filter(Boolean).join(' · ');
    const wa = waLink(u.phone, u.country_code);
    const place = [u.city, u.phone].filter(Boolean).join(' · ');
    const ig = igText(u.instagram);
    const btn = 'flex:1;text-align:center;padding:9px;border-radius:10px;border:1px solid rgba(255,255,255,.14);color:#fff;font-weight:700;font-size:13px;text-decoration:none';
    return `<div class="adm-user" data-uid="${esc(u.id)}" style="border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);padding:11px 12px;margin-bottom:8px;cursor:pointer">
      <div style="display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:11px;align-items:center">
        <div style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-weight:800;border:1px solid ${isAdm ? 'rgba(116,255,58,.5)' : 'rgba(255,255,255,.14)'};color:${isAdm ? 'var(--green-hot)' : 'var(--muted)'}">${esc(initials(u))}</div>
        <div style="min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.full_name || u.email || 'Sin nombre')}</div>
          <div style="color:var(--muted);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div></div>
        <div>${isAdm ? '<span class="badge green">Admin</span>' : (!u.has_profile ? '<span class="badge warn">Sin perfil</span>' : '')}</div>
      </div>
      <div class="adm-user-more" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);color:var(--muted);font-size:13px;line-height:1.8">
        <div>${esc(u.email || 'Sin email')}</div>
        ${place ? `<div>${esc(place)}</div>` : ''}
        ${ig ? `<div>Instagram: ${esc(ig)}</div>` : ''}
        <div>Último ingreso: ${esc(fmtShort(u.last_sign_in_at) || 'nunca')}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener" style="${btn}">WhatsApp</a>` : ''}
          ${u.email ? `<a href="mailto:${esc(u.email)}" style="${btn}">Email</a>` : ''}
        </div>
      </div>
    </div>`;
  }

  function usersView(){ return document.querySelector('[data-view="admin-users"]'); }

  function filtered(){
    const q = uQuery.trim().toLowerCase();
    return (usersCache || []).filter(u => {
      if(uFilter !== 'todos' && !String(u.discipline || '').toLowerCase().includes(uFilter)) return false;
      if(!q) return true;
      return [u.full_name, u.username, u.email].some(x => String(x || '').toLowerCase().includes(q));
    });
  }

  function renderUsersList(){
    const box = document.getElementById('admUsersList');
    if(!box) return;
    const list = filtered();
    if(!list.length){ box.innerHTML = noteHTML(usersCache && usersCache.length ? 'No hay usuarios con ese filtro.' : 'Todavía no hay usuarios registrados.'); return; }
    const shown = list.slice(0, uShown);
    box.innerHTML = shown.map(userRowHTML).join('') +
      `<div style="text-align:center;color:var(--muted);font-size:12.5px;margin-top:10px">Mostrando ${shown.length} de ${list.length}</div>` +
      (list.length > shown.length ? `<button id="admUsersMore" style="display:block;margin:10px auto 0;background:transparent;border:1px solid var(--green-hot);color:var(--green-hot);border-radius:12px;padding:10px 18px;font-weight:800;cursor:pointer">Ver más</button>` : '');
  }

  function chipCss(on){
    return 'padding:7px 13px;border-radius:999px;font-weight:700;font-size:12.5px;cursor:pointer;' + (on
      ? 'background:rgba(46,232,77,.12);border:1px solid rgba(116,255,58,.5);color:var(--green-hot)'
      : 'background:transparent;border:1px solid rgba(255,255,255,.14);color:var(--muted)');
  }

  function ensureUsersUI(v){
    if(document.getElementById('admUsers')) return;
    v.querySelectorAll('.admin-note').forEach(el => el.remove());
    const head = v.querySelector('.section-head');
    if(head && !document.getElementById('admUsersCount')){
      head.style.display = 'flex'; head.style.justifyContent = 'space-between'; head.style.alignItems = 'baseline';
      head.insertAdjacentHTML('beforeend', '<span id="admUsersCount" style="color:var(--green-hot);font-weight:800;font-size:14px"></span>');
    }
    const wrap = document.createElement('div');
    wrap.id = 'admUsers';
    wrap.style.marginTop = '12px';
    const chips = [['todos','Todos'],['skate','Skate'],['bmx','BMX'],['rollers','Rollers']];
    wrap.innerHTML = '<input id="admUsersSearch" type="search" placeholder="Buscar nombre, @usuario o email" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px 14px;color:#fff;font-size:15px;margin-bottom:10px">' +
      '<div id="admUsersChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">' +
      chips.map(c => `<button data-ufilter="${c[0]}" style="${chipCss(c[0] === uFilter)}">${c[1]}</button>`).join('') + '</div>' +
      '<div id="admUsersList"></div>';
    v.appendChild(wrap);

    document.getElementById('admUsersSearch').addEventListener('input', e => { uQuery = e.target.value || ''; uShown = PAGE; renderUsersList(); });
    wrap.addEventListener('click', e => {
      const chip = e.target.closest('[data-ufilter]');
      if(chip){
        uFilter = chip.dataset.ufilter; uShown = PAGE;
        wrap.querySelectorAll('[data-ufilter]').forEach(b => b.style.cssText = chipCss(b.dataset.ufilter === uFilter));
        renderUsersList(); return;
      }
      if(e.target.closest('#admUsersMore')){ uShown += PAGE; renderUsersList(); return; }
      if(e.target.closest('a')) return;
      const row = e.target.closest('.adm-user');
      if(row){
        const more = row.querySelector('.adm-user-more');
        const open = more.style.display !== 'none';
        more.style.display = open ? 'none' : 'block';
        row.style.borderColor = open ? 'rgba(255,255,255,.08)' : 'rgba(116,255,58,.35)';
      }
    });
  }

  let usersBusy = false;
  async function loadUsers(){
    const v = usersView();
    if(!v || usersBusy) return;
    usersBusy = true;
    try {
      if(!(await isAdmin())){
        v.querySelectorAll('.admin-note').forEach(el => el.remove());
        const old = document.getElementById('admUsers'); if(old) old.remove();
        v.insertAdjacentHTML('beforeend', noteHTML('Este panel es solo para administradores.'));
        return;
      }
      ensureUsersUI(v);
      const box = document.getElementById('admUsersList');
      if(box && !usersCache) box.innerHTML = noteHTML('Cargando usuarios...');
      const list = await fetchUsers(true);
      if(!list){ if(box) box.innerHTML = noteHTML('No se pudo cargar la lista. Probá de nuevo.'); return; }
      const c = document.getElementById('admUsersCount');
      if(c) c.textContent = list.length + (list.length === 1 ? ' registrado' : ' registrados');
      setUsersKpi(list.length);
      renderUsersList();
    } finally {
      usersBusy = false;
    }
  }

  let loading = false;
  async function loadApprovals(){
    const v = view();
    if(!v || loading) return;
    loading = true;
    try {
      const subTabs = v.querySelector('.sub-tabs');
      clearRows(v);

      if(!(await isAdmin())){
        if(subTabs) subTabs.insertAdjacentHTML('afterend', noteHTML('Este panel es solo para administradores. Iniciá sesión con una cuenta admin.'));
        setCount(v, 0);
        return;
      }

      fetchUsers(true).then(list => { if(list) setUsersKpi(list.length); }).catch(function(){});
      const subs = (window.SpotraBackend ? await window.SpotraBackend.listSubmissions() : []) || [];
      const photos = (window.SpotraBackend ? await window.SpotraBackend.listPendingPhotos() : []) || [];
      const events = (window.SpotraBackend && window.SpotraBackend.listPendingEvents ? await window.SpotraBackend.listPendingEvents() : []) || [];
      const listings = (window.SpotraBackend && window.SpotraBackend.listPendingListings ? await window.SpotraBackend.listPendingListings() : []) || [];
      const kpis = v.querySelectorAll('.kpi .num');
      if(kpis[2]) kpis[2].textContent = events.length;
      if(kpis[3]) kpis[3].textContent = listings.length;
      const total = subs.length + photos.length + events.length + listings.length;
      if(!total){
        if(subTabs) subTabs.insertAdjacentHTML('afterend', noteHTML('No hay envíos pendientes por ahora.'));
        setCount(v, 0);
        ensureBroadcast(v);
        return;
      }
      if(subTabs) subTabs.insertAdjacentHTML('afterend', subs.map(rowHTML).join('') + events.map(eventRowHTML).join('') + listings.map(listingRowHTML).join('') + photos.map(photoRowHTML).join(''));
      setCount(v, total);
      ensureBroadcast(v);
    } finally {
      loading = false;
    }
  }

  async function handleReview(row, decision){
    const photoId = row.dataset.photoId;
    const subId = row.dataset.subId;
    const eventId = row.dataset.eventId;
    const listingId = row.dataset.listingId;
    if(subId && decision === 'approved' && (!row.dataset.lat || !row.dataset.lng)){
      notify('Marcá la ubicación con "Ubicar" antes de aprobar este spot.');
      return;
    }
    const name = (row.querySelector('.name') || {}).textContent || 'Elemento';
    row.querySelectorAll('button').forEach(b => b.disabled = true);

    let result = { ok: false };
    if(window.SpotraBackend){
      if(listingId) result = await window.SpotraBackend.reviewListing(listingId, decision);
      else if(eventId) result = await window.SpotraBackend.reviewEvent(eventId, decision);
      else if(photoId) result = await window.SpotraBackend.reviewPhoto(photoId, decision);
      else result = await window.SpotraBackend.reviewSubmission(subId, decision);
    }

    if(!result.ok){
      row.querySelectorAll('button').forEach(b => b.disabled = false);
      notify('No se pudo procesar. ' + (result.error || 'Probá de nuevo.'));
      return;
    }

    row.style.maxHeight = row.offsetHeight + 'px';
    requestAnimationFrame(() => row.classList.add('row-leave'));
    setTimeout(() => row.remove(), 420);

    const v = view();
    if(v){
      const chip = v.querySelector('.count-chip');
      const n = Math.max(0, (parseInt((chip && chip.textContent) || '0', 10) || 0) - 1);
      setCount(v, n);
    }
    /* --- notificaciones automaticas --- */
    const author = row.dataset.author || '';
    const clean = name.trim();
    if(decision === 'approved'){
      if(listingId){ if(author) push('Tu publicacion ya esta en el Market', clean, author); }
      else if(eventId){
        const place = row.dataset.place || '';
        push('Nuevo evento en SPOTRA', clean + (place ? ' · ' + place : ''));
      }
      else if(photoId){ if(author) push('Tu foto ya se ve en el spot', clean, author); }
      else if(author){ push('Tu spot ya esta en el mapa', clean, author); }
    } else if(author){
      if(listingId) push('Tu publicacion no fue aprobada', clean + ' — revisa las fotos y la descripcion.', author);
      else if(eventId) push('Tu evento no fue aprobado', clean + ' — escribinos si queres saber por que.', author);
      else if(!photoId) push('Tu spot no fue aprobado', clean + ' — revisa la info y la ubicacion.', author);
    }

    const what = listingId ? 'Producto' : eventId ? 'Evento' : photoId ? 'Foto' : 'Lugar';
    notify(decision === 'approved'
      ? `${what} de "${name.trim()}" aprobado.`
      : `${what} de "${name.trim()}" rechazado.`);
  }

  /* ---- Overlay para marcar/corregir la ubicación de un envío ---- */
  const LOC_DARK = [
    { elementType:'geometry', stylers:[{color:'#0c1014'}] },
    { elementType:'labels.text.fill', stylers:[{color:'#5b6b63'}] },
    { elementType:'labels.text.stroke', stylers:[{color:'#0c1014'}] },
    { featureType:'road', elementType:'geometry', stylers:[{color:'#1a2420'}] },
    { featureType:'water', elementType:'geometry', stylers:[{color:'#0a1f16'}] },
    { featureType:'poi', stylers:[{visibility:'off'}] }
  ];
  let locMap, locMarker, locSubId = null, locLat = null, locLng = null;
  function setLoc(lat, lng){ locLat = lat; locLng = lng; }
  function closeLoc(){ const o = document.getElementById('admLocOverlay'); if(o) o.style.display = 'none'; }

  function ensureOverlay(){
    if(document.getElementById('admLocOverlay')) return;
    const o = document.createElement('div');
    o.id = 'admLocOverlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;padding:18px';
    o.innerHTML = `<div style="width:min(560px,95vw);background:#0c1014;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
        <b style="color:#fff;font-size:16px">Marcá la ubicación del spot</b>
        <button id="admLocUse" style="background:var(--green-hot);color:#06100a;border:0;border-radius:999px;padding:9px 14px;font-weight:800;cursor:pointer">Usar mi ubicación</button>
      </div>
      <div id="admLocMap" style="height:340px;border-radius:14px;overflow:hidden;background:#0c1014"></div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button id="admLocCancel" style="flex:1;background:transparent;border:1px solid rgba(255,255,255,.18);color:#dce3dd;border-radius:12px;padding:12px;font-weight:700;cursor:pointer">Cancelar</button>
        <button id="admLocSave" style="flex:2;background:var(--green-hot);color:#06100a;border:0;border-radius:12px;padding:12px;font-weight:800;cursor:pointer">Guardar ubicación</button>
      </div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click', (e) => { if(e.target === o) closeLoc(); });
    document.getElementById('admLocCancel').addEventListener('click', closeLoc);
    document.getElementById('admLocUse').addEventListener('click', useMyLoc);
    document.getElementById('admLocSave').addEventListener('click', saveLoc);
  }

  async function openLoc(subId, lat, lng){
    ensureOverlay();
    locSubId = subId;
    document.getElementById('admLocOverlay').style.display = 'flex';
    const ready = window.SpotraMaps && window.SpotraMaps.ensureApi ? await window.SpotraMaps.ensureApi() : !!(window.google && window.google.maps);
    const el = document.getElementById('admLocMap');
    if(!ready){ el.innerHTML = '<div style="padding:18px;color:#9aa6a0">No se pudo cargar el mapa.</div>'; return; }
    const has = Number.isFinite(lat) && Number.isFinite(lng);
    const center = has ? { lat, lng } : { lat:-34.9011, lng:-56.1645 };
    if(!locMap){
      locMap = new google.maps.Map(el, { center, zoom: has ? 16 : 13, disableDefaultUI:true, zoomControl:true, gestureHandling:'greedy', clickableIcons:false, styles: LOC_DARK });
      locMarker = new google.maps.Marker({ position:center, map:locMap, draggable:true });
      locMarker.addListener('dragend', () => { const p = locMarker.getPosition(); setLoc(p.lat(), p.lng()); });
      locMap.addListener('click', (e) => { locMarker.setPosition(e.latLng); setLoc(e.latLng.lat(), e.latLng.lng()); });
    } else {
      locMap.setCenter(center); locMap.setZoom(has ? 16 : 13); locMarker.setPosition(center);
    }
    setLoc(center.lat, center.lng);
    setTimeout(() => { google.maps.event.trigger(locMap, 'resize'); locMap.setCenter(center); }, 250);
  }

  function useMyLoc(){
    if(!navigator.geolocation){ notify('Tu dispositivo no permite ubicación.'); return; }
    notify('Buscando tu ubicación...');
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = { lat:pos.coords.latitude, lng:pos.coords.longitude };
      if(locMap && locMarker){ locMap.setCenter(ll); locMap.setZoom(16); locMarker.setPosition(ll); setLoc(ll.lat, ll.lng); }
    }, () => notify('No pudimos obtener tu ubicación. Marcá el punto tocando el mapa.'), { enableHighAccuracy:true, timeout:9000 });
  }

  async function saveLoc(){
    if(locSubId == null || locLat == null || locLng == null){ notify('Marcá un punto en el mapa.'); return; }
    const btn = document.getElementById('admLocSave'); btn.disabled = true; btn.textContent = 'Guardando...';
    const res = window.SpotraBackend ? await window.SpotraBackend.setSubmissionLocation(locSubId, locLat, locLng) : { ok:false };
    btn.disabled = false; btn.textContent = 'Guardar ubicación';
    if(!res.ok){ notify('No se pudo guardar. ' + (res.error || '')); return; }
    const sel = (window.CSS && CSS.escape) ? CSS.escape(locSubId) : locSubId;
    const row = document.querySelector('.approve-row[data-sub-id="' + sel + '"]');
    if(row){ row.dataset.lat = locLat; row.dataset.lng = locLng; const m = row.querySelector('.loc-missing'); if(m) m.remove(); }
    notify('Ubicación guardada. Ya podés aprobar el spot.');
    closeLoc();
  }

  /* Intercepta Ubicar / Aprobar / Rechazar ANTES del handler legacy */
  document.addEventListener('click', function(e){
    const row = e.target.closest('.approve-row[data-sub-id], .approve-row[data-photo-id], .approve-row[data-event-id], .approve-row[data-listing-id]');
    if(!row) return;
    const loc = e.target.closest('.loc-btn');
    if(loc){
      e.preventDefault(); e.stopImmediatePropagation();
      const lat = parseFloat(row.dataset.lat), lng = parseFloat(row.dataset.lng);
      openLoc(row.dataset.subId, Number.isFinite(lat) ? lat : undefined, Number.isFinite(lng) ? lng : undefined);
      return;
    }
    const ok = e.target.closest('.ok-btn');
    const no = e.target.closest('.no-btn');
    if(!ok && !no) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    handleReview(row, ok ? 'approved' : 'rejected');
  }, true);

  /* Carga cuando la vista admin se vuelve activa (por click, login o back/forward) */
  function watchView(){
    const v = view();
    if(!v) return;
    if(v.classList.contains('active')) loadApprovals();
    new MutationObserver(() => {
      if(v.classList.contains('active')) loadApprovals();
    }).observe(v, { attributes: true, attributeFilter: ['class'] });
  }
  function watchUsers(){
    const v = usersView();
    if(!v) return;
    if(v.classList.contains('active')) loadUsers();
    new MutationObserver(() => {
      if(v.classList.contains('active')) loadUsers();
    }).observe(v, { attributes: true, attributeFilter: ['class'] });
  }
  function boot(){ watchView(); watchUsers(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SpotraAdmin = { loadApprovals, loadUsers };
})();
