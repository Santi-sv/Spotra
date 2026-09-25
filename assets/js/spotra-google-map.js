(function(){
  const cfg = () => (window.SpotraBackend && window.SpotraBackend.config) || window.SPOTRA_CONFIG || {};
  let map;
  let searchBox;
  let markers = [];
  let initialized = false;
  let activeType = 'all';
  let currentDetail = null;
  let selectedMarker = null;
  let userMarker = null;
  let userLocation = null;

  /* Mapa realista: estilo estándar de Google. Solo se ocultan comercios, salud e íconos de transporte
     para que los pines de SPOTRA se lean bien. Parques, agua, calles y edificios quedan como en Google Maps. */
  const realStyle = [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
  ];

  const isMobile = () => window.matchMedia('(max-width:760px)').matches;
  let entries = [];

  function loadGoogleMaps(){
    const key = cfg().GOOGLE_MAPS_API_KEY;
    if(!key) return Promise.resolve(false);
    if(window.google && window.google.maps) return Promise.resolve(true);
    if(window.__spotraGoogleLoading) return window.__spotraGoogleLoading;
    window.__spotraGoogleLoading = new Promise((resolve, reject) => {
      window.__spotraGoogleReady = () => resolve(true);
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=__spotraGoogleReady`;
      script.async = true;
      script.defer = true;
      script.onerror = reject;
      document.head.appendChild(script);
    }).catch(error => {
      console.warn('[SPOTRA] Google Maps unavailable:', error);
      return false;
    });
    return window.__spotraGoogleLoading;
  }

  function ensureCanvas(){
    const stage = document.querySelector('.map-stage');
    if(!stage) return null;
    let canvas = document.getElementById('googleMapCanvas');
    if(!canvas){
      canvas = document.createElement('div');
      canvas.id = 'googleMapCanvas';
      canvas.className = 'google-map-canvas';
      canvas.setAttribute('aria-label', 'Mapa Google de SPOTRA');
      stage.prepend(canvas);
    }
    return canvas;
  }

  /* Pines redondos: círculo negro con borde blanco y el ícono del tipo.
     skatepark = rampa (verde), spot = escaleras (blanco), tienda = local (gris), evento = calendario (lima).
     El seleccionado se agranda y el borde pasa a verde. */
  const PIN_COLORS = { skatepark: '#2ee84d', street_spot: '#ffffff', store: '#b9c4bb', event_venue: '#c8ff3c' };
  const PIN_GLYPHS = {
    skatepark: '<path d="M4 16h16M5 16c2-7 5-7 7-2 2 4 5 4 7-2"/>',
    street_spot: '<path d="M4 19h4v-4h4v-4h4V7h4"/>',
    store: '<path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v9h12v-9M9 19v-5h6v5"/>',
    event_venue: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/>'
  };

  function pinGlyph(type){
    const color = PIN_COLORS[type] || '#ffffff';
    const glyph = PIN_GLYPHS[type] || PIN_GLYPHS.street_spot;
    return { color, glyph };
  }

  function markerIcon(type, selected){
    const { color, glyph } = pinGlyph(type);
    const border = selected ? '#2ee84d' : '#ffffff';
    const bw = selected ? 4 : 3;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="28" r="22" fill="rgba(0,0,0,.28)"/><circle cx="26" cy="26" r="22" fill="#0b0f0c" stroke="${border}" stroke-width="${bw}"/><g transform="translate(14,14)" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
    const size = selected ? 54 : 40;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2)
    };
  }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  /* ---------- hojas (ficha y lista) ---------- */
  function syncSheets(){
    const d = document.getElementById('spotSheet');
    const l = document.getElementById('mapListSheet');
    const open = !!((d && d.classList.contains('open')) || (l && l.classList.contains('open')));
    document.body.classList.toggle('map-sheet-open', open);
  }

  function openDetail(){
    closeList();
    const sheet = document.getElementById('spotSheet');
    if(!sheet) return;
    sheet.classList.add('open');
    sheet.scrollTop = 0;
    syncSheets();
  }

  function closeDetail(){
    const sheet = document.getElementById('spotSheet');
    if(sheet) sheet.classList.remove('open');
    if(isMobile()) selectMarker(null);
    syncSheets();
  }

  function closeList(){
    const list = document.getElementById('mapListSheet');
    if(list){ list.classList.remove('open'); list.setAttribute('aria-hidden', 'true'); }
    syncSheets();
  }

  function renderList(){
    const box = document.getElementById('mapListItems');
    if(!box) return;
    if(!entries.length){
      box.innerHTML = '<div class="map-list-empty">No hay lugares para este filtro todavía.</div>';
      return;
    }
    const rows = entries.map((e, i) => {
      const d = userLocation ? distanceMeters(userLocation, { lat: e.place.lat, lng: e.place.lng }) : null;
      return { i, e, d };
    });
    if(userLocation) rows.sort((x, y) => x.d - y.d);
    else rows.sort((x, y) => String(x.e.place.name).localeCompare(String(y.e.place.name), 'es'));
    box.innerHTML = rows.slice(0, 60).map(r => {
      const p = r.e.place;
      const { color, glyph } = pinGlyph(p.type);
      const label = p.label || (window.SpotraBackend ? window.SpotraBackend.labelForType(p.type) : '');
      const sub = [label, p.meta || p.address || ''].filter(Boolean).join(' · ');
      const dist = r.d != null ? formatDistance(r.d).replace(/^a /, '') : '';
      return `<button type="button" class="map-list-item" data-list-idx="${r.i}">`
        + `<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></span>`
        + `<span class="tx"><b>${esc(p.name)}</b><small>${esc(sub)}</small></span>`
        + (dist ? `<em>${esc(dist)}</em>` : '')
        + '</button>';
    }).join('');
  }

  function openList(){
    const list = document.getElementById('mapListSheet');
    if(!list) return;
    const sheet = document.getElementById('spotSheet');
    if(sheet) sheet.classList.remove('open');
    renderList();
    list.classList.add('open');
    list.setAttribute('aria-hidden', 'false');
    list.scrollTop = 0;
    syncSheets();
  }

  function focusEntry(idx){
    const e = entries[idx];
    if(!e) return;
    closeList();
    selectMarker(e.marker);
    if(map){
      map.panTo(e.marker.getPosition());
      if(map.getZoom() < 14) map.setZoom(15);
    }
    updateDetail(e.place);
    openDetail();
  }

  function selectMarker(marker){
    if(selectedMarker && selectedMarker !== marker && selectedMarker.getMap()){
      selectedMarker.setIcon(markerIcon(selectedMarker.__spotraType, false));
      selectedMarker.setZIndex(1);
    }
    selectedMarker = marker || null;
    if(marker){
      marker.setIcon(markerIcon(marker.__spotraType, true));
      marker.setZIndex(999);
    }
  }


  function distanceMeters(a, b){
    const R = 6371000;
    const rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function formatDistance(m){
    if(!Number.isFinite(m)) return '';
    if(m < 1000) return 'a ' + Math.round(m / 10) * 10 + ' m';
    return 'a ' + (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  function setRow(rowId, spanId, value){
    const row = document.getElementById(rowId);
    const span = document.getElementById(spanId);
    if(!row || !span) return row;
    if(value){ span.textContent = value; row.style.display = ''; }
    else { row.style.display = 'none'; }
    return row;
  }

  function normalizeUrl(url){
    if(!url) return '';
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
  }

  function instagramInfo(value){
    if(!value) return null;
    const raw = String(value).trim();
    const m = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    const user = m ? m[1] : raw.replace(/^@/, '');
    if(!user) return null;
    return { label: '@' + user, url: 'https://instagram.com/' + user };
  }

  function updateDetail(place){
    currentDetail = place;
    const type = document.getElementById('spotType');
    const name = document.getElementById('spotName');
    const meta = document.getElementById('spotMeta');
    const cover = document.getElementById('spotCover');
    const directions = document.getElementById('spotDirectionsBtn');
    if(type) type.textContent = place.label || window.SpotraBackend.labelForType(place.type);
    if(name) name.textContent = place.name;
    if(meta) meta.textContent = place.meta || place.address || '';
    if(cover){
      cover.style.background = `url('${place.imageUrl || 'assets/banners/banner-skatepark-4.webp'}') center/cover`;
      cover.style.boxShadow = 'inset 0 -90px 70px rgba(0,0,0,.82)';
    }
    const desc = document.getElementById('spotDesc');
    if(desc){
      if(place.description){ desc.textContent = place.description; desc.style.display = ''; }
      else desc.style.display = 'none';
    }
    setRow('spotAddressRow', 'spotAddress', place.address || '');
    const dist = (userLocation && Number.isFinite(place.lat) && Number.isFinite(place.lng))
      ? formatDistance(distanceMeters(userLocation, { lat: place.lat, lng: place.lng }))
      : '';
    setRow('spotDistRow', 'spotDist', dist);
    setRow('spotRatingRow', 'spotRating', place.rating ? String(place.rating) + ' · Google' : '');
    const phoneRow = setRow('spotPhoneRow', 'spotPhone', place.contactPhone || '');
    if(phoneRow && place.contactPhone) phoneRow.href = 'tel:' + String(place.contactPhone).replace(/[^+\d]/g, '');
    let webLabel = '';
    if(place.website){
      try { webLabel = new URL(normalizeUrl(place.website)).hostname.replace(/^www\./, ''); }
      catch { webLabel = place.website; }
    }
    const webRow = setRow('spotWebRow', 'spotWeb', webLabel);
    if(webRow && place.website) webRow.href = normalizeUrl(place.website);
    const ig = instagramInfo(place.instagram);
    const igRow = setRow('spotIgRow', 'spotIg', ig ? ig.label : '');
    if(igRow && ig) igRow.href = ig.url;
    if(directions){
      directions.dataset.directions = place.directionsUrl || window.SpotraBackend.googleDirectionsUrl(place);
      directions.removeAttribute('data-toast');
    }
    const addBtn = document.getElementById('spotAddBtn');
    if(addBtn){
      addBtn.style.display = place.isGoogleResult ? '' : 'none';
      addBtn.disabled = false;
      addBtn.textContent = 'Agregar a SPOTRA';
    }
    renderGallery(place);
    if(window.SpotraEvents) window.SpotraEvents.renderSpotEvents(place);
  }

  function clearMarkers(){
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    selectedMarker = null;
  }

  async function refresh(type = activeType){
    activeType = window.SpotraBackend.normalizeType(type);
    if(!map || !window.SpotraBackend) return;
    const places = await window.SpotraBackend.listPlaces({ type: activeType });
    clearMarkers();
    entries = [];
    const bounds = new google.maps.LatLngBounds();
    places.forEach(place => {
      if(!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;
      const marker = new google.maps.Marker({
        map,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        icon: markerIcon(place.type, false)
      });
      marker.__spotraType = place.type;
      marker.addListener('click', () => { selectMarker(marker); map.panTo(marker.getPosition()); updateDetail(place); openDetail(); });
      markers.push(marker);
      entries.push({ place, marker });
      bounds.extend(marker.getPosition());
    });
    selectedMarker = null;
    // en compu la ficha lateral siempre se ve: arranca con el primer lugar. En el celular espera a que toques un pin.
    if(entries[0] && !isMobile()){
      selectMarker(entries[0].marker);
      updateDetail(entries[0].place);
    }
    const list = document.getElementById('mapListSheet');
    if(list && list.classList.contains('open')) renderList();
    const pad = isMobile() ? { top: 130, right: 40, bottom: 80, left: 40 } : 64;
    if(markers.length > 1) map.fitBounds(bounds, pad);
    else if(markers.length === 1) {
      map.setCenter(markers[0].getPosition());
      map.setZoom(14);
    }
  }

  function setupSearch(){
    const input = document.getElementById('mapSearchInput');
    if(!input || searchBox || !(google.maps.places && google.maps.places.SearchBox)) return;
    searchBox = new google.maps.places.SearchBox(input);
    map.addListener('bounds_changed', () => searchBox.setBounds(map.getBounds()));
    searchBox.addListener('places_changed', () => {
      const places = searchBox.getPlaces();
      const result = places && places[0];
      if(!result || !result.geometry || !result.geometry.location) return;
      const loc = result.geometry.location;
      const place = {
        id: result.place_id,
        googlePlaceId: result.place_id,
        isGoogleResult: true,
        type: activeType,
        label: window.SpotraBackend.labelForType(activeType),
        name: result.name,
        meta: result.formatted_address || result.vicinity || 'Resultado de Google Places',
        address: result.formatted_address || result.vicinity || '',
        lat: loc.lat(),
        lng: loc.lng(),
        imageUrl: 'assets/banners/banner-skatepark-4.webp',
        stats: [result.rating ? String(result.rating) : '--', 'Google', 'OK']
      };
      map.panTo(loc);
      map.setZoom(15);
      selectMarker(null);
      updateDetail(place);
      openDetail();
    });
  }

  async function init(){
    if(initialized && map){
      google.maps.event.trigger(map, 'resize');
      return;
    }
    const canvas = ensureCanvas();
    if(!canvas) return;
    const hasGoogle = await loadGoogleMaps();
    if(!hasGoogle) return;
    const options = {
      center: cfg().DEFAULT_CENTER || { lat: -34.9011, lng: -56.1645 },
      zoom: cfg().DEFAULT_ZOOM || 12,
      disableDefaultUI: true,
      zoomControl: !isMobile(),
      gestureHandling: 'greedy',
      clickableIcons: false,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      styles: cfg().GOOGLE_MAP_ID ? undefined : realStyle,
      mapId: cfg().GOOGLE_MAP_ID || undefined
    };
    map = new google.maps.Map(canvas, options);
    canvas.closest('.map-stage')?.classList.add('google-live');
    initialized = true;
    map.addListener('click', () => { closeList(); if(isMobile()) closeDetail(); });
    setupSearch();
    addLocateControl();
    await refresh(activeType);
  }
  function userDotIcon(){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="14" fill="rgba(46,232,77,.22)"/><circle cx="23" cy="23" r="7" fill="#2ee84d" stroke="#061009" stroke-width="2.5"/></svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(46, 46),
      anchor: new google.maps.Point(23, 23)
    };
  }

  function locateMe(btn){
    if(!navigator.geolocation){
      if(window.toast) window.toast('Tu dispositivo no permite ubicación.');
      return;
    }
    if(btn) btn.classList.add('loading');
    if(window.toast) window.toast('Buscando tu ubicación...');
    navigator.geolocation.getCurrentPosition(pos => {
      if(btn) btn.classList.remove('loading');
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if(!map) return;
      if(!userMarker){
        userMarker = new google.maps.Marker({ map, position: ll, icon: userDotIcon(), clickable: false, zIndex: 998, title: 'Tu ubicación' });
      } else {
        userMarker.setPosition(ll);
        userMarker.setMap(map);
      }
      userLocation = ll;
      map.panTo(ll);
      map.setZoom(15);
      if(currentDetail) updateDetail(currentDetail);
      const list = document.getElementById('mapListSheet');
      if(list && list.classList.contains('open')) renderList();
    }, () => {
      if(btn) btn.classList.remove('loading');
      if(window.toast) window.toast('No pudimos obtener tu ubicación. Revisá los permisos.');
    }, { enableHighAccuracy: true, timeout: 9000 });
  }

  function addLocateControl(){
    if(document.getElementById('mapLocateBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'mapLocateBtn';
    btn.type = 'button';
    btn.className = 'map-locate-btn';
    btn.setAttribute('aria-label', 'Localizarme');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
    btn.addEventListener('click', () => locateMe(btn));
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(btn);
  }


  function setFilter(type){
    activeType = window.SpotraBackend ? window.SpotraBackend.normalizeType(type) : type;
    if(map) refresh(activeType);
  }

  document.addEventListener('click', event => {
    if(event.target.closest('#mapListBtn')){ event.preventDefault(); openList(); return; }
    if(event.target.closest('#mapListClose')){ event.preventDefault(); closeList(); return; }
    if(event.target.closest('#spotSheetClose')){ event.preventDefault(); closeDetail(); return; }
    const item = event.target.closest('[data-list-idx]');
    if(item){ event.preventDefault(); focusEntry(parseInt(item.dataset.listIdx, 10)); return; }
    const directions = event.target.closest('#spotDirectionsBtn');
    if(directions && directions.dataset.directions){
      event.preventDefault();
      window.open(directions.dataset.directions, '_blank', 'noopener');
      return;
    }
    const addBtn = event.target.closest('#spotAddBtn');
    if(addBtn){
      event.preventDefault();
      submitCurrentPlace(addBtn);
      return;
    }
    const photoBtn = event.target.closest('#spotPhotoBtn');
    if(photoBtn){
      event.preventDefault();
      const input = document.getElementById('spotPhotoInput');
      if(input) input.click();
    }
  });

  document.addEventListener('change', event => {
    if(event.target && event.target.id === 'spotPhotoInput'){
      const file = event.target.files && event.target.files[0];
      if(file) handlePhotoFile(file);
      event.target.value = '';
    }
  });

  /* comprime la imagen a WebP (o JPEG si el navegador no soporta WebP), máx 1600px */
  function compressImage(file){
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        const max = 1600;
        if(w > max || h > max){ const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if(blob && blob.type === 'image/webp') resolve({ blob, ext: 'webp' });
          else canvas.toBlob(b2 => resolve({ blob: b2, ext: 'jpg' }), 'image/jpeg', 0.82);
        }, 'image/webp', 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen inválida')); };
      img.src = url;
    });
  }

  async function handlePhotoFile(file){
    if(!currentDetail || !currentDetail.id || currentDetail.isGoogleResult) return;
    if(!/^image\//.test(file.type)){ if(window.toast) window.toast('Solo se pueden subir imágenes.'); return; }
    if(file.size > 20 * 1024 * 1024){ if(window.toast) window.toast('La imagen es muy pesada (máx. 20 MB).'); return; }
    if(window.toast) window.toast('Procesando imagen...');
    try {
      const { blob, ext } = await compressImage(file);
      const result = await window.SpotraBackend.uploadPlacePhoto(currentDetail.id, blob, ext);
      if(result.ok){
        if(window.toast) window.toast('Foto enviada. Queda pendiente de aprobación.');
      } else {
        if(window.toast) window.toast('No se pudo subir: ' + (result.error || 'probá de nuevo.'));
      }
    } catch(err){
      console.warn('[SPOTRA] foto:', err);
      if(window.toast) window.toast('No se pudo procesar la imagen.');
    }
  }

  async function renderGallery(place){
    const gallery = document.getElementById('spotGallery');
    const photoBtn = document.getElementById('spotPhotoBtn');
    const canUse = !!(place && place.id && !place.isGoogleResult);
    if(photoBtn) photoBtn.style.display = canUse ? '' : 'none';
    if(!gallery) return;
    gallery.innerHTML = '';
    gallery.style.display = 'none';
    if(!canUse || !window.SpotraBackend) return;
    const photos = await window.SpotraBackend.listPlacePhotos(place.id);
    if(!photos.length) return;
    gallery.style.display = 'flex';
    const admin = window.SpotraAuth ? await window.SpotraAuth.isAdmin() : false;
    photos.forEach(p => {
      const thumb = document.createElement('div');
      thumb.className = 'spot-gallery-thumb' + (p.is_cover ? ' is-cover' : '');
      thumb.style.backgroundImage = "url('" + p.url + "')";
      thumb.addEventListener('click', () => {
        const cover = document.getElementById('spotCover');
        if(cover) cover.style.backgroundImage = "url('" + p.url + "')";
      });
      if(admin && !p.is_cover){
        const b = document.createElement('button');
        b.className = 'set-cover';
        b.textContent = 'Portada';
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          const r = await window.SpotraBackend.setPlaceCover(p.id);
          if(r.ok){ if(window.toast) window.toast('Portada actualizada.'); renderGallery(place); refresh(); }
          else if(window.toast) window.toast('No se pudo cambiar la portada.');
        });
        thumb.appendChild(b);
      }
      gallery.appendChild(thumb);
    });
  }

  async function submitCurrentPlace(btn){
    if(!currentDetail || !window.SpotraBackend) return;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const result = await window.SpotraBackend.createPlaceSubmission({
        type: currentDetail.type,
        name: currentDetail.name,
        address: currentDetail.address || currentDetail.meta || '',
        lat: currentDetail.lat,
        lng: currentDetail.lng,
        googlePlaceId: currentDetail.googlePlaceId,
        imageUrl: currentDetail.imageUrl
      });
      if(result && result.mode === 'supabase'){
        btn.textContent = 'Enviado a aprobación';
        if(window.toast) window.toast('Lugar enviado. Queda pendiente de aprobación.');
      } else {
        btn.disabled = false;
        btn.textContent = 'Agregar a SPOTRA';
        if(window.toast) window.toast('Iniciá sesión para sumar lugares a SPOTRA.');
      }
    } catch(error){
      console.warn('[SPOTRA] No se pudo enviar el lugar:', error);
      btn.disabled = false;
      btn.textContent = 'Agregar a SPOTRA';
      if(window.toast) window.toast('No se pudo enviar el lugar. Probá de nuevo.');
    }
  }

  window.SpotraMaps = { init, refresh, setFilter, ensureApi: loadGoogleMaps, compressImage };
})();
