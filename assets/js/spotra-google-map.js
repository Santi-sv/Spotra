/* SPOTRA · mapa de Google (v25, 18/10/2026: más liviano — pines en caché, solo se redibuja lo que cambia, sin desenfoques; v24 17/10/2026: rediseño — mapa claro propio, pines con color por categoría,
   puntos de lejos, nombres de cerca, grupos con anillo de colores y pines que laten si hay gente) */
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
  // 13/10/2026: el mapa se ve siempre claro (calles y parques reales); los menús encima siguen oscuros
  // 17/10/2026: estilo "SPOTRA claro": mapa neutro y sin íconos de comercios, para que los pines resalten
  const LIGHT = [
    { elementType: 'geometry', stylers: [{ color: '#f1f2ef' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6a706c' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f6f7f4' }, { weight: 3 }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#a3a8a4' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#3c423e' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dbe9d6' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#7f9a80' }] },
    { featureType: 'poi.park', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e3e5e1' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#888e8a' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e6e8e4' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d6d9d4' }] },
    { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cde0ea' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#86a2b1' }] }
  ];
  const mapStyle = () => [].concat(LIGHT);
  window.addEventListener('spotra-theme', () => {
    if(map && !cfg().GOOGLE_MAP_ID) map.setOptions({ styles: mapStyle() });
  });

  // idioma del mapa: el elegido en SPOTRA (clave spotra_lang, compartida con la landing)
  function mapsLang(){
    let v = '';
    try { v = (localStorage.getItem('spotra_lang') || navigator.language || 'es').toLowerCase(); } catch(e){ v = 'es'; }
    return v.startsWith('pt') ? 'pt-BR' : v.startsWith('en') ? 'en' : 'es';
  }
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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=${encodeURIComponent(mapsLang())}&callback=__spotraGoogleReady`;
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

  /* Pines (17/10/2026): gota con el color de la categoría, borde blanco e ícono blanco.
     Íconos de librerías profesionales: Material Symbols (Google, Apache 2.0) y Tabler Icons (MIT).
     skatepark = skateboarding · spot = escalera · tienda = bolsa · evento = calendario.
     PIN_FILL = color fuerte (fondo del pin, ícono blanco) · PIN_COLORS = color claro (ícono sobre fondo oscuro). */
  const PIN_FILL = { skatepark: '#6e56f0', street_spot: '#0a9cb0', store: '#e23d80', event_venue: '#2f6ff0' };
  const PIN_COLORS = { skatepark: '#9d8cff', street_spot: '#2ed3e6', store: '#ff6fa8', event_venue: '#4d8dff' };
  const PIN_ICONS = {
    skatepark: { vb: '0 -960 960 960', d: 'M272.5-7.5Q265-15 265-25t7.5-17.5Q280-50 290-50t17.5 7.5Q315-35 315-25t-7.5 17.5Q300 0 290 0t-17.5-7.5Zm340 0Q605-15 605-25t7.5-17.5Q620-50 630-50t17.5 7.5Q655-35 655-25t-7.5 17.5Q640 0 630 0t-17.5-7.5ZM270-90q-42 0-82.5-19T124-163q-2-3.33-3-6t-1-6q0-8 5.26-14 5.27-6 14.48-6 5.26 0 9.76 2t6.5 6q13 22 38.5 35.5T246-132l132-160-60-170q-5-15-2.5-27t10.5-26l110-175H318l-58 93q-7 11-18 13.5t-22-4q-11-6.5-14-18.5t4-23l67-107q3.82-6.63 10.71-10.32Q294.59-750 303-750h205q23.32 0 37.57 12.91Q559.82-724.19 565-713l21 48q18 42 54 71.5t82 39.5q12 2 20 12t8 22q0 12-8.5 20.5T722-493q-57.24-8.68-104.12-42.84Q571-570 539-621l-85 136 163 112q6 5 9.5 11.21 3.5 6.2 3.5 13.79v218h30q31.57 0 58.78-15Q746-160 764-187q3.33-4 7-6t9-2q8 0 14 5.91 6 5.92 6 13.8 0 3.29-1 6.06-1 2.77-3 6.23-23 35-58.5 54T660-90H270Zm53-40h247v-190L399-439l45 141q2 8 1 15.5t-6 13.5L323-130Zm284.08-644q-30.08 0-51.58-21.42t-21.5-51.5q0-30.08 21.42-51.58t51.5-21.5q30.08 0 51.58 21.42t21.5 51.5q0 30.08-21.42 51.58t-51.5 21.5Z', stroke: false },
    street_spot: { vb: '0 0 24 24', d: 'M22 5h-5v5h-5v5h-5v5h-5', stroke: true },
    store: { vb: '0 -960 960 960', d: 'M180-80q-24 0-42-18t-18-42v-530q0-24 18-42t42-18h110q0-79 53-134.5T475-920q79 0 137 55.5T670-730h110q24 0 42 18t18 42v530q0 24-18 42t-42 18H180Zm170-650h260q0-55-37.5-92.5T480-860q-55 0-92.5 37.5T350-730Zm130 300q73 0 133-51.5T673-597q0-11-9-19.5t-22-8.5q-11 0-19.5 7.5T612-598q-10 47-47.5 77.5T480-490q-47 0-84.5-30.5T348-598q-2-12-11-19.5t-20-7.5q-12 0-21 8.5t-9 19.5q0 64 59.5 115.5T480-430Z', stroke: false },
    event_venue: { vb: '0 -960 960 960', d: 'M528-248.18q-28-28.19-28-69Q500-358 528.18-386q28.19-28 69-28Q638-414 666-385.82q28 28.19 28 69Q694-276 665.82-248q-28.19 28-69 28Q556-220 528-248.18ZM180-80q-24 0-42-18t-18-42v-620q0-24 18-42t42-18h65v-28q0-13.6 9-22.8 9-9.2 23.02-9.2t23.5 9.2Q310-861.6 310-848v28h340v-28q0-13.6 9-22.8 9-9.2 23.02-9.2t23.5 9.2Q715-861.6 715-848v28h65q24 0 42 18t18 42v620q0 24-18 42t-42 18H180Zm0-60h600v-430H180v430Z', stroke: false }
  };
  // ícono como <svg> anidado: sirve dentro del pin y en las listas
  function iconSvg(type, x, y, size, color){
    const ic = PIN_ICONS[type] || PIN_ICONS.street_spot;
    return ic.stroke
      ? `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${ic.vb}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${ic.d}"/></svg>`
      : `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${ic.vb}" fill="${color}"><path d="${ic.d}"/></svg>`;
  }
  function pinGlyph(type){
    const color = PIN_COLORS[type] || '#ffffff';
    return { color, fill: PIN_FILL[type] || '#3a443d', glyph: iconSvg(type, 0, 0, 24, color) };
  }

  const ridersAt = id => (window.SpotraSessions && id ? window.SpotraSessions.ridersAt(id) : 0);
  const nowAt = id => (window.SpotraPresence && id ? window.SpotraPresence.countAt(id) : 0);

  // riders = anotados en sesiones (globito verde arriba) · now = andando ahora (globito naranja abajo)
  const PIN_BODY = 'M32 57c-1.3 0-17-15.2-17-31a17 17 0 1 1 34 0c0 15.8-15.7 31-17 31z';
  const ZOOM_PINS = 13;    // desde acá se ven pines; más lejos, puntos de color
  const ZOOM_LABELS = 15;  // desde acá, el nombre debajo de cada pin
  const zoomNow = () => (map && map.getZoom ? map.getZoom() : 14);
  function svgUrl(svg){ return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`; }
  function pulse(color){
    return `<circle cx="32" cy="26" r="18" fill="none" stroke="${color}" stroke-width="3"><animate attributeName="r" values="18;30" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="1.8s" repeatCount="indefinite"/></circle>`;
  }
  const iconCache = new Map();
  const levelNow = () => { const z = zoomNow(); return z >= ZOOM_LABELS ? 2 : (z >= ZOOM_PINS ? 1 : 0); };
  function markerIcon(type, selected, riders, now){
    const ckey = [type, selected ? 1 : 0, Math.min(riders || 0, 10), Math.min(now || 0, 10), zoomNow() < ZOOM_PINS ? 0 : 1].join('|');
    const hit = iconCache.get(ckey);
    if(hit) return hit;
    const icon = buildMarkerIcon(type, selected, riders, now);
    iconCache.set(ckey, icon);
    return icon;
  }
  function buildMarkerIcon(type, selected, riders, now){
    const { fill } = pinGlyph(type);
    const live = riders > 0;
    const here = now > 0;
    const liveColor = here ? '#ff8a3d' : '#2ee84d';
    // lejos: punto de color (el elegido y los que tienen gente siempre se ven como pin)
    if(zoomNow() < ZOOM_PINS && !selected && !live && !here){
      const dot = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5" fill="rgba(0,0,0,.18)"/><circle cx="12" cy="12" r="7" fill="${fill}" stroke="#ffffff" stroke-width="2.5"/></svg>`;
      return { url: svgUrl(dot), scaledSize: new google.maps.Size(22, 22), anchor: new google.maps.Point(11, 11) };
    }
    const ring = (here || live) ? liveColor : '#ffffff';
    const halo = (here || live) ? `<circle cx="32" cy="26" r="22" fill="${here ? 'rgba(255,138,61,.22)' : 'rgba(46,232,77,.22)'}"/>${pulse(liveColor)}` : '';
    const outline = selected ? `<path d="${PIN_BODY}" fill="none" stroke="#0b0f0c" stroke-width="7" stroke-linejoin="round"/>` : '';
    const nowBadge = here ? `<circle cx="17" cy="10" r="9.5" fill="#ff8a3d" stroke="#ffffff" stroke-width="2"/><text x="17" y="14.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" fill="#1a0b02">${now > 9 ? '9+' : now}</text>` : '';
    const badge = live ? `<circle cx="47" cy="10" r="9.5" fill="#2ee84d" stroke="#ffffff" stroke-width="2"/><text x="47" y="14.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="700" fill="#06130a">${riders > 9 ? '9+' : riders}</text>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="68" viewBox="0 0 64 68">`
      + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".55" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`
      + `</defs>`
      + `${halo}<ellipse cx="32" cy="59.5" rx="7" ry="2.4" fill="rgba(0,0,0,.22)"/><ellipse cx="32" cy="59.5" rx="4.5" ry="1.6" fill="rgba(0,0,0,.18)"/>${outline}`
      + `<path d="${PIN_BODY}" fill="${fill}"/><path d="${PIN_BODY}" fill="url(#g)"/>`
      + `<path d="${PIN_BODY}" fill="none" stroke="${ring}" stroke-width="2.6" stroke-linejoin="round"/>`
      + `${iconSvg(type, 21, 15, 22, '#ffffff')}${badge}${nowBadge}</svg>`;
    const w = selected ? 74 : ((live || here) ? 64 : 54);
    const h = Math.round(w * 68 / 64);
    return { url: svgUrl(svg), scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(w / 2, Math.round(h * 58 / 68)), labelOrigin: new google.maps.Point(w / 2, h + 7) };
  }
  // nombre debajo del pin: de cerca, o siempre en el elegido
  function markerLabel(marker, selected){
    // nombres solo en los pines que se ven en pantalla (máx. 40): con todos, el mapa se volvía lento
    const show = selected || (zoomNow() >= ZOOM_LABELS && marker.__inView);
    if(!show) return null;
    let t = String(marker.getTitle() || '');
    if(t.length > 24) t = t.slice(0, 23).trim() + '…';
    return { text: t, className: selected ? 'spotra-pin-label is-selected' : 'spotra-pin-label', color: '#141814', fontSize: selected ? '13px' : '12px', fontWeight: '700' };
  }
  // 18/10/2026: con ~1.900 lugares, cada pin se actualiza solo si cambió algo (antes se redibujaban todos)
  function styleMarker(marker){
    const sel = marker === selectedMarker;
    const r = marker.__riders || 0, nw = marker.__now || 0;
    const key = [marker.__spotraType, sel ? 1 : 0, Math.min(r, 10), Math.min(nw, 10), levelNow(), marker.__inView ? 1 : 0].join('|');
    if(marker.__styleKey === key) return;
    marker.__styleKey = key;
    const icon = markerIcon(marker.__spotraType, sel, r, nw);
    if(marker.__icon !== icon){ marker.__icon = icon; marker.setIcon(icon); }
    const lab = markerLabel(marker, sel);
    const labKey = lab ? lab.text + '|' + lab.className : '';
    if(marker.__labKey !== labKey){ marker.__labKey = labKey; marker.setLabel(lab); }
    const opt = !(r > 0 || nw > 0);   // los que laten no pueden ir "optimizados"
    if((marker.__opt === undefined ? true : marker.__opt) !== opt){ marker.__opt = opt; marker.setOptions({ optimized: opt }); }
    const z = sel ? 999 : (nw > 0 ? 600 : (r > 0 ? 500 : 1));
    if(marker.__z !== z){ marker.__z = z; marker.setZIndex(z); }
  }

  /* ---------- agrupado de pines (clusters) ---------- */
  let clusterer = null;
  function loadClusterLib(){
    if(window.markerClusterer) return Promise.resolve(true);
    if(window.__spotraClusterLoading) return window.__spotraClusterLoading;
    window.__spotraClusterLoading = new Promise(resolve => {
      const sc = document.createElement('script');
      sc.src = 'assets/vendor/markerclusterer-2.5.3.min.js'; // copia fija en nuestro repo (13/10/2026)
      sc.async = true;
      sc.onload = () => resolve(!!window.markerClusterer);
      sc.onerror = () => resolve(false);
      document.head.appendChild(sc);
    });
    return window.__spotraClusterLoading;
  }

  // grupo: anillo con los colores de lo que tiene adentro (proporcional) y el número al centro
  function clusterIcon(count, live, here, ms){
    const txt = count > 999 ? '999+' : String(count);
    const byType = {};
    (ms || []).forEach(m => { const t = m.__spotraType || 'street_spot'; byType[t] = (byType[t] || 0) + 1; });
    const total = Object.values(byType).reduce((a, b) => a + b, 0) || 1;
    const R = 21, C = 2 * Math.PI * R;
    let off = 0, segs = '';
    Object.keys(PIN_FILL).forEach(t => {
      const n = byType[t]; if(!n) return;
      const len = C * n / total;
      segs += `<circle cx="32" cy="32" r="${R}" fill="none" stroke="${PIN_FILL[t]}" stroke-width="6" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 32 32)"/>`;
      off += len;
    });
    const liveRing = (here || live) ? `<circle cx="32" cy="32" r="28.5" fill="none" stroke="${here ? '#ff8a3d' : '#2ee84d'}" stroke-width="3"/>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">`
      + `<circle cx="32" cy="34" r="25.5" fill="rgba(0,0,0,.18)"/><circle cx="32" cy="32" r="25" fill="#ffffff"/>${segs}`
      + `<circle cx="32" cy="32" r="17.5" fill="#0b0f0c"/>${liveRing}`
      + `<text x="32" y="37.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${txt.length > 3 ? 12 : 15}" font-weight="700" fill="#ffffff">${txt}</text></svg>`;
    const size = count > 99 ? 60 : 54;
    return { url: svgUrl(svg), scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size / 2, size / 2) };
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
          icon: clusterIcon(count, (ms || []).some(m => m.__riders > 0), (ms || []).some(m => m.__now > 0), ms),
          zIndex: 400 + count
        })
      }
    });
    return clusterer;
  }

  function applySessionIcons(rerender){
    entries.forEach(e => {
      const r = ridersAt(e.place.id);
      const nw = nowAt(e.place.id);
      e.marker.__riders = r;
      e.marker.__now = nw;
      styleMarker(e.marker);
    });
    if(rerender !== false && clusterer && clusterer.render) clusterer.render();
  }
  window.addEventListener('spotra-presence', applySessionIcons);
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
        + `<span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg></span>`
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
    const prev = selectedMarker;
    selectedMarker = marker || null;
    if(prev && prev !== marker) styleMarker(prev);
    if(marker) styleMarker(marker);
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
    const shareBtn = document.getElementById('spotShareBtn');
    if(shareBtn) shareBtn.style.display = place && place.id && !place.isGoogleResult ? '' : 'none';
    const directions = document.getElementById('spotDirectionsBtn');
    if(type){ type.textContent = place.label || window.SpotraBackend.labelForType(place.type); type.dataset.type = place.type || ''; }
    if(name) name.textContent = place.name;
    if(meta) meta.textContent = place.meta || place.address || '';
    if(cover){
      cover.style.background = `url('${place.imageUrl || 'assets/banners/banner-skatepark-4.webp'}') center/cover`;
      cover.style.boxShadow = 'inset 0 -40px 40px rgba(0,0,0,.3)';
      // visor: mientras cargan las fotos, la portada sola (si es una foto real)
      spvUrls = place.imageUrl ? [place.imageUrl] : [];
      spvCover = 0;
      spvBadge(cover);
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
    if(window.SpotraPresence) window.SpotraPresence.renderForPlace(place);
    if(window.SpotraConditions) window.SpotraConditions.renderForPlace(place);
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
        icon: markerIcon(place.type, false, riders, nowAt(place.id)),
        zIndex: riders > 0 ? 500 : 1
      });
      // ya nace con su ícono y su altura: se anotan para no volver a dibujarlo
      marker.__icon = marker.getIcon();
      marker.__z = riders > 0 ? 500 : 1;
      marker.__spotraType = place.type;
      marker.__riders = riders;
      marker.__now = nowAt(place.id);
      marker.__placeId = place.id;
      styleMarker(marker);
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
    // enlace de un aviso: /?place=ID#map abre ese spot
    let deep = null;
    try { deep = new URLSearchParams(location.search).get('place'); } catch(e){}
    if(deep){
      try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){}
      const di = entries.findIndex(e => e.place.id === deep);
      if(di >= 0){ focusEntry(di); return; }
    }
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

  /* ---------- buscador ----------
     Busca primero en los lugares de SPOTRA (instantáneo y gratis). Para ciudades y direcciones
     usa OpenStreetMap (Nominatim), solo cuando el rider lo pide (Enter o "Buscar en el mapa"). */
  const fold = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let searchTimer = null;
  function tr(t){ return window.SpotraI18n ? window.SpotraI18n.t(t) : t; }

  function localMatches(q){
    const words = fold(q).split(/\s+/).filter(Boolean);
    if(!words.length || !allPlaces) return [];
    const out = [];
    for(const p of allPlaces){
      const name = fold(p.name), hay = name + ' ' + fold(p.city) + ' ' + fold(p.address);
      if(!words.every(w => hay.includes(w))) continue;
      const score = name.startsWith(words[0]) ? 0 : words.every(w => name.includes(w)) ? 1 : 2;
      out.push({ p, score });
      if(out.length > 400) break;
    }
    out.sort((x, y) => x.score - y.score || String(x.p.name).localeCompare(String(y.p.name)));
    return out.slice(0, 8).map(o => o.p);
  }

  function resultsBox(){ return document.getElementById('mapSearchResults'); }
  function closeSearch(){ const r = resultsBox(); if(r){ r.innerHTML = ''; r.hidden = true; } }

  function renderSearch(q, geo){
    const box = resultsBox();
    if(!box) return;
    const local = localMatches(q);
    let html = '';
    local.forEach(p => {
      const { color, glyph } = pinGlyph(p.type);
      const sub = [p.city, p.countryCode || p.country_code].filter(Boolean).join(' · ');
      html += `<button type="button" class="msr-item" data-search-place="${esc(p.id)}"><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg></span><span class="tx"><b>${esc(p.name)}</b><small>${esc(sub)}</small></span></button>`;
    });
    if(geo === 'loading') html += `<div class="msr-note">${esc(tr('Buscando...'))}</div>`;
    else if(Array.isArray(geo)){
      if(!geo.length) html += `<div class="msr-note">${esc(tr('No encontramos ese lugar.'))}</div>`;
      geo.forEach((g, i) => {
        html += `<button type="button" class="msr-item msr-geo" data-search-geo="${i}"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.4"/></svg></span><span class="tx"><b>${esc(g.name)}</b><small>${esc(g.sub)}</small></span></button>`;
      });
    } else {
      html += `<button type="button" class="msr-item msr-more" data-search-geo-go><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></span><span class="tx"><b>${esc(tr('Buscar ciudad o dirección'))}</b><small>«${esc(q)}»</small></span></button>`;
    }
    box.innerHTML = html;
    box.hidden = false;
  }

  let geoResults = [];
  async function geoSearch(q){
    renderSearch(q, 'loading');
    try {
      let lang = 'es';
      try { lang = mapsLang(); } catch(e){}
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=' + encodeURIComponent(lang) + '&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = res.ok ? await res.json() : [];
      geoResults = (data || []).map(d => {
        const parts = String(d.display_name || '').split(', ');
        return { name: parts[0] || d.name || q, sub: parts.slice(1, 4).join(', '), lat: parseFloat(d.lat), lng: parseFloat(d.lon), type: d.addresstype || d.type || '' };
      }).filter(g => Number.isFinite(g.lat) && Number.isFinite(g.lng));
    } catch(e){ geoResults = []; }
    const input = document.getElementById('mapSearchInput');
    if(input && input.value.trim() === q) renderSearch(q, geoResults);
  }

  function goToPlace(id){
    closeSearch();
    const input = document.getElementById('mapSearchInput');
    if(input) input.blur();
    let idx = entries.findIndex(e => e.place.id === id);
    if(idx < 0 && activeType !== 'all'){
      document.querySelectorAll('[data-map-filter]').forEach(b => b.classList.toggle('active', b.dataset.mapFilter === 'all'));
      refresh('all').then(() => { const i = entries.findIndex(e => e.place.id === id); if(i >= 0) focusEntry(i); });
      return;
    }
    if(idx >= 0) focusEntry(idx);
  }

  function goToGeo(i){
    const g = geoResults[i];
    if(!g || !map) return;
    closeSearch();
    const input = document.getElementById('mapSearchInput');
    if(input) input.blur();
    map.panTo({ lat: g.lat, lng: g.lng });
    const city = /city|town|village|municipality|state|county|suburb|neighbourhood/.test(g.type);
    map.setZoom(city ? 13 : 16);
  }

  function setupSearch(){
    const input = document.getElementById('mapSearchInput');
    if(!input || searchBox) return;
    searchBox = true;
    input.setAttribute('enterkeyhint', 'search');
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if(q.length < 2){ closeSearch(); return; }
      searchTimer = setTimeout(() => renderSearch(q), 150);
    });
    input.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ closeSearch(); input.blur(); return; }
      if(e.key !== 'Enter') return;
      e.preventDefault();
      const q = input.value.trim();
      if(q.length < 2) return;
      const local = localMatches(q);
      if(local.length) goToPlace(local[0].id);
      else geoSearch(q);
    });
    document.addEventListener('click', e => {
      const t = e.target;
      let el;
      if((el = t.closest('[data-search-place]'))){ e.preventDefault(); goToPlace(el.dataset.searchPlace); return; }
      if((el = t.closest('[data-search-geo]'))){ e.preventDefault(); goToGeo(parseInt(el.dataset.searchGeo, 10)); return; }
      if(t.closest('[data-search-geo-go]')){ e.preventDefault(); geoSearch(input.value.trim()); return; }
      if(!t.closest('.map-tools')) closeSearch();
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
    // al cruzar los niveles de zoom, los pines pasan de punto a pin y aparecen/desaparecen los nombres
    let lastLevel = -1;
    map.addListener('idle', () => {
      const level = levelNow();
      let changed = level !== lastLevel;
      lastLevel = level;
      // de cerca: marcar qué pines están en pantalla para mostrarles el nombre
      const bounds = level === 2 ? map.getBounds() : null;
      let shown = 0;
      entries.forEach(e => {
        const inView = !!(bounds && shown < 40 && bounds.contains(e.marker.getPosition()) && ++shown);
        if(e.marker.__inView !== inView){ e.marker.__inView = inView; changed = true; }
      });
      if(changed) applySessionIcons(false);
    });
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
    if(event.target.closest('#spotShareBtn') && currentDetail && currentDetail.id){
      event.preventDefault();
      const L = window.SpotraI18n ? window.SpotraI18n.lang() : 'es';
      const p = currentDetail;
      const text = ({ es: `Mirá ${p.name} en SPOTRA`, pt: `Olha ${p.name} no SPOTRA`, en: `Check out ${p.name} on SPOTRA` })[L] || `Mirá ${p.name} en SPOTRA`;
      if(window.spotraShare) window.spotraShare({ title: p.name, text, url: window.spotraPlaceUrl(p.id) });
      return;
    }
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
    if(currentDetail !== place) return; // el rider ya abrió otro spot
    if(!photos.length) return;
    gallery.style.display = 'flex';
    spvUrls = photos.map(p => p.url);
    spvCover = Math.max(0, photos.findIndex(p => p.is_cover || p.url === place.imageUrl));
    spvBadge(document.getElementById('spotCover'));
    const admin = window.SpotraAuth ? await window.SpotraAuth.isAdmin() : false;
    photos.forEach((p, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'spot-gallery-thumb' + (p.is_cover ? ' is-cover' : '');
      thumb.style.backgroundImage = "url('" + p.url + "')";
      thumb.setAttribute('role', 'button');
      thumb.setAttribute('tabindex', '0');
      thumb.setAttribute('aria-label', 'Ver foto ' + (i + 1) + ' de ' + photos.length);
      const show = () => {
        const cover = document.getElementById('spotCover');
        if(cover) cover.style.backgroundImage = "url('" + p.url + "')";
        spvCover = i;
        openPhotoViewer(i);
      };
      thumb.addEventListener('click', show);
      thumb.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); show(); } });
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

  /* ---------- visor de fotos del spot (v21) ----------
     Toca la portada o una miniatura: la foto se ve entera, a pantalla completa.
     Deslizar = otra foto · doble toque = ampliar · Esc / flechas en computadora. */
  let spvUrls = [], spvCover = 0, spvIdx = 0, spvEl = null, spvLastTap = 0;
  const SPV_CSS = `
.spot-detail .cover{position:relative;cursor:zoom-in}
.spv-badge{position:absolute;right:10px;bottom:10px;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(5,9,6,.72);color:#fff;font:600 12px var(--body,'General Sans',sans-serif);pointer-events:none;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.spv-badge svg{width:14px;height:14px}
.spv{position:fixed;inset:0;z-index:9500;display:none;flex-direction:column;background:#000;color:#fff;-webkit-user-select:none;user-select:none}
.spv.open{display:flex}
.spv-top{position:absolute;left:0;right:0;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left));background:linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,0))}
.spv-count{font:600 14px var(--body,'General Sans',sans-serif);letter-spacing:.04em}
.spv-x{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.45);color:#fff;display:grid;place-items:center;cursor:pointer}
.spv-x svg{width:20px;height:20px}
.spv-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.spv-stage img{max-width:100%;max-height:100%;object-fit:contain;display:block;transition:opacity .2s}
.spv-stage.zoom{display:block}
.spv-stage.zoom img{max-width:none;max-height:none;width:220%;cursor:zoom-out}
.spv-nav{position:absolute;top:50%;z-index:2;width:48px;height:48px;margin-top:-24px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.45);color:#fff;display:none;place-items:center;cursor:pointer}
.spv-nav svg{width:22px;height:22px}
.spv-prev{left:max(12px,env(safe-area-inset-left))}
.spv-next{right:max(12px,env(safe-area-inset-right))}
.spv-dots{position:absolute;left:0;right:0;bottom:max(16px,env(safe-area-inset-bottom));z-index:2;display:flex;justify-content:center;gap:6px;pointer-events:none}
.spv-dots span{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.35)}
.spv-dots span.on{width:18px;background:#74ff3a}
.spv button:focus-visible{outline:2px solid #74ff3a;outline-offset:2px}
@media (hover:hover) and (pointer:fine){.spv.multi .spv-nav{display:grid}}
`;
  const SPV_IC = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    photos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>'
  };
  function spvCssOnce(){
    if(document.getElementById('spvCss')) return;
    const st = document.createElement('style');
    st.id = 'spvCss';
    st.textContent = SPV_CSS;
    document.head.appendChild(st);
  }
  function spvBadge(cover){
    if(!cover) return;
    spvCssOnce();
    cover.innerHTML = spvUrls.length ? `<span class="spv-badge">${SPV_IC.photos}${spvUrls.length}</span>` : '';
    if(spvUrls.length){
      cover.setAttribute('role', 'button');
      cover.setAttribute('tabindex', '0');
      cover.setAttribute('aria-label', spvUrls.length > 1 ? 'Ver las ' + spvUrls.length + ' fotos' : 'Ver foto');
      cover.style.cursor = '';
    } else {
      cover.removeAttribute('role');
      cover.removeAttribute('tabindex');
      cover.removeAttribute('aria-label');
      cover.style.cursor = 'default';
    }
  }
  function spvEnsure(){
    if(spvEl) return spvEl;
    spvCssOnce();
    spvEl = document.createElement('div');
    spvEl.className = 'spv';
    spvEl.setAttribute('role', 'dialog');
    spvEl.setAttribute('aria-modal', 'true');
    spvEl.setAttribute('aria-label', 'Fotos del spot');
    spvEl.innerHTML = `<div class="spv-top"><span class="spv-count" aria-live="polite"></span><button type="button" class="spv-x" aria-label="Cerrar">${SPV_IC.x}</button></div>
      <div class="spv-stage"><img alt="Foto del spot" draggable="false"></div>
      <button type="button" class="spv-nav spv-prev" aria-label="Foto anterior">${SPV_IC.prev}</button>
      <button type="button" class="spv-nav spv-next" aria-label="Foto siguiente">${SPV_IC.next}</button>
      <div class="spv-dots" aria-hidden="true"></div>`;
    document.body.appendChild(spvEl);
    const stage = spvEl.querySelector('.spv-stage');
    spvEl.querySelector('.spv-x').addEventListener('click', closePhotoViewer);
    spvEl.querySelector('.spv-prev').addEventListener('click', () => spvGo(-1));
    spvEl.querySelector('.spv-next').addEventListener('click', () => spvGo(1));
    // tocar el fondo negro (fuera de la foto) cierra
    stage.addEventListener('click', e => { if(e.target === stage && !stage.classList.contains('zoom')) closePhotoViewer(); });
    stage.addEventListener('dblclick', e => { e.preventDefault(); spvZoom(e); });
    let sx = 0, sy = 0, moved = false;
    stage.addEventListener('touchstart', e => {
      if(e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false;
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      const t = e.touches[0]; if(!t) return;
      if(Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) moved = true;
    }, { passive: true });
    stage.addEventListener('touchend', e => {
      const t = e.changedTouches[0]; if(!t) return;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if(!stage.classList.contains('zoom') && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3){ spvGo(dx < 0 ? 1 : -1); return; }
      if(!moved && e.target.tagName === 'IMG'){
        const now = Date.now();
        if(now - spvLastTap < 300){ e.preventDefault(); spvZoom({ clientX: t.clientX, clientY: t.clientY }); spvLastTap = 0; }
        else spvLastTap = now;
      }
    });
    return spvEl;
  }
  function spvZoom(e){
    const stage = spvEl.querySelector('.spv-stage');
    const img = stage.querySelector('img');
    if(stage.classList.contains('zoom')){ stage.classList.remove('zoom'); stage.scrollTo(0, 0); return; }
    const r = img.getBoundingClientRect();
    const fx = r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : .5;
    const fy = r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : .5;
    stage.classList.add('zoom');
    requestAnimationFrame(() => {
      stage.scrollLeft = fx * img.offsetWidth - stage.clientWidth / 2;
      stage.scrollTop = fy * img.offsetHeight - stage.clientHeight / 2;
    });
  }
  function spvShow(){
    const n = spvUrls.length;
    const stage = spvEl.querySelector('.spv-stage');
    stage.classList.remove('zoom');
    const img = stage.querySelector('img');
    img.style.opacity = '0';
    img.onload = () => { img.style.opacity = '1'; };
    img.src = spvUrls[spvIdx];
    if(img.complete) img.style.opacity = '1';
    spvEl.classList.toggle('multi', n > 1);
    spvEl.querySelector('.spv-count').textContent = n > 1 ? (spvIdx + 1) + ' / ' + n : '';
    spvEl.querySelector('.spv-dots').innerHTML = n > 1 ? spvUrls.map((_, i) => `<span class="${i === spvIdx ? 'on' : ''}"></span>`).join('') : '';
    // precargar la anterior y la siguiente
    [spvIdx - 1, spvIdx + 1].forEach(i => { if(i >= 0 && i < n){ const pre = new Image(); pre.src = spvUrls[i]; } });
  }
  function spvGo(step){
    const n = spvUrls.length;
    if(n < 2) return;
    spvIdx = (spvIdx + step + n) % n;
    spvShow();
  }
  function spvKey(e){
    if(!spvEl || !spvEl.classList.contains('open')) return;
    if(e.key === 'Escape'){ e.preventDefault(); closePhotoViewer(); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); spvGo(1); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); spvGo(-1); }
  }
  let spvPrevFocus = null;
  function openPhotoViewer(idx){
    if(!spvUrls.length) return;
    spvEnsure();
    spvIdx = Math.min(Math.max(0, idx || 0), spvUrls.length - 1);
    spvPrevFocus = document.activeElement;
    spvShow();
    spvEl.classList.add('open');
    document.addEventListener('keydown', spvKey, true);
    setTimeout(() => { try { spvEl.querySelector('.spv-x').focus({ preventScroll: true }); } catch(e){} }, 30);
  }
  function closePhotoViewer(){
    if(!spvEl) return;
    spvEl.classList.remove('open');
    document.removeEventListener('keydown', spvKey, true);
    try { if(spvPrevFocus && spvPrevFocus.focus) spvPrevFocus.focus({ preventScroll: true }); } catch(e){}
  }
  document.addEventListener('click', e => {
    const cover = e.target.closest && e.target.closest('#spotCover');
    if(cover && spvUrls.length) openPhotoViewer(spvCover);
  });
  document.addEventListener('keydown', e => {
    if((e.key === 'Enter' || e.key === ' ') && e.target && e.target.id === 'spotCover' && spvUrls.length){ e.preventDefault(); openPhotoViewer(spvCover); }
  });

  window.SpotraMaps = { init, refresh, setFilter, ensureApi: loadGoogleMaps, compressImage, current: () => currentDetail, center: () => { const c = map && map.getCenter ? map.getCenter() : null; return c ? { lat: c.lat(), lng: c.lng() } : null; }, openPlaceById, openDetail, closeDetail };
})();
