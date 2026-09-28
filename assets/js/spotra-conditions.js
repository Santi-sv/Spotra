/* SPOTRA · Estado del spot en vivo + clima
   - Estado: los riders avisan "Seco y rodable", "Mojado", "Lleno", "Echan", "Cerrado" u "Obras".
     Cada aviso vence solo (lo decide el servidor, ver estado.sql).
   - Clima: temperatura, lluvia en las próximas horas y si llovió hace poco (Open-Meteo, gratis, sin clave). */
(function(){
  const B = () => window.SpotraBackend;
  const STATUS = [
    ['ok', 'Seco y rodable', '#2ee84d'], ['mojado', 'Mojado', '#3aa0ff'], ['lleno', 'Lleno de gente', '#ffc233'],
    ['echan', 'Echan a los riders', '#ff5a5a'], ['cerrado', 'Cerrado', '#ff5a5a'], ['obras', 'En obras', '#ff8a3d']
  ];
  const LABEL = Object.fromEntries(STATUS.map(s => [s[0], s[1]]));
  const COLOR = Object.fromEntries(STATUS.map(s => [s[0], s[2]]));
  const weatherCache = new Map();   // place.id -> { at, data }
  let current = null;
  let busy = false;

  const $ = id => document.getElementById(id);
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const lang = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  const say = m => { if(window.toast) window.toast(t(m)); };
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }

  function ago(iso){
    const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    const L = lang();
    if(m < 60) return ({ es: `hace ${m} min`, pt: `há ${m} min`, en: `${m} min ago` })[L];
    const h = Math.round(m / 60);
    return ({ es: `hace ${h} h`, pt: `há ${h} h`, en: `${h} h ago` })[L];
  }

  /* ---------- clima ---------- */
  async function weather(place){
    const hit = weatherCache.get(place.id);
    if(hit && Date.now() - hit.at < 20 * 60000) return hit.data;
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.lat.toFixed(3) + '&longitude=' + place.lng.toFixed(3)
        + '&current=temperature_2m,precipitation&hourly=precipitation_probability,precipitation&past_hours=3&forecast_hours=7&timezone=auto';
      const res = await fetch(url);
      if(!res.ok) return null;
      const data = await res.json();
      weatherCache.set(place.id, { at: Date.now(), data });
      return data;
    } catch(e){ return null; }
  }

  function weatherText(w){
    if(!w || !w.current || !w.hourly) return null;
    const L = lang();
    const temp = Math.round(w.current.temperature_2m);
    const nowHour = String(w.current.time || '').slice(0, 13);
    const times = w.hourly.time || [];
    let idx = times.findIndex(x => x.slice(0, 13) === nowHour);
    if(idx < 0) idx = 3;
    const prob = w.hourly.precipitation_probability || [];
    const rain = w.hourly.precipitation || [];
    const pastRain = rain.slice(Math.max(0, idx - 3), idx).some(v => v >= 0.2);
    let msg, wet = false;
    if((w.current.precipitation || 0) > 0.05){
      msg = ({ es: 'Está lloviendo ahora', pt: 'Está chovendo agora', en: 'Raining now' })[L]; wet = true;
    } else {
      let next = -1;
      for(let i = idx + 1; i < Math.min(times.length, idx + 7); i++){ if((prob[i] || 0) >= 50 || (rain[i] || 0) >= 0.3){ next = i; break; } }
      if(next >= 0){
        const hh = times[next].slice(11, 16);
        msg = ({ es: `Lluvia probable a las ${hh} (${prob[next] || 0}%)`, pt: `Chuva provável às ${hh} (${prob[next] || 0}%)`, en: `Rain likely at ${hh} (${prob[next] || 0}%)` })[L];
        wet = true;
      } else {
        msg = ({ es: 'Sin lluvia en las próximas 6 h', pt: 'Sem chuva nas próximas 6 h', en: 'No rain in the next 6 h' })[L];
      }
      if(pastRain) msg += ({ es: ' · llovió hace poco, el piso puede estar mojado', pt: ' · choveu há pouco, o piso pode estar molhado', en: ' · it rained recently, the ground may be wet' })[L];
    }
    return { temp, msg, wet: wet || pastRain };
  }

  /* ---------- estado ---------- */
  async function statuses(place){
    const c = await db();
    if(!c) return [];
    const { data, error } = await c.from('spot_status').select('status, created_at').eq('place_id', place.id)
      .order('created_at', { ascending: false }).limit(50);
    if(error) return [];
    const map = new Map();
    (data || []).forEach(r => {
      const g = map.get(r.status) || { status: r.status, n: 0, last: r.created_at };
      g.n++;
      map.set(r.status, g);
    });
    return [...map.values()].sort((a, b) => new Date(b.last) - new Date(a.last));
  }

  async function renderForPlace(place){
    current = place;
    const box = $('spotConditions');
    if(!box) return;
    if(!place || !place.id || place.isGoogleResult || !Number.isFinite(place.lat)){ box.innerHTML = ''; return; }
    box.innerHTML = `<div class="cond"><div class="cond-weather cond-loading">${esc(t('Cargando clima...'))}</div></div>`;
    const [w, st] = await Promise.all([weather(place), statuses(place)]);
    if(current !== place) return;   // el rider ya abrió otro spot
    const wt = weatherText(w);
    const chips = st.length
      ? st.map(g => `<span class="cond-chip"><i style="background:${COLOR[g.status]}"></i><b>${esc(t(LABEL[g.status]))}</b><small>${esc(ago(g.last))}${g.n > 1 ? ' · ' + g.n : ''}</small></span>`).join('')
      : `<span class="cond-empty">${esc(t('Nadie avisó el estado todavía.'))}</span>`;
    box.innerHTML = `<div class="cond">`
      + (wt ? `<div class="cond-weather${wt.wet ? ' wet' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${wt.wet
          ? '<path d="M7 16a4 4 0 1 1 .6-7.95A5 5 0 0 1 17 9a3.5 3.5 0 0 1 0 7"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/>'
          : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'}</svg><b>${wt.temp}°</b><span>${esc(wt.msg)}</span></div>` : '')
      + `<div class="cond-head"><h3>${esc(t('Estado ahora'))}</h3><button type="button" class="cond-btn" data-cond-open>${esc(t('Avisar estado'))}</button></div>`
      + `<div class="cond-chips">${chips}</div>`
      + (wt ? `<small class="cond-credit">${esc(t('Clima'))}: Open-Meteo</small>` : '')
      + `</div>`;
  }

  function openPicker(){
    if(!current || !current.id) return;
    const box = $('statusOptions');
    if(box) box.innerHTML = STATUS.map(([k, label, color]) =>
      `<button type="button" data-cond-set="${k}"><i style="background:${color}"></i>${esc(t(label))}</button>`).join('');
    const nm = $('statusPlaceName');
    if(nm) nm.textContent = current.name;
    if(window.openModal) window.openModal('status');
  }

  async function send(status){
    if(busy || !current) return;
    const c = await db();
    let uid = null;
    try { uid = await B().getUserId(); } catch(e){}
    if(!c || !uid){ say('Iniciá sesión para avisar el estado.'); return; }
    busy = true;
    const { error } = await c.from('spot_status').insert({ place_id: current.id, status });
    busy = false;
    if(error){ say(error.message || 'No se pudo enviar. Probá de nuevo.'); return; }
    if(window.closeModal) window.closeModal();
    say('Gracias, ya lo ven los demás riders.');
    renderForPlace(current);
  }

  document.addEventListener('click', e => {
    const el = e.target;
    let b;
    if(el.closest('[data-cond-open]')){ e.preventDefault(); openPicker(); return; }
    if((b = el.closest('[data-cond-set]'))){ e.preventDefault(); send(b.dataset.condSet); }
  });
  window.addEventListener('spotra-lang', () => { if(current) renderForPlace(current); });

  window.SpotraConditions = { renderForPlace };
})();
