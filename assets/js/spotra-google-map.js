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

  /* Mapa realista: de día el estilo estándar de Google; de noche su versión oscura.
     En los dos se ocultan comercios, salud e íconos de transporte para que se lean los pines. */
  const HIDE = [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
  ];
  const nightStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1f2a24' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2a24' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8f9a92' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d6ded8' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9fb2a4' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#20402a' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6fae7f' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#36423b' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a231e' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a3aea6' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4c5a51' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a231e' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#cfd8d2' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2c3831' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#14242c' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5f7480' }] }
  ];
  const isDark = () => document.documentElement.classList.contains('theme-dark');
  const mapStyle = () => (isDark() ? nightStyle : []).concat(HIDE);
  window.addEventListener('spotra-theme', () => {
    if(map && !cfg().GOOGLE_MAP_ID) map.setOptions({ styles: mapStyle() });
  });

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

  const ridersAt = id => (window.SpotraSessions && id ? window.SpotraSessions.ridersAt(id) : 0);

  function markerIcon(type, selected, riders){
    const { color, glyph } = pinGlyph(type);
    const live = riders > 0;
    const border = (selected || live) ? '#2ee84d' : '#ffffff';
    const bw = (selected || live) ? 4 : 3;
    const halo = live ? '<circle cx="30" cy="30" r="28" fill="rgba(46,232,77,.30)"/>' : '';
    const badge = live ? `<circle cx="47" cy="12" r="11" fill="#2ee84d" stroke="#0b0f0c" stroke-width="2"/><text x="47" y="16.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#06130a">${riders > 9 ? '9+' : riders}</text>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">${halo}<circle cx="30" cy="32" r="21" fill="rgba(0,0,0,.28)"/><circle cx="30" cy="30" r="21" fill="#0b0f0c" stroke="${border}" stroke-width="${bw}"/><g transform="translate(18,18)" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>${badge}</svg>`;
    const size = selected ? 64 : (live ? 58 : 48);
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2)
    };
  }

  /* ---------- agrupado de pines (clusters) ---------- */
  let clusterer = null;
  function loadClusterLib(){
    if(window.markerClusterer) return Promise.resolve(true);
    if(window.__spotraClusterLoading) return window.__spotraClusterLoading;
    window.__spotraClusterLoading = new Promise(resolve => {
      const sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.5.3/dist/index.min.js';
      sc.async = true;
      sc.onload = () => resolve(!!window.markerClusterer);
      sc.onerror = () => resolve(false);
      document.head.appendChild(sc);
    });
    return window.__spotraClusterLoading;
  }

  function clusterIcon(count, live){
    const txt = count > 999 ? '999+' : String(count);
    const ring = live ? '#2ee84d' : '#ffffff';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="rgba(46,232,77,.22)"/><circle cx="32" cy="33.5" r="23" fill="rgba(0,0,0,.25)"/><circle cx="32" cy="32" r="23" fill="#0b0f0c" stroke="${ring}" stroke-width="3.5"/><text x="32" y="37" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${txt.length > 3 ? 13 : 16}" font-weight="700" fill="#2ee84d">${txt}</text></svg>`;
    const size = count > 99 ? 60 : 52;
    return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size / 2, size / 2) };
  }

  async function ensureClusterer(){
    if(clusterer || !map) return clusterer;
    const ok = await loadClusterLib();
    if(!ok || !window.markerClusterer || !window.markerClusterer.MarkerClusterer) return null;
    clusterer = new window.markerClusterer.MarkerClusterer({
      map,
      markers: [],
      renderer: {
        render: ({ count, position, markers: ms }) => new google.maps.Marker({
          position,
          icon: clusterIcon(count, (ms || []).some(m => m.__riders > 0)),
          zIndex: 400 + count
        })
      }
    });
    return clusterer;
  }

  function applySessionIcons(){
    entries.forEach(e => {
      const r = ridersAt(e.place.id);
      e.marker.__riders = r;
      e.marker.setIcon(markerIcon(e.place.type, e.marker === selectedMarker, r));
      e.marker.setZIndex(e.marker === selectedMarker ? 999 : (r > 0 ? 500 : 1));
    });
    if(clusterer && clusterer.render) clusterer.render();
  }
  window.addEventListener('spotra-sessions', () => {
    applySessionIcons();
    const list = document.getElementById('mapListSheet');
    if(list && list.classList.contains('open')) renderList();
  });

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

  let listMode = 'zone';
  function renderList(){
    const box = document.getElementById('mapListItems');
    const title = document.getElementById('mapListTitle');
    if(!box) return;
    if(title) title.textContent = listMode === 'sessions' ? 'Sesiones activas' : 'Lugares en esta zona';
    const bounds = map && map.getBounds ? map.getBounds() : null;
    const ctr = map && map.getCenter ? map.getCenter() : null;
    const ref = userLocation || (ctr ? { lat: ctr.lat(), lng: ctr.lng() } : null);
    let rows = entries.map((e, i) => ({ i, e })).filter(r => listMode === 'sessions'
      ? ridersAt(r.e.place.id) > 0
      : (!bounds || bounds.contains(r.e.marker.getPosition())));
    if(!rows.length){
      box.innerHTML = '<div class="map-list-empty">' + (listMode === 'sessions'
        ? 'Todavía no hay sesiones activas. Creá una desde la ficha de un spot.'
        : 'No hay lugares en esta zona. Alejá el mapa para ver más.') + '</div>';
      return;
    }
    rows.forEach(r => { r.d = ref ? distanceMeters(ref, { lat: r.e.place.lat, lng: r.e.place.lng }) : null; });
    rows.sort((x, y) => (x.d || 0) - (y.d || 0));
    if(!userLocation) rows.forEach(r => { r.d = null; });
    box.innerHTML = rows.slice(0, 60).map(r => {
      const p = r.e.place;
      const { color, glyph } = pinGlyph(p.type);
      const label = p.label || (window.SpotraBackend ? window.SpotraBackend.labelForType(p.type) : '');
      const sub = [label, p.meta || p.address || ''].filter(Boolean).join(' · ');
      const dist = r.d != null ? formatDistance(r.d).replace(/^a /, '') : '';
      return `<button type="button" class="map-list-item" data-list-idx="${r.i}">`
        + `<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></span>`
        + `<span class="tx"><b>${esc(p.name)}</b><small>${esc(sub)}</small></span>`
        + (ridersAt(p.id) > 0 ? `<span class="list-live">${ridersAt(p.id)}</span>` : '')
        + (dist ? `<em>${esc(dist)}</em>` : '')
        + '</button>';
    }).join('');
  }

  function openList(mode){
    listMode = mode === 'sessions' ? 'sessions' : 'zone';
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
      if(map.getZoom() < 16) map.setZoom(16);
    }
    updateDetail(e.place);
    openDetail();
  }

  function selectMarker(marker){
    if(selectedMarker && selectedMarker !== marker){
      selectedMarker.setIcon(markerIcon(selectedMarker.__spotraType, false, selectedMarker.__riders || 0));
      selectedMarker.setZIndex(selectedMarker.__riders > 0 ? 500 : 1);
    }
    selectedMarker = marker || null;
    if(marker){
      marker.setIcon(markerIcon(marker.__spotraType, true, marker.__riders || 0));
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
    if(window.SpotraSessions) window.SpotraSessions.renderForPlace(place);
    if(window.SpotraEvents) window.SpotraEvents.renderSpotEvents(place);
  }

  function clearMarkers(){
    if(clusterer) clusterer.clearMarkers();
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    selectedMarker = null;
  }

  let allPlaces = null;
  let firstFit = true;
  async function refresh(type = activeType, reload = false){
    activeType = window.SpotraBackend.normalizeType(type);
    if(!map || !window.SpotraBackend) return;
    if(!allPlaces || reload) allPlaces = await window.SpotraBackend.listPlaces({ type: 'all' });
    const places = activeType === 'all' ? allPlaces : allPlaces.filter(p => p.type === activeType);
    clearMarkers();
    entries = [];
    const bounds = new google.maps.LatLngBounds();
    places.forEach(place => {
      if(!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;
      const riders = ridersAt(place.id);
      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        icon: markerIcon(place.type, false, riders),
        zIndex: riders > 0 ? 500 : 1
      });
      marker.__spotraType = place.type;
      marker.__riders = riders;
      marker.__placeId = place.id;
      marker.addListener('click', () => { selectMarker(marker); map.panTo(marker.getPosition()); updateDetail(place); openDetail(); });
      markers.push(marker);
      entries.push({ place, marker });
      bounds.extend(marker.getPosition());
    });
    const cl = await ensureClusterer();
    if(cl){ cl.clearMarkers(); cl.addMarkers(markers); }
    else markers.forEach(m => m.setMap(map));
    selectedMarker = null;
    // en compu la ficha lateral siempre se ve: arranca con el primer lugar. En el celular espera a que toques un pin.
    if(entries[0] && !isMobile() && !currentDetail){
      selectMarker(entries[0].marker);
      updateDetail(entries[0].place);
    }
    const list = document.getElementById('mapListSheet');
    if(list && list.classList.contains('open')) renderList();
    if(!firstFit) return;
    firstFit = false;
    const pad = isMobile() ? { top: 130, right: 40, bottom: 80, left: 40 } : 64;
    if(markers.length > 1) map.fitBounds(bounds, pad);
    else if(markers.length === 1){ map.setCenter(markers[0].getPosition()); map.setZoom(14); }
    // si el rider ya dio permiso de ubicación, arrancamos en su zona
    try {
      if(navigator.permissions && navigator.geolocation){
        const st = await navigator.permissions.query({ name: 'geolocation' });
        if(st.state === 'granted') locateMe(null, true);
      }
    } catch(e){}
  }

  function openPlaceById(id){
    const idx = entries.findIndex(e => e.place.id === id);
    if(idx >= 0) focusEntry(idx);
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
      styles: cfg().GOOGLE_MAP_ID ? undefined : mapStyle(),
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

  function locateMe(btn, quiet){
    if(!navigator.geolocation){
      if(window.toast) window.toast('Tu dispositivo no permite ubicación.');
      return;
    }
    if(btn) btn.classList.add('loading');
    if(window.toast && !quiet) window.toast('Buscando tu ubicación...');
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
      map.setZoom(quiet ? 13 : 15);
      if(currentDetail) updateDetail(currentDetail);
      const list = document.getElementById('mapListSheet');
      if(list && list.classList.contains('open')) renderList();
    }, () => {
      if(btn) btn.classList.remove('loading');
      if(window.toast && !quiet) window.toast('No pudimos obtener tu ubicación. Revisá los permisos.');
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
    if(event.target.closest('#mapListBtn')){ event.preventDefault(); openList('zone'); return; }
    if(event.target.closest('#mapSessionsPill')){ event.preventDefault(); openList('sessions'); return; }
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
          if(r.ok){ if(window.toast) window.toast('Portada actualizada.'); renderGallery(place); refresh(activeType, true); }
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

  window.SpotraMaps = { init, refresh, setFilter, ensureApi: loadGoogleMaps, compressImage, current: () => currentDetail, openPlaceById, openDetail, closeDetail };
})();
