(function(){
  const cfg = () => (window.SpotraBackend && window.SpotraBackend.config) || window.SPOTRA_CONFIG || {};
  let map;
  let searchBox;
  let markers = [];
  let initialized = false;
  let activeType = 'skatepark';

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
    if(!directions || !directions.dataset.directions) return;
    event.preventDefault();
    window.open(directions.dataset.directions, '_blank', 'noopener');
  });

  window.SpotraMaps = { init, refresh, setFilter };
})();
