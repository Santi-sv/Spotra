/* SPOTRA · lógica principal de la app (rutas, modales, toasts, etc.)
   (13/10/2026: antes estaba escrito dentro de index.html; se pasó a archivo para poder activar la protección CSP, que bloquea todo código escrito dentro del HTML) */
/* logo de pincel: si carga, se oculta el logo de texto; si falla, se oculta la imagen (antes eran onload/onerror en el HTML) */
document.querySelectorAll('img[data-brush-logo]').forEach(img => {
  const ok = () => { const p = img.parentElement; if(!p) return; const a = p.querySelector('.logo-type'), b = p.querySelector('.tm'); if(a) a.style.display = 'none'; if(b) b.style.display = 'none'; };
  const bad = () => { img.style.display = 'none'; };
  if(img.complete){ if(img.naturalWidth) ok(); else bad(); }
  else { img.addEventListener('load', ok, { once:true }); img.addEventListener('error', bad, { once:true }); }
});

const routes = Array.from(document.querySelectorAll('[data-view]')).map(view => view.dataset.view);
const ROLE_HOME = { rider:'map', brand:'brand-home', admin:'admin-approvals' };

function roleOf(route){
  if(route === 'scout' || route === 'applications' || route.startsWith('brand-')) return 'brand';
  if(route.startsWith('admin-')) return 'admin';
  return 'rider';
}

function setRole(role, route){
  document.body.dataset.role = role;
  document.querySelectorAll('.role-switch button').forEach(b => b.classList.toggle('active', b.dataset.roleSet === role));
  setRoute(route || ROLE_HOME[role]);
}

function setRoute(route, push = true){
  if(route === 'home') route = 'map'; // el inicio ahora es el mapa
  let target = routes.includes(route) ? route : 'login';
  // las vistas de admin solo se abren con rol admin real (verificado por Supabase)
  if(target.startsWith('admin-') && document.body.dataset.authReady === '1'
     && document.body.dataset.isAdmin !== '1') target = 'map';
  document.body.classList.toggle('auth-mode', target === 'login' || target === 'signup');
  document.body.classList.toggle('signup-mode', target === 'signup');
  document.body.classList.toggle('map-mode', target === 'map');
  const role = roleOf(target);
  document.body.dataset.role = role;
  document.querySelectorAll('.role-switch button').forEach(b => b.classList.toggle('active', b.dataset.roleSet === role));
  document.querySelectorAll('[data-view]').forEach(view => {
    view.classList.toggle('active', view.dataset.view === target);
  });
  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === target);
  });
  if(push) history.pushState(null, '', `#${target}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if(target === 'map' && window.SpotraMaps) window.SpotraMaps.init();
}

/* ===== Toast ===== */
/* Compartir: menú del celular (WhatsApp, Instagram...) o copia el link */
async function spotraShare(o){
  const url = o.url || location.origin + '/';
  try {
    if(navigator.share){ await navigator.share({ title: o.title || 'SPOTRA', text: o.text || '', url }); return; }
  } catch(e){ if(e && e.name === 'AbortError') return; }
  const full = (o.text ? o.text + ' ' : '') + url;
  try { await navigator.clipboard.writeText(full); toast('Link copiado. Pegalo donde quieras.'); }
  catch(e){ window.open('https://wa.me/?text=' + encodeURIComponent(full), '_blank', 'noopener'); }
}
function spotraPlaceUrl(id){ return location.origin + '/?place=' + encodeURIComponent(id) + '#map'; }

function toast(msg){
  const zone = document.getElementById('toastZone');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12l5 5L20 6"/></svg><span></span>`;
  t.querySelector('span').textContent = msg;
  zone.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 320); }, 2600);
}
function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function storedUserName(){
  try { return localStorage.getItem('spotraUserName') || 'Santiago'; }
  catch { return 'Santiago'; }
}
function setUserName(value){
  const first = String(value || 'Santiago').trim().split(/\s+/)[0] || 'Santiago';
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = first; });
  document.querySelectorAll('[data-user-initial]').forEach(el => { el.textContent = first.charAt(0).toUpperCase(); });
  return first;
}
setUserName(storedUserName());

/* ===== Notificaciones ===== */
const notifBtn = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');
notifBtn.addEventListener('click', e => {
  e.stopPropagation();
  const open = notifPanel.classList.toggle('open');
  notifBtn.setAttribute('aria-expanded', open);
  if(open){ const d = document.getElementById('notifDot'); if(d) d.remove(); }
});
document.addEventListener('click', e => {
  if(!e.target.closest('.notif-wrap')) notifPanel.classList.remove('open');
});

/* ===== Contadores: animar números ===== */
function bumpCounter(el, delta){
  if(!el) return;
  const raw = el.textContent.replace(/\./g,'');
  const n = parseInt(raw, 10);
  if(isNaN(n)) return;
  el.textContent = (n + delta).toLocaleString('es-AR');
  el.classList.add('like-pop');
  setTimeout(()=>el.classList.remove('like-pop'), 380);
}


/* ===== Filtros genéricos ===== */
function applyFilter(targetId, f){
  const wrap = document.getElementById(targetId); if(!wrap) return;
  let visible = 0;
  wrap.querySelectorAll('[data-cat]').forEach(item => {
    const show = f === 'all'
      || item.dataset.cat.split(' ').includes(f)
      || (f === 's90' && parseInt(item.dataset.score||0,10) >= 90);
    item.classList.toggle('hide-f', !show);
    if(show) visible++;
  });
  const empty = wrap.querySelector('[data-empty]') || document.querySelector(`[data-empty="${targetId}"]`);
  if(empty) empty.classList.toggle('show', visible === 0);
}

/* ===== Búsqueda en scout ===== */
const scoutSearch = document.getElementById('scoutSearch');
if(scoutSearch){
  scoutSearch.addEventListener('input', () => {
    const q = scoutSearch.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('#scoutList [data-name]').forEach(row => {
      const show = !q || row.dataset.name.includes(q);
      row.classList.toggle('hide-f', !show);
      if(show) visible++;
    });
    const empty = document.querySelector('[data-empty="scoutList"]');
    if(empty) empty.classList.toggle('show', visible === 0);
  });
}

/* ===== Click global ===== */
document.addEventListener('click', event => {
  /* selector de rol */
  const role = event.target.closest('[data-role-set]');
  if(role){ event.preventDefault(); setRole(role.dataset.roleSet); return; }


  const mapFilter = event.target.closest('[data-map-filter]');
  if(mapFilter){
    const f = mapFilter.dataset.mapFilter;
    if(f === 'event'){ setRoute('events'); return; }
    mapFilter.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    mapFilter.classList.add('active');
    if(window.SpotraMaps) window.SpotraMaps.setFilter(f);
    return;
  }

  /* like */
  const like = event.target.closest('[data-like]');
  if(like){
    const span = like.querySelector('span');
    const liked = like.classList.toggle('liked');
    bumpCounter(span, liked ? 1 : -1);
    like.classList.add('like-pop');
    setTimeout(()=>like.classList.remove('like-pop'), 380);
    return;
  }

  /* postularme */
  const apply = event.target.closest('[data-apply]');
  if(apply){
    apply.textContent = 'Postulación enviada';
    apply.disabled = true;
    apply.style.opacity = .65;
    toast('Tu SPOTRA ID fue enviado a Nómada Skate Co.');
    return;
  }

  /* aceptar postulación (marca) */
  const accept = event.target.closest('.btn-accept');
  if(accept){
    const row = accept.closest('.rider-row');
    const name = row.querySelector('.who b').textContent.trim();
    row.style.maxHeight = row.offsetHeight + 'px';
    requestAnimationFrame(()=> row.classList.add('row-leave'));
    setTimeout(()=> row.remove(), 420);
    bumpCounter(document.querySelector('[data-view="applications"] .count-chip'), -1);
    toast(`${name} sumado al team. Le llegó la notificación.`);
    return;
  }

  /* aprobar / rechazar (admin) */
  const ok = event.target.closest('.ok-btn');
  const no = event.target.closest('.no-btn');
  if(ok || no){
    const row = (ok||no).closest('.approve-row');
    if(row){
      const name = (row.querySelector('.name')||{}).textContent || 'Elemento';
      const kind = ((row.querySelector('.kind')||{}).textContent || '').trim().toLowerCase();
      row.style.maxHeight = row.offsetHeight + 'px';
      requestAnimationFrame(()=> row.classList.add('row-leave'));
      setTimeout(()=> row.remove(), 420);
      const view = row.closest('[data-view]');
      bumpCounter(view.querySelector('.count-chip'), -1);
      const kpis = document.querySelectorAll('[data-view="admin-approvals"] .kpi .num');
      if(kind === 'evento') bumpCounter(kpis[2], -1);
      else if(kind === 'skatepark' || kind === 'street spot' || kind === 'tienda') bumpCounter(kpis[1], -1);
      toast(ok ? `"${name.trim()}" aprobado. Ya es visible en la app.` : `"${name.trim()}" rechazado. Se notificó al autor.`);
      return;
    }
  }

  /* toast declarativo */
  const toastBtn = event.target.closest('[data-toast]');
  if(toastBtn){ toast(toastBtn.dataset.toast); return; }


  /* validación de formularios antes de navegar */
  const validate = event.target.closest('[data-validate]');
  if(validate){
    const form = document.getElementById(validate.dataset.validate);
    let bad = 0;
    form.querySelectorAll('input,select').forEach(inp => {
      const invalid = !inp.checkValidity();
      inp.closest('.field').classList.toggle('error', invalid);
      if(invalid) bad++;
    });
    if(bad){ event.preventDefault(); toast('Revisá los campos marcados en rojo.'); return; }
    if(validate.dataset.validate === 'signupForm'){
      const name = document.querySelector('#signupForm input[autocomplete="name"]')?.value || 'Santiago';
      try { localStorage.setItem('spotraUserName', name.trim()); } catch {}
      const first = setUserName(name);
      toast(`Cuenta creada. Bienvenido a SPOTRA, ${first}.`);
    } else {
      toast(`Bienvenido de vuelta, ${setUserName(storedUserName())}.`);
    }
  }

  /* navegación */
  const trigger = event.target.closest('[data-route]');
  if(!trigger) return;
  event.preventDefault();
  setRoute(trigger.dataset.route);
});

/* limpiar error al tipear */
document.addEventListener('input', e => {
  const field = e.target.closest('.field.error');
  if(field && e.target.checkValidity()) field.classList.remove('error');
});

/* ===== Tabs locales + filtros ===== */
document.querySelectorAll('.tabs button,.filter-row button,.type-card,.sub-tabs button,.country-chip,.discipline-card').forEach(button => {
  if(button.dataset.route) return;
  button.addEventListener('click', () => {
    const parent = button.parentElement;
    parent.querySelectorAll('button').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    if(button.classList.contains('country-chip')){
      const country = document.getElementById('signupCountry');
      if(country) country.value = button.dataset.country;
    }
    const group = button.closest('[data-filter-target]');
    if(group && button.dataset.f) applyFilter(group.dataset.filterTarget, button.dataset.f);
  });
});

/* ===== Modales de creación ===== */
const modalBg = document.getElementById('modalBg');
const MODAL_TITLES = { presence:'¿Mostrar dónde estás andando?', guardian:'Responsable', status:'Avisar estado', alerts:'Avisos de sesiones', follows:'Siguiendo', report:'Reportar', blocked:'Usuarios bloqueados', birth:'Tu fecha de nacimiento', session:'Crear sesión', adminSettings:'Ajustes de admin', menu:'Crear', spot:'Agregar spot', post:'Crear publicación', event:'Crear evento', product:'Publicar producto', settings:'Configuración', editProfile:'Editar perfil', editContact:'Editar contacto', password:'Cambiar contraseña', privacy:'Privacidad', deleteAccount:'Eliminar cuenta' };

/* 13/10/2026: lo que se abre desde Configuración muestra "‹ Volver" para regresar a Configuración */
let modalBackTo = null, modalBackArm = 0;
document.addEventListener('click', e => {
  if(e.target.closest('.modal-form.active[data-form="settings"] button')) modalBackArm = Date.now();
}, true);
function openModal(type){
  modalBackTo = (type !== 'settings' && Date.now() - modalBackArm < 1500) ? 'settings' : null;
  modalBackArm = 0;
  const mb = document.getElementById('modalBack');
  if(mb) mb.hidden = !modalBackTo;
  const md = modalBg.querySelector('.modal');
  if(md) md.scrollTop = 0;
  document.getElementById('modalTitle').textContent = MODAL_TITLES[type] || 'Crear';
  document.querySelectorAll('.modal-form').forEach(f => f.classList.toggle('active', f.dataset.form === type));
  modalBg.classList.add('open');
}
function closeModal(){ modalBg.classList.remove('open'); }

document.addEventListener('click', e => {
  const open = e.target.closest('[data-open-modal]');
  if(open){
    e.preventDefault();
    let type = open.dataset.openModal;
    const activeView = document.querySelector('.view.active')?.dataset.view;
    if(type === 'menu'){
      if(activeView === 'community' || activeView === 'profile') type = 'post';
      else if(activeView === 'market') type = 'product';
      else if(activeView === 'map') type = 'spot';
    }
    openModal(type);
    return;
  }
  if(e.target.closest('[data-modal-back]')){ e.preventDefault(); openModal(modalBackTo || 'settings'); return; }
  if(e.target.closest('[data-close-modal]') || e.target === modalBg){ closeModal(); return; }

  /* segmentos dentro del modal */
  const seg = e.target.closest('.seg button');
  if(seg){
    seg.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    seg.classList.add('active');
    return;
  }

  /* submit de formularios de creación */
  const submit = e.target.closest('[data-submit]');
  if(submit) handleCreate(submit.dataset.submit);
  const changePassword = e.target.closest('[data-change-password]');
  if(changePassword){
    if(!validateForm('passwordForm')) return;
    const current = document.getElementById('currentPassword');
    const next = document.getElementById('newPassword');
    const repeat = document.getElementById('repeatPassword');
    const mismatch = next.value !== repeat.value;
    repeat.closest('.field').classList.toggle('error', mismatch);
    if(mismatch){ toast('Las nuevas contraseñas no coinciden.'); return; }
    resetForm('passwordForm');
    closeModal();
    toast('Contraseña actualizada correctamente.');
    return;
  }
  const saveSettings = e.target.closest('[data-save-settings]');
  if(saveSettings){ closeModal(); toast('Cambios guardados en el perfil.'); }
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

/* mostrar/ocultar contraseña */
document.addEventListener('click', e => {
  const eye = e.target.closest('[data-eye]');
  if(!eye) return;
  const inp = document.getElementById(eye.dataset.eye);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  eye.style.color = inp.type === 'text' ? 'var(--green-hot)' : '';
});

/* preview de foto en dropzones */
document.querySelectorAll('.dropzone input[type="file"]').forEach(inp => {
  inp.addEventListener('change', () => {
    const dz = inp.closest('.dropzone');
    if(inp.files && inp.files[0]){
      dz.querySelector('.dz-preview').style.backgroundImage = `url('${URL.createObjectURL(inp.files[0])}')`;
      dz.classList.add('has-img');
    }
  });
});

function validateForm(id){
  const form = document.getElementById(id);
  let bad = 0;
  form.querySelectorAll('input,select').forEach(inp => {
    if(inp.type === 'file') return;
    const invalid = !inp.checkValidity();
    const field = inp.closest('.field');
    if(field) field.classList.toggle('error', invalid);
    if(invalid) bad++;
  });
  if(bad) toast('Revisá los campos marcados en rojo.');
  return bad === 0;
}
function resetForm(id, dzId){
  const form = document.getElementById(id);
  form.querySelectorAll('input').forEach(i => {
    if(i.type === 'file') return;
    if(i.type === 'checkbox') i.checked = false;
    else i.value='';
  });
  form.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
  if(dzId){ const dz = document.getElementById(dzId); dz.classList.remove('has-img'); dz.querySelector('input').value=''; }
}
function dzImage(dzId, fallback){
  const dz = document.getElementById(dzId);
  if(dz && dz.classList.contains('has-img')) return dz.querySelector('.dz-preview').style.backgroundImage.slice(5,-2);
  return fallback;
}

async function handleCreate(type){
  if(type === 'spot'){
    if(!validateForm('spotForm')) return;
    const ins = document.querySelectorAll('#spotForm input');
    const kind = document.querySelector('[data-seg="spotType"] .active').dataset.v;
    const latV = document.getElementById('spotLat')?.value;
    const lngV = document.getElementById('spotLng')?.value;
    if(!latV || !lngV){ toast('Marcá la ubicación del spot en el mapa.'); return; }
    let image = null;
    const _fi = document.querySelector('#dzSpot input[type="file"]');
    const _file = _fi && _fi.files && _fi.files[0];
    if(_file && window.SpotraMaps?.compressImage && window.SpotraBackend?.uploadSpotImage){
      try {
        toast('Subiendo foto...');
        const { blob, ext } = await window.SpotraMaps.compressImage(_file);
        const up = await window.SpotraBackend.uploadSpotImage(blob, ext);
        if(up && up.ok){ image = up.url; }
        else { toast('No se pudo subir la foto; se usará una imagen por defecto.'); }
      } catch(err){ console.warn('[SPOTRA] subir foto del spot:', err); }
    }
    let saveMode = 'error', saveErr = '';
    const sendBtn = document.querySelector('[data-submit="spot"]');
    if(sendBtn){ sendBtn.disabled = true; sendBtn.dataset.label = sendBtn.textContent; sendBtn.textContent = 'Enviando...'; }
    try {
      const result = await window.SpotraBackend?.createPlaceSubmission({
        type: kind,
        name: ins[0].value,
        locationLabel: ins[1].value,
        description: ins[2]?.value || '',
        lat: parseFloat(latV),
        lng: parseFloat(lngV),
        imageUrl: image
      });
      saveMode = result?.mode || 'error';
      saveErr = result?.error || '';
    } catch(error) {
      console.warn('[SPOTRA] No se pudo guardar el spot:', error);
    }
    if(sendBtn){ sendBtn.disabled = false; sendBtn.textContent = sendBtn.dataset.label || 'Enviar a aprobación'; }
    if(saveMode !== 'supabase'){
      // el formulario queda como estaba para poder reintentar
      toast(/row-level security/i.test(saveErr) ? 'Completá tu fecha de nacimiento (o vinculá a tu responsable) para sumar spots.' : (saveErr || 'No se pudo enviar el spot. Probá de nuevo.'));
      return;
    }
    resetForm('spotForm','dzSpot'); closeModal();
    if(window.SpotraSpotPicker) window.SpotraSpotPicker.reset();
    toast('¡Gracias! Tu spot quedó pendiente de aprobación. Te avisamos en la campana cuando esté en el mapa.');
  }
  if(type === 'event'){
    if(!validateForm('eventForm')) return;
    if(window.SpotraEvents) window.SpotraEvents.submitFromForm();
    else toast('El módulo de eventos no cargó. Recargá la app.');
  }
  if(type === 'post'){
    if(!validateForm('postForm')) return;
    if(window.SpotraForum) window.SpotraForum.submitFromForm();
    else toast('El módulo del foro no cargó. Recargá la app.');
  }
  if(type === 'product'){
    if(window.SpotraMarket) window.SpotraMarket.submitFromForm();
    else toast('El módulo del market no cargó. Recargá la app.');
  }
}

/* hero del login: usa login-hero.png si el archivo existe */
(() => {
  const hero = new Image();
  hero.onload = () => {
    document.querySelector('.auth-bg').style.backgroundImage =
      "linear-gradient(180deg,rgba(4,6,4,.18) 0%,rgba(4,6,4,.5) 38%,rgba(4,6,4,.96) 62%,#040604 78%),url('assets/banners/login-hero.webp')";
  };
  hero.src = 'assets/banners/login-hero.webp';
})();

window.addEventListener('popstate', () => setRoute(location.hash.replace('#',''), false));
setRoute(location.hash.replace('#','') || 'login', false);
