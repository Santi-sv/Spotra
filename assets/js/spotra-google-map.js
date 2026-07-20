(function(){
  const cfg = () => (window.SpotraBackend && window.SpotraBackend.config) || window.SPOTRA_CONFIG || {};
  let map;
  let searchBox;
  let markers = [];
  let initialized = false;
  let activeType = 'skatepark';
  let currentDetail = null;
  let selectedMarker = null;
  let userMarker = null;

  const darkStyle = [
    { elementType: 'geometry', stylers: [{ color: '#061009' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#aeb8ae' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#061009' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d7ded6' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#172018' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0a0f0b' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8f998f' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#08140d' }] }
  ];

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

  /* Pines SPOTRA: verde = tiendas, blanco = skateparks, gris claro = spots, lima = eventos.
     El seleccionado se agranda y suma halo verde. */
  function markerIcon(type, selected){
    const colors = {
      store: '#2ee84d',
      skatepark: '#ffffff',
      street_spot: '#c3cfc6',
      event_venue: '#9cff48'
    };
    const color = colors[type] || '#c3cfc6';
    const halo = selected ? '#2ee84d' : color;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="68" viewBox="0 0 52 68"><defs><filter id="g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${selected ? 7 : 5}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path filter="url(#g)" fill="${color}" stroke="${halo}" stroke-width="${selected ? 3 : 0}" d="M26 2C13.9 2 4 11.8 4 23.9 4 41.4 26 66 26 66s22-24.6 22-42.1C48 11.8 38.1 2 26 2Z"/><circle cx="26" cy="24" r="8.5" fill="#061009"/></svg>`;
    const size = selected ? 54 : 42;
    const h = selected ? 71 : 55;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, h),
      anchor: new google.maps.Point(size / 2, h - 3)
    };
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
      marker.addListener('click', () => { selectMarker(marker); updateDetail(place); });
      markers.push(marker);
      bounds.extend(marker.getPosition());
    });
    selectedMarker = null;
    if(places[0]){
      if(markers[0]) selectMarker(markers[0]);
      updateDetail(places[0]);
    }
    if(markers.length > 1) map.fitBounds(bounds, 64);
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
      updateDetail(place);
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
      zoomControl: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      styles: cfg().GOOGLE_MAP_ID ? undefined : darkStyle,
      mapId: cfg().GOOGLE_MAP_ID || undefined
    };
    map = new google.maps.Map(canvas, options);
    canvas.closest('.map-stage')?.classList.add('google-live');
    initialized = true;
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
      map.panTo(ll);
      map.setZoom(15);
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
