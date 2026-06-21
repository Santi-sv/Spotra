(function(){
  const cfg = Object.assign({
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    DEFAULT_CENTER: { lat: -34.9011, lng: -56.1645 },
    MOCK_MODE: true
  }, window.SPOTRA_CONFIG || {});

  const seedPlaces = [
    {
      id: 'rivadavia',
      type: 'skatepark',
      label: 'Skatepark',
      name: 'Parque Rivadavia',
      meta: 'Caballito, CABA · Skatepark verificado',
      city: 'Buenos Aires',
      countryCode: 'AR',
      address: 'Caballito, Buenos Aires',
      lat: -34.6186,
      lng: -58.4356,
      imageUrl: 'assets/banners/banner-skatepark-4.webp',
      stats: ['86', '18', 'OK']
    },
    {
      id: 'italia',
      type: 'street_spot',
      label: 'Spot',
      name: 'Plaza Italia',
      meta: 'Palermo, CABA · Street spot',
      city: 'Buenos Aires',
      countryCode: 'AR',
      address: 'Palermo, Buenos Aires',
      lat: -34.5807,
      lng: -58.4205,
      imageUrl: 'assets/spots/spot-5.webp',
      stats: ['74', '9', 'OK']
    },
    {
      id: 'palermo',
      type: 'event_venue',
      label: 'Evento',
      name: 'Bowl Palermo',
      meta: 'Palermo, CABA · Competencia este sábado',
      city: 'Buenos Aires',
      countryCode: 'AR',
      address: 'Palermo, Buenos Aires',
      lat: -34.5722,
      lng: -58.4304,
      imageUrl: 'assets/spots/spot-6.webp',
      stats: ['91', '24', 'OK']
    },
    {
      id: 'caballito',
      type: 'street_spot',
      label: 'Spot',
      name: 'Ledges Caballito',
      meta: 'Caballito, CABA · Street spot',
      city: 'Buenos Aires',
      countryCode: 'AR',
      address: 'Caballito, Buenos Aires',
      lat: -34.6238,
      lng: -58.4428,
      imageUrl: 'assets/spots/spot-8.webp',
      stats: ['58', '4', 'OK']
    },
    {
      id: 'boedo',
      type: 'store',
      label: 'Tienda',
      name: 'Underground Boedo',
      meta: 'Boedo, CABA · Tienda verificada',
      city: 'Buenos Aires',
      countryCode: 'AR',
      address: 'Boedo, Buenos Aires',
      lat: -34.6316,
      lng: -58.4171,
      imageUrl: 'assets/tiendas/interior-tienda.webp',
      stats: ['15%', 'ON', 'OK']
    }
  ];

  let supabaseClient;
  let supabaseLoadPromise;

  function isSupabaseReady(){
    return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.MOCK_MODE);
  }

  async function loadSupabase(){
    if(!isSupabaseReady()) return null;
    if(window.supabase) return true;
    if(!supabaseLoadPromise){
      supabaseLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => resolve(true);
        script.onerror = reject;
        document.head.appendChild(script);
      }).catch(error => {
        console.warn('[SPOTRA] Supabase JS unavailable:', error);
        return false;
      });
    }
    return supabaseLoadPromise;
  }

  async function client(){
    const loaded = await loadSupabase();
    if(!loaded || !window.supabase) return null;
    if(!supabaseClient){
      supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          // Safari de iOS a veces cuelga con el lock de navigator.locks: lo hacemos pass-through
          lock: async (_name, _timeout, fn) => await fn()
        }
      });
    }
    return supabaseClient;
  }

  function normalizeType(type){
    return {
      skatepark: 'skatepark',
      spot: 'street_spot',
      street: 'street_spot',
      'street spot': 'street_spot',
      street_spot: 'street_spot',
      store: 'store',
      tienda: 'store',
      event: 'event_venue',
      evento: 'event_venue',
      event_venue: 'event_venue'
    }[String(type || '').toLowerCase()] || type || 'street_spot';
  }

  function labelForType(type){
    return {
      skatepark: 'Skatepark',
      street_spot: 'Spot',
      store: 'Tienda',
      event_venue: 'Evento'
    }[type] || 'Spot';
  }

  function normalizePlace(row){
    const type = normalizeType(row.type);
    const lat = Number(row.latitude ?? row.lat);
    const lng = Number(row.longitude ?? row.lng);
    const address = row.address || row.meta || '';
    const city = row.city || '';
    const countryCode = row.country_code || row.countryCode || '';
    const meta = row.meta || [city, address].filter(Boolean).join(' · ') || labelForType(type);
    return {
      id: row.id,
      type,
      label: row.label || labelForType(type),
      name: row.name,
      meta,
      city,
      countryCode,
      address,
      lat,
      lng,
      googlePlaceId: row.google_place_id || row.googlePlaceId || '',
      imageUrl: row.image_url || row.imageUrl || 'assets/banners/banner-skatepark-4.webp',
      rating: row.rating,
      stats: row.stats || ['--', '--', 'OK'],
      directionsUrl: googleDirectionsUrl({
        lat,
        lng,
        name: row.name,
        googlePlaceId: row.google_place_id || row.googlePlaceId
      })
    };
  }

  function googleDirectionsUrl(place){
    const query = place.lat && place.lng
      ? `${place.lat},${place.lng}`
      : encodeURIComponent(place.name || 'SPOTRA spot');
    const placeId = place.googlePlaceId ? `&query_place_id=${encodeURIComponent(place.googlePlaceId)}` : '';
    return `https://www.google.com/maps/search/?api=1&query=${query}${placeId}`;
  }

  function localSubmissions(){
    try { return JSON.parse(localStorage.getItem('spotraPlaceSubmissions') || '[]'); }
    catch { return []; }
  }

  function saveLocalSubmission(payload){
    const item = Object.assign({
      id: `local-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    }, payload);
    try {
      const list = localSubmissions();
      list.unshift(item);
      localStorage.setItem('spotraPlaceSubmissions', JSON.stringify(list.slice(0, 50)));
    } catch {}
    return item;
  }

  async function listPlaces(options = {}){
    const type = normalizeType(options.type || 'all');
    const db = await client();
    if(db){
      let query = db
        .from('places')
        .select('id, google_place_id, type, name, description, city, country_code, address, latitude, longitude, image_url, rating, updated_at')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(120);
      if(type !== 'all') query = query.eq('type', type);
      const { data, error } = await query;
      if(!error && Array.isArray(data)) return data.map(normalizePlace);
      console.warn('[SPOTRA] Supabase places fallback:', error);
    }
    return seedPlaces.filter(place => type === 'all' || place.type === type).map(normalizePlace);
  }

  async function createPlaceSubmission(payload){
    const mapped = {
      candidate_google_place_id: payload.googlePlaceId || null,
      type: normalizeType(payload.type),
      name: payload.name,
      description: payload.description || null,
      country_code: payload.countryCode || cfg.DEFAULT_COUNTRY || null,
      city: payload.city || null,
      address: payload.address || payload.locationLabel || null,
      latitude: payload.lat ?? null,
      longitude: payload.lng ?? null,
      image_url: payload.imageUrl || null,
      google_payload: payload.googlePayload || {}
    };
    const db = await client();
    if(db){
      const { data: authData } = await db.auth.getUser();
      if(!authData?.user?.id) return { mode: 'local', data: saveLocalSubmission(Object.assign({}, payload, mapped)) };
      mapped.submitted_by = authData.user.id;
      const { data, error } = await db
        .from('place_submissions')
        .insert(mapped)
        .select()
        .single();
      if(!error) return { mode: 'supabase', data };
      console.warn('[SPOTRA] Supabase submission fallback:', error);
    }
    return { mode: 'local', data: saveLocalSubmission(Object.assign({}, payload, mapped)) };
  }

  async function listSubmissions(){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db
      .from('place_submissions')
      .select('id, candidate_google_place_id, type, name, description, country_code, city, address, latitude, longitude, image_url, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if(error){ console.warn('[SPOTRA] listSubmissions:', error.message); return []; }
    return (data || []).map(row => ({
      id: row.id,
      type: normalizeType(row.type),
      label: labelForType(normalizeType(row.type)),
      name: row.name,
      address: row.address || [row.city, row.country_code].filter(Boolean).join(', ') || 'Sin ubicación',
      city: row.city || '',
      countryCode: row.country_code || '',
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      imageUrl: row.image_url || 'assets/banners/banner-skatepark-4.webp',
      googlePlaceId: row.candidate_google_place_id || '',
      createdAt: row.created_at
    }));
  }

  async function reviewSubmission(id, decision){    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    if(decision === 'approved'){
      const { error } = await db.rpc('approve_submission', { submission_id: id });
      if(error){ console.warn('[SPOTRA] approve:', error.message); return { ok: false, error: error.message }; }
      return { ok: true };
    }
    const { error } = await db.rpc('reject_submission', { submission_id: id, notes: null });
    if(error){ console.warn('[SPOTRA] reject:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function setSubmissionLocation(id, lat, lng){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { error } = await db.rpc('set_submission_location', { submission_id: id, lat: lat, lng: lng });
    if(error){ console.warn('[SPOTRA] set location:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function uploadSpotImage(blob, ext){
    const db = await client();
    if(!db) return { ok:false, error:'sin conexión' };
    const { data: u } = await db.auth.getUser();
    if(!(u && u.user)) return { ok:false, error:'iniciá sesión' };
    const rand = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
    const path = 'submissions/' + rand + '.' + ext;
    const up = await db.storage.from('place-images').upload(path, blob, { contentType: blob.type, upsert:false });
    if(up.error) return { ok:false, error: up.error.message };
    const { data: pub } = db.storage.from('place-images').getPublicUrl(path);
    return { ok:true, url: pub.publicUrl };
  }

  /* ---------- fotos de lugares (galería) ---------- */
  async function uploadPlacePhoto(placeId, blob, ext){
    const db = await client();
    if(!db) return { ok:false, error:'sin conexión' };
    const { data: u } = await db.auth.getUser();
    const user = u && u.user;
    if(!user) return { ok:false, error:'iniciá sesión' };
    const rand = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
    const path = placeId + '/' + rand + '.' + ext;
    const up = await db.storage.from('place-images').upload(path, blob, { contentType: blob.type, upsert:false });
    if(up.error) return { ok:false, error: up.error.message };
    const { data: pub } = db.storage.from('place-images').getPublicUrl(path);
    const url = pub.publicUrl;
    const { error } = await db.from('place_photos').insert({ place_id: placeId, url, uploaded_by: user.id, status:'pending' });
    if(error) return { ok:false, error: error.message };
    return { ok:true, url };
  }

  async function listPlacePhotos(placeId){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db.from('place_photos')
      .select('id, url, is_cover, status')
      .eq('place_id', placeId).eq('status','approved')
      .order('is_cover', { ascending:false }).order('created_at', { ascending:true });
    if(error){ console.warn('[SPOTRA] listPlacePhotos:', error.message); return []; }
    return data || [];
  }

  async function listPendingPhotos(){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db.from('place_photos')
      .select('id, url, created_at, place_id, places(name, type)')
      .eq('status','pending').order('created_at', { ascending:false }).limit(100);
    if(error){ console.warn('[SPOTRA] listPendingPhotos:', error.message); return []; }
    return (data || []).map(r => ({
      id: r.id, url: r.url, placeId: r.place_id,
      placeName: r.places ? r.places.name : 'Lugar',
      placeType: r.places ? normalizeType(r.places.type) : ''
    }));
  }

  async function reviewPhoto(id, decision){
    const db = await client();
    if(!db) return { ok:false, error:'sin conexión' };
    const fn = decision === 'approved' ? 'approve_place_photo' : 'reject_place_photo';
    const { error } = await db.rpc(fn, { photo_id: id });
    if(error){ console.warn('[SPOTRA] reviewPhoto:', error.message); return { ok:false, error:error.message }; }
    return { ok:true };
  }

  async function setPlaceCover(photoId){
    const db = await client();
    if(!db) return { ok:false, error:'sin conexión' };
    const { error } = await db.rpc('set_place_cover', { photo_id: photoId });
    if(error){ console.warn('[SPOTRA] setPlaceCover:', error.message); return { ok:false, error:error.message }; }
    return { ok:true };
  }

  window.SpotraBackend = {
    config: cfg,
    getClient: client,
    isSupabaseReady,
    listPlaces,
    createPlaceSubmission,
    listSubmissions,
    reviewSubmission,
    setSubmissionLocation,
    uploadSpotImage,
    uploadPlacePhoto,
    listPlacePhotos,
    listPendingPhotos,
    reviewPhoto,
    setPlaceCover,
    normalizeType,
    labelForType,
    googleDirectionsUrl,
    seedPlaces: seedPlaces.map(normalizePlace)
  };
})();
