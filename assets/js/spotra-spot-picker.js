/* SPOTRA · Selector de ubicación para crear spots (mini-mapa + usar mi ubicación) */
(function(){
  let map, marker, inited = false;
  const DARK = [
    { elementType:'geometry', stylers:[{color:'#0c1014'}] },
    { elementType:'labels.text.fill', stylers:[{color:'#5b6b63'}] },
    { elementType:'labels.text.stroke', stylers:[{color:'#0c1014'}] },
    { featureType:'road', elementType:'geometry', stylers:[{color:'#1a2420'}] },
    { featureType:'water', elementType:'geometry', stylers:[{color:'#0a1f16'}] },
    { featureType:'poi', stylers:[{visibility:'off'}] }
  ];
  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function setLL(lat, lng){
    const a = document.getElementById('spotLat'), b = document.getElementById('spotLng');
    if(a) a.value = Number(lat).toFixed(7);
    if(b) b.value = Number(lng).toFixed(7);
  }
  async function ensureApi(){
    if(window.google && window.google.maps) return true;
    if(window.SpotraMaps && window.SpotraMaps.ensureApi){
      try { return await window.SpotraMaps.ensureApi(); } catch(e){ return false; }
    }
    return false;
  }
  async function init(){
    const el = document.getElementById('spotPickMap');
    if(!el) return;
    if(!(await ensureApi())){
      el.innerHTML = '<div style="padding:18px;color:#9aa6a0;font-size:13px">No se pudo cargar el mapa. Revisá tu conexión e intentá de nuevo.</div>';
      return;
    }
    const center = { lat:-34.9011, lng:-56.1645 };
    map = new google.maps.Map(el, {
      center, zoom:13, disableDefaultUI:true, zoomControl:true,
      gestureHandling:'greedy', clickableIcons:false, styles:DARK
    });
    marker = new google.maps.Marker({ position:center, map, draggable:true });
    setLL(center.lat, center.lng);
    marker.addListener('dragend', () => { const p = marker.getPosition(); setLL(p.lat(), p.lng()); });
    map.addListener('click', (e) => { marker.setPosition(e.latLng); setLL(e.latLng.lat(), e.latLng.lng()); });
    inited = true;
  }
  function show(){
    if(!inited){ init(); return; }
    setTimeout(() => { if(map){ google.maps.event.trigger(map, 'resize'); map.setCenter(marker.getPosition()); } }, 250);
  }
  function useMyLocation(){
    if(!navigator.geolocation){ toast('Tu dispositivo no permite ubicación.'); return; }
    toast('Buscando tu ubicación...');
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = { lat:pos.coords.latitude, lng:pos.coords.longitude };
      if(map && marker){
        map.setCenter(ll); map.setZoom(16); marker.setPosition(ll); setLL(ll.lat, ll.lng);
        toast('Ubicación marcada. Ajustá el pin si hace falta.');
      }
    }, () => {
      toast('No pudimos obtener tu ubicación. Marcá el punto tocando el mapa.');
    }, { enableHighAccuracy:true, timeout:9000 });
  }
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-open-modal="spot"]')) setTimeout(show, 400);
    if(e.target.closest('#spotUseLoc')){ e.preventDefault(); useMyLocation(); }
  });
})();
