/* SPOTRA · Selector de ubicación para crear spots (v7)
   - v7: el mapa chico se arma siempre que se abre el formulario de spot (también desde el + del mapa),
         y "Usar mi ubicación" funciona aunque el mapa todavía esté cargando.
   - Arranca donde estabas mirando el mapa (no en Montevideo fijo).
   - El lugar queda marcado recién cuando tocás el mapa, movés el pin, usás tu ubicación o buscás una dirección.
   - Si el celular no da la ubicación, se puede buscar la dirección o la ciudad. */
(function(){
  let map, marker, inited = false, placed = false, initPromise = null;
  const DARK = [
    { elementType:'geometry', stylers:[{color:'#0c1014'}] },
    { elementType:'labels.text.fill', stylers:[{color:'#7d8b84'}] },
    { elementType:'labels.text.stroke', stylers:[{color:'#0c1014'}] },
    { featureType:'road', elementType:'geometry', stylers:[{color:'#1f2a25'}] },
    { featureType:'water', elementType:'geometry', stylers:[{color:'#0a1f16'}] },
    { featureType:'poi', stylers:[{visibility:'off'}] }
  ];
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(t(m)); }
  const $ = id => document.getElementById(id);

  function setLL(lat, lng){
    const a = $('spotLat'), b = $('spotLng');
    if(a) a.value = Number(lat).toFixed(7);
    if(b) b.value = Number(lng).toFixed(7);
    placed = true;
    if(marker){ marker.setOpacity(1); }
    const st = $('spotPickStatus');
    if(st){ st.textContent = t('Lugar marcado ✓ · podés mover el pin'); st.classList.add('ok'); }
  }
  function clearLL(){
    const a = $('spotLat'), b = $('spotLng');
    if(a) a.value = ''; if(b) b.value = '';
    placed = false;
    if(marker) marker.setOpacity(0.45);
    const st = $('spotPickStatus');
    if(st){ st.textContent = t('Tocá el mapa para marcar el lugar'); st.classList.remove('ok'); }
  }
  function startCenter(){
    const c = window.SpotraMaps && window.SpotraMaps.center ? window.SpotraMaps.center() : null;
    return c && Number.isFinite(c.lat) ? c : { lat: -34.9011, lng: -56.1645 };
  }
  async function ensureApi(){
    if(window.google && window.google.maps) return true;
    if(window.SpotraMaps && window.SpotraMaps.ensureApi){
      try { return await window.SpotraMaps.ensureApi(); } catch(e){ return false; }
    }
    return false;
  }
  function init(){
    if(!initPromise) initPromise = doInit().then(ok => { if(!ok) initPromise = null; return ok; });
    return initPromise;
  }
  async function doInit(){
    const el = $('spotPickMap');
    if(!el) return false;
    if(!(await ensureApi())){
      el.innerHTML = `<div style="padding:18px;color:#9aa6a0;font-size:13px">${t('No se pudo cargar el mapa. Revisá tu conexión e intentá de nuevo.')}</div>`;
      return false;
    }
    const center = startCenter();
    map = new google.maps.Map(el, { center, zoom: 15, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false, styles: DARK });
    marker = new google.maps.Marker({ position: center, map, draggable: true, opacity: 0.45 });
    marker.addListener('dragend', () => { const p = marker.getPosition(); setLL(p.lat(), p.lng()); });
    map.addListener('click', e => { marker.setPosition(e.latLng); setLL(e.latLng.lat(), e.latLng.lng()); });
    inited = true;
    clearLL();
    return true;
  }
  function show(){
    if(!inited){ init(); return; }
    setTimeout(() => {
      if(!map) return;
      google.maps.event.trigger(map, 'resize');
      if(!placed){ const c = startCenter(); map.setCenter(c); marker.setPosition(c); map.setZoom(15); clearLL(); }
      else map.setCenter(marker.getPosition());
    }, 250);
  }
  function useMyLocation(btn){
    if(!navigator.geolocation){ toast('Tu dispositivo no permite ubicación.'); return; }
    if(btn){ btn.disabled = true; btn.textContent = t('Buscando...'); }
    init(); // si el mapa no estaba armado, lo armamos mientras se busca la ubicación
    navigator.geolocation.getCurrentPosition(async pos => {
      if(btn){ btn.disabled = false; btn.textContent = t('Usar mi ubicación'); }
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const ok = await init();
      if(ok && map && marker){ map.setCenter(ll); map.setZoom(17); marker.setPosition(ll); }
      setLL(ll.lat, ll.lng); // aunque el mapa no cargue, el lugar queda marcado para enviar el spot
      toast(ok ? 'Ubicación marcada. Ajustá el pin si hace falta.' : 'Ubicación marcada.');
    }, () => {
      if(btn){ btn.disabled = false; btn.textContent = t('Usar mi ubicación'); }
      toast('No pudimos obtener tu ubicación. Buscá la dirección o tocá el mapa.');
    }, { enableHighAccuracy: true, timeout: 9000 });
  }
  async function search(){
    const q = ($('spotPickSearch') || {}).value || '';
    if(q.trim().length < 3){ toast('Escribí una dirección o ciudad.'); return; }
    try {
      const lang = window.SpotraI18n ? window.SpotraI18n.lang() : 'es';
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=${lang}&q=${encodeURIComponent(q.trim())}`);
      const j = r.ok ? await r.json() : [];
      if(!j.length){ toast('No encontramos esa dirección. Probá con otra o tocá el mapa.'); return; }
      const ll = { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
      const ok = await init();
      if(ok && map && marker){ map.setCenter(ll); map.setZoom(17); marker.setPosition(ll); }
      setLL(ll.lat, ll.lng);
      toast('Ubicación marcada. Ajustá el pin si hace falta.');
    } catch(e){ toast('No se pudo buscar. Revisá tu conexión.'); }
  }
  // armar el mapa cada vez que el formulario de spot queda abierto (venga del menú, del + del mapa o de la ayuda)
  function watchForm(){
    const form = document.querySelector('.modal-form[data-form="spot"]');
    if(!form || form.__spotPick) return;
    form.__spotPick = true;
    let wasOpen = false;
    const check = () => {
      const bg = document.getElementById('modalBg');
      const open = form.classList.contains('active') && (!bg || bg.classList.contains('open'));
      if(open && !wasOpen) setTimeout(show, 300);
      wasOpen = open;
    };
    new MutationObserver(check).observe(form, { attributes: true, attributeFilter: ['class'] });
    const bg = document.getElementById('modalBg');
    if(bg) new MutationObserver(check).observe(bg, { attributes: true, attributeFilter: ['class'] });
    check();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchForm); else watchForm();

  document.addEventListener('click', e => {
    const b = e.target.closest('#spotUseLoc');
    if(b){ e.preventDefault(); useMyLocation(b); }
    if(e.target.closest('#spotPickGo')){ e.preventDefault(); search(); }
  });
  document.addEventListener('keydown', e => { if(e.target && e.target.id === 'spotPickSearch' && e.key === 'Enter'){ e.preventDefault(); search(); } });
  window.SpotraSpotPicker = { reset: clearLL, isPlaced: () => placed };
})();
