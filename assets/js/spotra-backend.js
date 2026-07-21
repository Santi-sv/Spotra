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
      description: row.description || '',
      contactPhone: row.contact_phone || row.contactPhone || '',
      website: row.website || '',
      instagram: row.instagram || '',
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
        .select('id, google_place_id, type, name, description, city, country_code, address, latitude, longitude, image_url, rating, contact_phone, website, instagram, updated_at')
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


  /* ===== Eventos ===== */
  function normalizeEvent(row){
    const place = row.places || {};
    return {
      id: row.id,
      placeId: row.place_id,
      title: row.title,
      description: row.description || '',
      startsAt: row.starts_at ? new Date(row.starts_at) : null,
      discipline: row.discipline || 'todas',
      imageUrl: row.image_url || '',
      placeName: place.name || '',
      placeCity: place.city || '',
      placeAddress: place.address || '',
      placeLat: Number(place.latitude),
      placeLng: Number(place.longitude),
      registrationInfo: row.registration_info || '',
      prizes: row.prizes || '',
      categories: Array.isArray(row.categories) ? row.categories : [],
      capacity: row.capacity || null,
      closesAt: row.closes_at ? new Date(row.closes_at) : null,
      contactPhone: row.contact_phone || '',
      rainReschedule: !!row.rain_reschedule,
      organizerId: row.organizer_id || null,
      status: row.status || 'approved',
      regCount: Array.isArray(row.event_registrations) && row.event_registrations[0] ? Number(row.event_registrations[0].count) || 0 : 0,
      createdAt: row.created_at || null
    };
  }

  async function listEvents(options = {}){
    const db = await client();
    if(!db) return [];
    let query = db
      .from('events')
      .select('id, place_id, title, description, starts_at, image_url, created_at, discipline, registration_info, prizes, categories, capacity, closes_at, contact_phone, rain_reschedule, organizer_id, places(name, city, address, latitude, longitude), event_registrations(count)')
      .eq('status', 'approved')
      .gte('starts_at', new Date(Date.now() - 3 * 3600 * 1000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(options.limit || 30);
    if(options.placeId) query = query.eq('place_id', options.placeId);
    const { data, error } = await query;
    if(error){ console.warn('[SPOTRA] listEvents:', error.message); return []; }
    return (data || []).map(normalizeEvent);
  }

  async function createEvent(payload){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    const { error } = await db.from('events').insert({
      place_id: payload.placeId,
      title: payload.title,
      description: payload.description || null,
      starts_at: payload.startsAt,
      discipline: payload.discipline || 'todas',
      registration_info: payload.registrationInfo || null,
      prizes: payload.prizes || null,
      categories: Array.isArray(payload.categories) ? payload.categories : [],
      capacity: payload.capacity || null,
      closes_at: payload.closesAt || null,
      contact_phone: payload.contactPhone || null,
      rain_reschedule: !!payload.rainReschedule,
      organizer_id: authData.user.id,
      status: 'pending'
    });
    if(error){ console.warn('[SPOTRA] createEvent:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function listPendingEvents(){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db
      .from('events')
      .select('id, place_id, title, description, starts_at, image_url, created_at, discipline, registration_info, prizes, categories, capacity, closes_at, contact_phone, rain_reschedule, organizer_id, places(name, city, address, latitude, longitude), event_registrations(count)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if(error){ console.warn('[SPOTRA] listPendingEvents:', error.message); return []; }
    return (data || []).map(normalizeEvent);
  }

  async function reviewEvent(id, decision){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const status = decision === 'approved' ? 'approved' : 'rejected';
    const { error } = await db.from('events').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if(error){ console.warn('[SPOTRA] reviewEvent:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }


  async function getUserId(){
    const db = await client();
    if(!db) return null;
    const { data } = await db.auth.getUser();
    return data?.user?.id || null;
  }

  async function registerToEvent(eventId, categories){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    let username = '';
    const { data: prof } = await db.from('profiles').select('username, full_name').eq('id', authData.user.id).single();
    if(prof) username = prof.username || prof.full_name || '';
    const { error } = await db.from('event_registrations').insert({
      event_id: eventId,
      profile_id: authData.user.id,
      username,
      categories: Array.isArray(categories) ? categories : []
    });
    if(error){
      if(String(error.code) === '23505') return { ok: false, error: 'ya-inscripto' };
      console.warn('[SPOTRA] registerToEvent:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  async function unregisterFromEvent(eventId){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    const { error } = await db.from('event_registrations').delete().eq('event_id', eventId).eq('profile_id', authData.user.id);
    if(error){ console.warn('[SPOTRA] unregister:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function listMyRegistrations(){
    const db = await client();
    if(!db) return [];
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return [];
    const { data, error } = await db
      .from('event_registrations')
      .select('event_id, categories, events(id, place_id, title, description, starts_at, image_url, created_at, discipline, registration_info, prizes, categories, capacity, closes_at, contact_phone, rain_reschedule, organizer_id, status, places(name, city, address, latitude, longitude), event_registrations(count))')
      .eq('profile_id', authData.user.id);
    if(error){ console.warn('[SPOTRA] listMyRegistrations:', error.message); return []; }
    return (data || [])
      .filter(r => r.events)
      .map(r => ({ myCategories: Array.isArray(r.categories) ? r.categories : [], event: normalizeEvent(r.events) }));
  }

  async function listMyOrganizedEvents(){
    const db = await client();
    if(!db) return [];
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return [];
    const { data, error } = await db
      .from('events')
      .select('id, place_id, title, description, starts_at, image_url, created_at, discipline, registration_info, prizes, categories, capacity, closes_at, contact_phone, rain_reschedule, organizer_id, status, places(name, city, address, latitude, longitude), event_registrations(count)')
      .eq('organizer_id', authData.user.id)
      .order('starts_at', { ascending: true })
      .limit(50);
    if(error){ console.warn('[SPOTRA] listMyOrganizedEvents:', error.message); return []; }
    return (data || []).map(normalizeEvent);
  }

  async function listEventRegistrations(eventId){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db
      .from('event_registrations')
      .select('profile_id, username, categories, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
      .limit(300);
    if(error){ console.warn('[SPOTRA] listEventRegistrations:', error.message); return []; }
    return data || [];
  }


  async function organizerUpdateEvent(payload){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { error } = await db.rpc('organizer_update_event', {
      p_event_id: payload.id,
      p_title: payload.title,
      p_starts_at: payload.startsAt,
      p_description: payload.description || null,
      p_discipline: payload.discipline || 'todas',
      p_categories: Array.isArray(payload.categories) ? payload.categories : [],
      p_registration_info: payload.registrationInfo || null,
      p_prizes: payload.prizes || null,
      p_capacity: payload.capacity || null,
      p_closes_at: payload.closesAt || null,
      p_contact_phone: payload.contactPhone || null,
      p_rain: !!payload.rainReschedule,
      p_place_id: payload.placeId || null
    });
    if(error){ console.warn('[SPOTRA] organizerUpdateEvent:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function organizerCancelEvent(id){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { error } = await db.rpc('organizer_cancel_event', { p_event_id: id });
    if(error){ console.warn('[SPOTRA] organizerCancelEvent:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }


  async function saveEventResults(eventId, category, podium){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { error } = await db.rpc('save_event_results', {
      p_event_id: eventId,
      p_category: category || 'General',
      p_first: podium[0] || null,
      p_second: podium[1] || null,
      p_third: podium[2] || null
    });
    if(error){ console.warn('[SPOTRA] saveEventResults:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function listEventResults(eventId){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db
      .from('event_results')
      .select('category, username, position, points, discipline')
      .eq('event_id', eventId)
      .order('category', { ascending: true })
      .order('position', { ascending: true });
    if(error){ console.warn('[SPOTRA] listEventResults:', error.message); return []; }
    return data || [];
  }

  async function listRanking(discipline){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db
      .from('rider_rankings')
      .select('username, total_points, golds, podiums')
      .eq('discipline', discipline)
      .order('total_points', { ascending: false })
      .limit(50);
    if(error){ console.warn('[SPOTRA] listRanking:', error.message); return []; }
    return data || [];
  }


  /* ===== Marketplace (usados entre riders) ===== */
  function normalizeListing(row){
    return {
      id: row.id,
      sellerId: row.seller_id,
      username: row.username || 'rider',
      whatsapp: row.whatsapp || '',
      title: row.title,
      description: row.description || '',
      category: row.category || 'otros',
      condition: row.condition || 'bueno',
      price: Number(row.price),
      currency: row.currency || 'UYU',
      city: row.city || '',
      lat: row.latitude != null ? Number(row.latitude) : null,
      lng: row.longitude != null ? Number(row.longitude) : null,
      photos: Array.isArray(row.photos) ? row.photos : [],
      status: row.status || 'pending',
      sold: !!row.sold,
      createdAt: row.created_at ? new Date(row.created_at) : null
    };
  }

  const LISTING_COLS = 'id, seller_id, username, whatsapp, title, description, category, condition, price, currency, city, latitude, longitude, photos, status, sold, created_at';

  async function listListings(options = {}){
    const db = await client();
    if(!db) return [];
    let query = db.from('listings').select(LISTING_COLS)
      .eq('status', 'approved').eq('sold', false)
      .order('created_at', { ascending: false })
      .limit(options.limit || 100);
    if(options.category && options.category !== 'all') query = query.eq('category', options.category);
    const { data, error } = await query;
    if(error){ console.warn('[SPOTRA] listListings:', error.message); return []; }
    return (data || []).map(normalizeListing);
  }

  async function listMyListings(){
    const db = await client();
    if(!db) return [];
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return [];
    const { data, error } = await db.from('listings').select(LISTING_COLS)
      .eq('seller_id', authData.user.id)
      .order('created_at', { ascending: false }).limit(100);
    if(error){ console.warn('[SPOTRA] listMyListings:', error.message); return []; }
    return (data || []).map(normalizeListing);
  }

  async function createListing(payload){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    let username = '';
    const { data: prof } = await db.from('profiles').select('username, full_name').eq('id', authData.user.id).single();
    if(prof) username = prof.username || prof.full_name || '';
    const { error } = await db.from('listings').insert({
      seller_id: authData.user.id,
      username,
      whatsapp: payload.whatsapp,
      title: payload.title,
      description: payload.description || null,
      category: payload.category,
      condition: payload.condition,
      price: payload.price,
      currency: payload.currency,
      city: payload.city || null,
      latitude: payload.lat != null ? payload.lat : null,
      longitude: payload.lng != null ? payload.lng : null,
      photos: Array.isArray(payload.photos) ? payload.photos : [],
      status: 'pending'
    });
    if(error){ console.warn('[SPOTRA] createListing:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function markListingSold(id){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { error } = await db.rpc('mark_listing_sold', { p_listing_id: id });
    if(error){ console.warn('[SPOTRA] markListingSold:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function deleteListing(id){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { error } = await db.from('listings').delete().eq('id', id);
    if(error){ console.warn('[SPOTRA] deleteListing:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function listPendingListings(){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db.from('listings').select(LISTING_COLS)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(100);
    if(error){ console.warn('[SPOTRA] listPendingListings:', error.message); return []; }
    return (data || []).map(normalizeListing);
  }

  async function reviewListing(id, decision){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const status = decision === 'approved' ? 'approved' : 'rejected';
    const { error } = await db.from('listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if(error){ console.warn('[SPOTRA] reviewListing:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function uploadListingImage(blob, ext){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: u } = await db.auth.getUser();
    if(!(u && u.user)) return { ok: false, error: 'iniciá sesión' };
    const rand = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
    const path = 'listings/' + rand + '.' + ext;
    const up = await db.storage.from('place-images').upload(path, blob, { contentType: blob.type, upsert: false });
    if(up.error) return { ok: false, error: up.error.message };
    const { data: pub } = db.storage.from('place-images').getPublicUrl(path);
    return { ok: true, url: pub.publicUrl };
  }


  /* ===== Foro ===== */
  function normalizePost(row){
    return {
      id: row.id,
      authorId: row.author_id,
      username: row.username || 'rider',
      avatarUrl: row.avatar_url || '',
      content: row.content || '',
      imageUrl: row.image_url || '',
      createdAt: row.created_at ? new Date(row.created_at) : null,
      likes: Array.isArray(row.post_likes) && row.post_likes[0] ? Number(row.post_likes[0].count) || 0 : 0,
      comments: Array.isArray(row.post_comments) && row.post_comments[0] ? Number(row.post_comments[0].count) || 0 : 0,
      likedByMe: false
    };
  }

  async function listPosts(options = {}){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db
      .from('posts')
      .select('id, author_id, username, avatar_url, content, image_url, created_at, post_likes(count), post_comments(count)')
      .order('created_at', { ascending: false })
      .limit(options.limit || 40);
    if(error){ console.warn('[SPOTRA] listPosts:', error.message); return []; }
    const posts = (data || []).map(normalizePost);
    const { data: authData } = await db.auth.getUser();
    if(authData?.user?.id && posts.length){
      const { data: likes } = await db
        .from('post_likes')
        .select('post_id')
        .eq('profile_id', authData.user.id)
        .in('post_id', posts.map(p => p.id));
      const mine = new Set((likes || []).map(l => l.post_id));
      posts.forEach(p => { p.likedByMe = mine.has(p.id); });
    }
    return posts;
  }

  async function createPost(payload){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    let username = '', avatar = '';
    const { data: prof } = await db.from('profiles').select('username, full_name, avatar_url').eq('id', authData.user.id).single();
    if(prof){ username = prof.username || prof.full_name || ''; avatar = prof.avatar_url || ''; }
    const { error } = await db.from('posts').insert({
      author_id: authData.user.id,
      username,
      avatar_url: avatar,
      content: payload.content,
      image_url: payload.imageUrl || null
    });
    if(error){ console.warn('[SPOTRA] createPost:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function deletePost(id){
    const db = await client();
    if(!db) return { ok: false };
    const { error } = await db.from('posts').delete().eq('id', id);
    if(error){ console.warn('[SPOTRA] deletePost:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function togglePostLike(postId, liked){
    const db = await client();
    if(!db) return { ok: false };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    const uid = authData.user.id;
    const { error } = liked
      ? await db.from('post_likes').delete().eq('post_id', postId).eq('profile_id', uid)
      : await db.from('post_likes').insert({ post_id: postId, profile_id: uid });
    if(error && String(error.code) !== '23505'){ console.warn('[SPOTRA] togglePostLike:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function listPostComments(postId){
    const db = await client();
    if(!db) return [];
    const { data, error } = await db
      .from('post_comments')
      .select('id, author_id, username, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(100);
    if(error){ console.warn('[SPOTRA] listPostComments:', error.message); return []; }
    return data || [];
  }

  async function addPostComment(postId, content){
    const db = await client();
    if(!db) return { ok: false };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    let username = '';
    const { data: prof } = await db.from('profiles').select('username, full_name').eq('id', authData.user.id).single();
    if(prof) username = prof.username || prof.full_name || '';
    const { error } = await db.from('post_comments').insert({ post_id: postId, author_id: authData.user.id, username, content });
    if(error){ console.warn('[SPOTRA] addPostComment:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function deletePostComment(id){
    const db = await client();
    if(!db) return { ok: false };
    const { error } = await db.from('post_comments').delete().eq('id', id);
    if(error){ console.warn('[SPOTRA] deletePostComment:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function uploadPostImage(blob, ext){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: u } = await db.auth.getUser();
    if(!(u && u.user)) return { ok: false, error: 'iniciá sesión' };
    const rand = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
    const path = 'posts/' + rand + '.' + ext;
    const up = await db.storage.from('place-images').upload(path, blob, { contentType: blob.type, upsert: false });
    if(up.error) return { ok: false, error: up.error.message };
    const { data: pub } = db.storage.from('place-images').getPublicUrl(path);
    return { ok: true, url: pub.publicUrl };
  }


  /* ===== Push ===== */
  async function savePushSubscription(sub){
    const db = await client();
    if(!db) return { ok: false, error: 'sin conexión' };
    const { data: authData } = await db.auth.getUser();
    if(!authData?.user?.id) return { ok: false, error: 'auth' };
    const json = sub.toJSON ? sub.toJSON() : sub;
    const { error } = await db.from('push_subscriptions').upsert({
      profile_id: authData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys && json.keys.p256dh,
      auth: json.keys && json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200)
    }, { onConflict: 'endpoint' });
    if(error){ console.warn('[SPOTRA] savePushSubscription:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  }

  async function deletePushSubscription(endpoint){
    const db = await client();
    if(!db) return { ok: false };
    const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if(error) return { ok: false, error: error.message };
    return { ok: true };
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
    listEvents,
    createEvent,
    getUserId,
    registerToEvent,
    unregisterFromEvent,
    listMyRegistrations,
    listMyOrganizedEvents,
    listEventRegistrations,
    organizerUpdateEvent,
    organizerCancelEvent,
    saveEventResults,
    listEventResults,
    listRanking,
    listListings,
    listMyListings,
    createListing,
    markListingSold,
    deleteListing,
    listPendingListings,
    reviewListing,
    uploadListingImage,
    listPosts,
    createPost,
    deletePost,
    togglePostLike,
    listPostComments,
    addPostComment,
    deletePostComment,
    uploadPostImage,
    savePushSubscription,
    deletePushSubscription,
    listPendingEvents,
    reviewEvent,
    seedPlaces: seedPlaces.map(normalizePlace)
  };
})();
