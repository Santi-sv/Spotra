/* SPOTRA · Eventos (v1)
   - Llena el selector de spots del formulario con lugares reales.
   - Crea el evento en Supabase (queda pendiente de aprobación).
   - Muestra eventos aprobados en Inicio y en la ficha del spot en el mapa. */
(function(){
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  let placesLoaded = false;
  const DISC_LABEL = { todas: '', skate: 'Skate', bmx: 'BMX', rollers: 'Rollers' };

  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function fmtWhen(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
  }

  function eventRowHTML(ev, withPlace){
    const day = ev.startsAt ? ev.startsAt.getDate() : '--';
    const parts = [];
    if(DISC_LABEL[ev.discipline]) parts.push(DISC_LABEL[ev.discipline]);
    if(withPlace && ev.placeName) parts.push(ev.placeName + (ev.placeCity ? ' · ' + ev.placeCity : ''));
    const when = fmtWhen(ev.startsAt);
    if(when) parts.push(when);
    const meta = parts.join(' · ');
    const desc = ev.description ? `<div class="meta">${esc(ev.description)}</div>` : '';
    return `<div class="event-row"><div class="date">${esc(day)}</div><div><b>${esc(ev.title)}</b><div class="meta">${esc(meta)}</div>${desc}</div></div>`;
  }

  /* ---- Selector de spots del formulario ---- */
  async function populatePlaceSelect(force){
    const select = document.getElementById('eventPlaceSelect');
    if(!select || !window.SpotraBackend) return;
    if(placesLoaded && !force) return;
    const places = await window.SpotraBackend.listPlaces({ type: 'all' });
    const current = select.value;
    select.innerHTML = '<option value="">Spot donde se hace</option>' +
      places
        .filter(p => p.id && !p.isGoogleResult)
        .map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.city ? ' · ' + esc(p.city) : ''}</option>`)
        .join('');
    if(current) select.value = current;
    placesLoaded = places.length > 0;
  }

  /* ---- Crear evento desde el formulario ---- */
  async function submitFromForm(){
    const title = (document.getElementById('eventTitle') || {}).value || '';
    const placeId = (document.getElementById('eventPlaceSelect') || {}).value || '';
    const date = (document.getElementById('eventDate') || {}).value || '';
    const time = (document.getElementById('eventTime') || {}).value || '';
    const description = (document.getElementById('eventDesc') || {}).value || '';
    const discBtn = document.querySelector('[data-seg="eventDiscipline"] .active');
    const discipline = (discBtn && discBtn.dataset.v) || 'todas';
    if(!title.trim() || !placeId || !date || !time){
      toast('Completá nombre, spot, fecha y hora.');
      return;
    }
    const startsAt = new Date(date + 'T' + time);
    if(isNaN(startsAt)){ toast('Fecha u hora inválida.'); return; }
    if(startsAt.getTime() < Date.now() - 3600 * 1000){
      toast('La fecha del evento ya pasó. Elegí una futura.');
      return;
    }
    const btn = document.querySelector('[data-submit="event"]');
    if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }
    const result = window.SpotraBackend
      ? await window.SpotraBackend.createEvent({ placeId, title: title.trim(), description: description.trim(), discipline, startsAt: startsAt.toISOString() })
      : { ok: false, error: 'sin conexión' };
    if(btn){ btn.disabled = false; btn.textContent = 'Enviar a aprobación'; }
    if(!result.ok){
      toast(result.error === 'auth'
        ? 'Iniciá sesión para crear un evento.'
        : 'No se pudo enviar el evento. Probá de nuevo.');
      return;
    }
    if(typeof window.resetForm === 'function') window.resetForm('eventForm');
    const seg = document.querySelectorAll('[data-seg="eventDiscipline"] button');
    seg.forEach((b, i) => b.classList.toggle('active', i === 0));
    if(typeof window.closeModal === 'function') window.closeModal();
    toast('Evento enviado. Queda pendiente de aprobación.');
  }

  /* ---- Lista general en Inicio ---- */
  async function renderHomeEvents(){
    const wrap = document.getElementById('homeEvents');
    if(!wrap || !window.SpotraBackend) return;
    const events = await window.SpotraBackend.listEvents({ limit: 8 });
    if(!events.length){
      wrap.innerHTML = '<div class="meta">Todavía no hay eventos publicados. Creá el primero desde el botón +.</div>';
      return;
    }
    wrap.innerHTML = events.map(ev => eventRowHTML(ev, true)).join('');
  }

  /* ---- Eventos del spot en la ficha del mapa ---- */
  let spotToken = 0;
  async function renderSpotEvents(place){
    const head = document.getElementById('spotEventsHead');
    const wrap = document.getElementById('spotEvents');
    if(!head || !wrap) return;
    head.style.display = 'none';
    wrap.innerHTML = '';
    if(!place || !place.id || place.isGoogleResult || !window.SpotraBackend) return;
    const token = ++spotToken;
    const events = await window.SpotraBackend.listEvents({ placeId: place.id, limit: 5 });
    if(token !== spotToken) return; /* el usuario ya tocó otro pin */
    if(!events.length) return;
    head.style.display = '';
    wrap.innerHTML = events.map(ev => eventRowHTML(ev, false)).join('');
  }

  /* ---- Init ---- */
  function init(){
    populatePlaceSelect();
    renderHomeEvents();
    document.addEventListener('click', e => {
      if(e.target.closest('[data-open-modal="event"], [data-open-modal="menu"]')) populatePlaceSelect();
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.SpotraEvents = { submitFromForm, renderHomeEvents, renderSpotEvents, populatePlaceSelect };
})();
