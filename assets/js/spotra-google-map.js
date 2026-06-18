(function(){
  const cfg = () => (window.SpotraBackend && window.SpotraBackend.config) || window.SPOTRA_CONFIG || {};
  let map;
  let searchBox;
  let markers = [];
  let initialized = false;
  let activeType = 'skatepark';
  let currentDetail = null;

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

  function markerIcon(type){
    const color = type === 'store' ? '#2ee84d' : type === 'event_venue' ? '#9cff48' : '#74ff3a';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="68" viewBox="0 0 52 68"><defs><filter id="g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path filter="url(#g)" fill="${color}" d="M26 2C13.9 2 4 11.8 4 23.9 4 41.4 26 66 26 66s22-24.6 22-42.1C48 11.8 38.1 2 26 2Z"/><circle cx="26" cy="24" r="8.5" fill="#061009"/></svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(42, 55),
      anchor: new google.maps.Point(21, 52)
    };
  }

  function updateDetail(place){
    currentDetail = place;
    const type = document.getElementById('spotType');
    const name = document.getElementById('spotName');
    const meta = document.getElementById('spotMeta');
    const s1 = document.getElementById('spotS1');
    const s2 = document.getElementById('spotS2');
    const s3 = document.getElementById('spotS3');
    const cover = document.getElementById('spotCover');
    const directions = document.getElementById('spotDirectionsBtn');
    if(type) type.textContent = place.label || window.SpotraBackend.labelForType(place.type);
    if(name) name.textContent = place.name;
    if(meta) meta.textContent = place.meta || place.address || '';
    if(s1) s1.textContent = place.stats?.[0] || (place.rating ? String(place.rating) : '--');
    if(s2) s2.textContent = place.stats?.[1] || '--';
    if(s3) s3.textContent = place.stats?.[2] || 'OK';
    if(cover){
      cover.style.background = `url('${place.imageUrl || 'assets/banners/banner-skatepark-4.webp'}') center/cover`;
      cover.style.boxShadow = 'inset 0 -90px 70px rgba(0,0,0,.82)';
    }
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
        icon: markerIcon(place.type)
      });
      marker.addListener('click', () => updateDetail(place));
      markers.push(marker);
      bounds.extend(marker.getPosition());
    });
    if(places[0]) updateDetail(places[0]);
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
    await refresh(activeType);
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

  window.SpotraMaps = { init, refresh, setFilter };
})();
