/* SPOTRA · Menores de 18 y su responsable
   - El menor (13–17) solo puede mirar hasta vincular a su madre, padre o tutor con un código.
   - El responsable (18+) habilita Sesiones (solo skateparks), Market (con su WhatsApp) y Avisos por zona.
   Las reglas de verdad están en el servidor (menores.sql). Esto solo da avisos claros y el panel. */
(function(){
  const B = () => window.SpotraBackend;
  let st = null;   // estado de my_guardian_status()
  const $ = id => document.getElementById(id);
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const say = m => { if(window.toast) window.toast(t(m)); };
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }
  const isAdmin = () => document.body.dataset.isAdmin === '1';

  async function load(){
    const c = await db();
    if(!c) return;
    let uid = null;
    try { uid = await B().getUserId(); } catch(e){}
    if(!uid){ st = null; paint(); return; }
    const { data, error } = await c.rpc('my_guardian_status');
    if(error){ console.warn('[SPOTRA] responsable:', error.message); return; }
    st = data;
    paint();
  }

  const minor = () => !!(st && st.minor);
  const linked = () => !!(st && st.linked);
  function allows(what){
    if(!st || isAdmin()) return true;          // sin datos todavía: decide el servidor
    if(!st.minor) return what !== 'birth' || st.birth_set;
    if(what === 'adult') return false;
    if(!st.linked) return false;
    if(what === 'basic') return true;
    return !!st['allow_' + what];
  }

  /* ---------- aviso en el Perfil ---------- */
  function paint(){
    const box = $('guardianBanner');
    if(box){
      if(minor() && !linked()){
        box.innerHTML = `<div class="grd-banner"><b>${esc(t('Vinculá a tu responsable'))}</b><p>${esc(t('Como sos menor de 18, necesitás que tu madre, padre o tutor vincule su cuenta para poder participar.'))}</p><button type="button" class="primary-btn" data-open-guardian>${esc(t('Vincular responsable'))}</button></div>`;
      } else box.innerHTML = '';
    }
    if($('guardianBody') && $('modalBg') && $('modalBg').classList.contains('open')) renderModal();
  }

  /* ---------- hoja "Responsable" ---------- */
  function row(label, on){ return `<div class="grd-perm"><span>${esc(t(label))}</span><b class="${on ? 'on' : ''}">${esc(t(on ? 'Habilitado' : 'No habilitado'))}</b></div>`; }

  function renderModal(){
    const body = $('guardianBody');
    if(!body) return;
    let html = '';
    if(st && st.minor){
      if(st.linked){
        html += `<p class="hint">${esc(t('Tu responsable'))}: <b>@${esc(st.guardian_name || '')}</b></p>`
          + row('Sesiones (solo skateparks)', st.allow_sessions) + row('Publicar en el Market', st.allow_market) + row('Avisos por zona', st.allow_zone)
          + `<button type="button" class="ghost-btn grd-full" data-grd-unlink-self>${esc(t('Desvincular'))}</button>`;
      } else {
        html += `<p class="hint">${esc(t('Generá un código y mandáselo a tu madre, padre o tutor. Tiene que entrar a SPOTRA con su propia cuenta y poner el código en Configuración → Responsable.'))}</p>`;
        if(st.code){
          html += `<div class="grd-code" translate="no">${esc(st.code)}</div><p class="theme-hint">${esc(t('Vence en 48 horas.'))}</p>`
            + `<button type="button" class="primary-btn grd-full" data-grd-share>${esc(t('Compartir código'))}</button>`;
        } else {
          html += `<button type="button" class="primary-btn grd-full" data-grd-code>${esc(t('Generar código'))}</button>`;
        }
      }
    } else {
      html += `<p class="hint">${esc(t('¿Sos madre, padre o tutor de un rider de 13 a 17 años? Poné el código que te pasó.'))}</p>
        <div class="field"><input id="grdCode" maxlength="12" placeholder="${esc(t('Código'))}" autocapitalize="characters" translate="no"></div>
        <div class="ses-label">${esc(t('Fecha de nacimiento del menor'))}</div>
        <div class="field"><input type="date" id="grdBirth"></div>
        <div class="field" style="margin-top:8px"><input id="grdWa" inputmode="tel" placeholder="${esc(t('Tu WhatsApp (para el Market)'))}"></div>
        <p class="ses-error" id="grdError"></p>
        <button type="button" class="primary-btn grd-full" data-grd-accept>${esc(t('Vincular'))}</button>`;
      const wards = (st && st.wards) || [];
      if(wards.length){
        html += `<div class="ses-label" style="margin-top:18px">${esc(t('Menores a tu cargo'))}</div>`;
        html += wards.map(w => `<div class="grd-ward" data-ward="${esc(w.minor_id)}">
          <b>@${esc(w.minor_name || 'rider')}</b>
          <label class="grd-toggle"><input type="checkbox" data-w="sessions" ${w.allow_sessions ? 'checked' : ''}> ${esc(t('Sesiones (solo skateparks)'))}</label>
          <label class="grd-toggle"><input type="checkbox" data-w="market" ${w.allow_market ? 'checked' : ''}> ${esc(t('Publicar en el Market (con tu WhatsApp)'))}</label>
          <label class="grd-toggle"><input type="checkbox" data-w="zone" ${w.allow_zone ? 'checked' : ''}> ${esc(t('Avisos por zona'))}</label>
          <div class="field"><input data-w="wa" inputmode="tel" value="${esc(w.whatsapp || '')}" placeholder="${esc(t('Tu WhatsApp (para el Market)'))}"></div>
          <div class="grd-actions"><button type="button" class="primary-btn" data-grd-save>${esc(t('Guardar'))}</button><button type="button" class="ghost-btn" data-grd-unlink>${esc(t('Desvincular'))}</button></div>
        </div>`).join('');
      }
    }
    body.innerHTML = html;
  }

  async function openModal(){
    if(window.openModal) window.openModal('guardian');
    const body = $('guardianBody');
    if(body) body.innerHTML = `<p class="hint">${esc(t('Cargando...'))}</p>`;
    await load();
    renderModal();
  }

  async function rpc(name, args){
    const c = await db();
    if(!c){ say('Sin conexión. Probá de nuevo.'); return { error: true }; }
    const r = await c.rpc(name, args || {});
    if(r.error) say(r.error.message || 'No se pudo. Probá de nuevo.');
    return r;
  }

  /* ---------- frenar acciones que un menor no puede hacer (el servidor igual las bloquea) ---------- */
  const RULES = [
    ['[data-open-modal="event"],[data-ev-edit]', 'adult'],
    ['[data-open-modal="product"],.publish-btn', 'market'],
    ['[data-ses-new],[data-ses-join],[data-ses-menu]', 'sessions'],
    ['.fab,[data-open-modal="post"],[data-open-modal="spot"],[data-post-like],[data-cmt-send],[data-ev-register],[data-follow],[data-cond-open],#spotPhotoBtn', 'basic']
  ];
  function blockMsg(what){
    if(st && !st.birth_set) return 'Primero completá tu fecha de nacimiento.';
    if(what === 'adult') return 'Esto es solo para mayores de 18.';
    if(!linked()) return null;   // abre la hoja para vincular
    return 'Tu responsable no habilitó esta función.';
  }

  document.addEventListener('click', e => {
    const el = e.target;
    let b;
    if(el.closest('[data-open-guardian]')){ e.preventDefault(); openModal(); return; }
    if(el.closest('[data-grd-code]')){ e.preventDefault(); rpc('guardian_create_code').then(r => { if(!r.error) load().then(renderModal); }); return; }
    if(el.closest('[data-grd-share]')){
      e.preventDefault();
      if(st && st.code && window.spotraShare) window.spotraShare({ title: 'SPOTRA', text: t('Mi código para vincularte como mi responsable en SPOTRA:') + ' ' + st.code, url: location.origin + '/' });
      return;
    }
    if(el.closest('[data-grd-accept]')){
      e.preventDefault();
      const err = $('grdError');
      rpc('guardian_accept', { p_code: ($('grdCode').value || '').trim(), p_birth: $('grdBirth').value || null, p_whatsapp: $('grdWa').value || null }).then(r => {
        if(r.error) return;
        if(r.data && r.data.ok === false){ if(err) err.textContent = t(r.data.error); return; }
        say('Cuenta vinculada. Elegí qué puede hacer.');
        load().then(renderModal);
      });
      return;
    }
    if((b = el.closest('[data-grd-save]'))){
      e.preventDefault();
      const w = b.closest('[data-ward]');
      const val = k => w.querySelector(`[data-w="${k}"]`);
      rpc('guardian_set', { p_minor: w.dataset.ward, p_sessions: val('sessions').checked, p_market: val('market').checked, p_zone: val('zone').checked, p_whatsapp: val('wa').value || null })
        .then(r => { if(!r.error){ say('Cambios guardados.'); load(); } });
      return;
    }
    if((b = el.closest('[data-grd-unlink]'))){
      e.preventDefault();
      if(!confirm(t('¿Desvincular? La cuenta del menor vuelve a quedar solo para mirar.'))) return;
      rpc('guardian_unlink', { p_minor: b.closest('[data-ward]').dataset.ward }).then(r => { if(!r.error) load().then(renderModal); });
      return;
    }
    if(el.closest('[data-grd-unlink-self]')){
      e.preventDefault();
      if(!confirm(t('¿Desvincular a tu responsable? Tu cuenta vuelve a quedar solo para mirar.'))) return;
      B().getUserId().then(uid => rpc('guardian_unlink', { p_minor: uid })).then(r => { if(r && !r.error) load().then(renderModal); });
      return;
    }
    // reglas para menores
    if(!st || isAdmin()) return;
    for(const [sel, what] of RULES){
      if(!el.closest(sel)) continue;
      if(!st.birth_set && !isAdmin()){ e.preventDefault(); e.stopPropagation(); say('Primero completá tu fecha de nacimiento.'); return; }
      if(allows(what)){
        // sesiones de menores: solo en skateparks
        if(what === 'sessions' && minor()){
          const cur = window.SpotraMaps && window.SpotraMaps.current ? window.SpotraMaps.current() : null;
          if(cur && cur.type && cur.type !== 'skatepark'){ e.preventDefault(); e.stopPropagation(); say('Las sesiones de menores de 18 solo pueden ser en skateparks.'); return; }
        }
        return;
      }
      e.preventDefault(); e.stopPropagation();
      const msg = blockMsg(what);
      if(msg) say(msg); else openModal();
      return;
    }
  }, true);

  // mensajes técnicos del servidor → mensaje claro
  function wrapToast(){
    if(!window.toast || window.toast.__grd) return;
    const orig = window.toast;
    window.toast = function(msg){
      if(/row-level security|violates row-level/i.test(String(msg || ''))) msg = t('No tenés permiso para hacer esto.');
      return orig(msg);
    };
    window.toast.__grd = true;
  }
  wrapToast();
  document.addEventListener('DOMContentLoaded', wrapToast);

  setTimeout(load, 2000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) load(); });
  window.SpotraGuardian = { load, allows, open: openModal };
})();
