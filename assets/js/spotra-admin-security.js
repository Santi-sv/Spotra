/* SPOTRA · Seguridad del admin: Face ID (WebAuthn nativo, sin librerías externas)
   Blindaje admin, paso 2 (24/09/2026)
   - Pantalla "Seguridad" (vista admin-security): estado, dispositivos, registrar y probar Face ID.
   - Todo se verifica en el servidor (Edge Function admin-passkey). Este archivo solo
     le pide al iPhone/Mac la firma con Face ID/Touch ID y la manda.
   - Expone window.SpotraFaceID.verify() para las próximas sesiones (desbloqueo y acciones críticas). */
(function(){
  'use strict';

  function notify(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  async function db(){ return (window.SpotraBackend && window.SpotraBackend.getClient) ? await window.SpotraBackend.getClient() : null; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  /* ---------- base64url <-> bytes ---------- */
  function toB64url(buf){
    const bytes = new Uint8Array(buf);
    let s = '';
    for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(str){
    const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  /* ---------- opciones del servidor -> formato del navegador ---------- */
  function creationOptions(o){
    return {
      rp: o.rp,
      user: { id: fromB64url(o.user.id), name: o.user.name, displayName: o.user.displayName },
      challenge: fromB64url(o.challenge),
      pubKeyCredParams: o.pubKeyCredParams,
      timeout: o.timeout,
      attestation: o.attestation || 'none',
      authenticatorSelection: o.authenticatorSelection,
      excludeCredentials: (o.excludeCredentials || []).map(c => ({ type: 'public-key', id: fromB64url(c.id), transports: c.transports })),
      extensions: o.extensions
    };
  }
  function requestOptions(o){
    return {
      challenge: fromB64url(o.challenge),
      timeout: o.timeout,
      rpId: o.rpId,
      userVerification: o.userVerification || 'required',
      allowCredentials: (o.allowCredentials || []).map(c => ({ type: 'public-key', id: fromB64url(c.id), transports: c.transports }))
    };
  }

  /* ---------- respuesta del navegador -> JSON para el servidor ---------- */
  function registrationJSON(cred){
    const r = cred.response;
    return {
      id: cred.id,
      rawId: toB64url(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: toB64url(r.clientDataJSON),
        attestationObject: toB64url(r.attestationObject),
        transports: (typeof r.getTransports === 'function') ? r.getTransports() : []
      },
      clientExtensionResults: (typeof cred.getClientExtensionResults === 'function') ? cred.getClientExtensionResults() : {},
      authenticatorAttachment: cred.authenticatorAttachment || undefined
    };
  }
  function authenticationJSON(cred){
    const r = cred.response;
    return {
      id: cred.id,
      rawId: toB64url(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: toB64url(r.clientDataJSON),
        authenticatorData: toB64url(r.authenticatorData),
        signature: toB64url(r.signature),
        userHandle: r.userHandle ? toB64url(r.userHandle) : undefined
      },
      clientExtensionResults: (typeof cred.getClientExtensionResults === 'function') ? cred.getClientExtensionResults() : {},
      authenticatorAttachment: cred.authenticatorAttachment || undefined
    };
  }

  function supported(){
    return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && navigator.credentials.get);
  }

  function friendlyWebAuthnError(err){
    const n = err && err.name;
    if(n === 'NotAllowedError') return 'Cancelaste o venció el tiempo. Probá de nuevo.';
    if(n === 'InvalidStateError') return 'Este dispositivo ya está registrado.';
    if(n === 'SecurityError') return 'Face ID solo funciona desde spotra.onrender.com.';
    if(n === 'NotSupportedError') return 'Este dispositivo no soporta Face ID para la web.';
    return 'No se pudo usar Face ID.';
  }

  /* ---------- llamada a la Edge Function ---------- */
  async function call(body){
    const c = await db();
    if(!c) return { ok: false, error: 'Sin conexión.' };
    try {
      const { data, error } = await c.functions.invoke('admin-passkey', { body });
      if(error){
        let msg = 'No se pudo completar.';
        try { const j = await error.context.json(); if(j && j.error) msg = j.error; } catch(e){}
        return { ok: false, error: msg };
      }
      return data || { ok: false, error: 'Respuesta vacía.' };
    } catch(err){
      return { ok: false, error: 'Sin conexión.' };
    }
  }

  /* ---------- Face ID: verificación (se usa en esta y en las próximas sesiones) ----------
     Los navegadores exigen que Face ID se pida justo después de un toque. Por eso las
     opciones se piden ANTES (prefetch) y el toque usa las que ya están listas. */
  let authPrefetch = null; // { options, at }
  async function prefetchAuth(){
    const r = await call({ action: 'auth-options' });
    authPrefetch = r.ok ? { options: r.options, at: Date.now() } : null;
    return r;
  }
  function authReady(){ return !!(authPrefetch && Date.now() - authPrefetch.at < 90 * 1000); }

  async function verify(){
    if(!supported()) return { ok: false, error: 'Este navegador no soporta Face ID.' };
    if(!authReady()){
      const r = await prefetchAuth();
      if(!r.ok) return r;
    }
    const opts = authPrefetch.options;
    authPrefetch = null; // un solo uso
    let cred;
    try {
      cred = await navigator.credentials.get({ publicKey: requestOptions(opts) });
    } catch(err){
      return { ok: false, error: friendlyWebAuthnError(err) };
    }
    if(!cred) return { ok: false, error: 'No se pudo usar Face ID.' };
    return await call({ action: 'auth-verify', response: authenticationJSON(cred) });
  }

  /* ---------- pantalla Seguridad ---------- */
  const S = { status: null, busy: false, step: 'idle', regOptions: null, regCode: '', regName: '' };

  function view(){ return document.querySelector('[data-view="admin-security"]'); }
  function fmtDate(iso){
    if(!iso) return 'nunca';
    const d = new Date(iso); if(isNaN(d)) return '';
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getFullYear()).slice(-2);
  }

  const CARD = 'border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);padding:12px 14px;margin-bottom:8px';
  const BTN_MAIN = 'display:block;width:100%;box-sizing:border-box;background:var(--green-hot);color:#051006;border:0;border-radius:14px;padding:14px;font-weight:800;font-size:15px;cursor:pointer;margin-bottom:8px';
  const BTN_SEC = 'display:block;width:100%;box-sizing:border-box;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:13px;font-weight:800;font-size:15px;cursor:pointer;margin-bottom:8px';
  const INPUT = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:12px 14px;color:#fff;font-size:16px;margin-bottom:8px';

  function render(){
    const v = view(); if(!v) return;
    const st = S.status;
    let html = '<div class="section-head" style="margin-top:0"><h2 style="font-family:var(--display);font-size:28px;letter-spacing:0;text-transform:none">Seguridad</h2></div>' +
      '<div class="meta" style="margin:-6px 0 16px">Face ID protege las acciones críticas del panel.</div>';

    if(!supported()){
      html += '<div class="panel" style="color:var(--muted)">Este navegador no soporta Face ID para la web. Abrí SPOTRA desde Safari o desde la app instalada en el iPhone.</div>';
      v.innerHTML = html; return;
    }
    if(!st){
      html += '<div class="panel" style="color:var(--muted)">Cargando...</div>';
      v.innerHTML = html; return;
    }
    if(st.error){
      html += '<div class="panel" style="color:var(--muted)">' + esc(st.error) + '</div>' +
        '<button data-sec="reload" style="' + BTN_SEC + '">Reintentar</button>';
      v.innerHTML = html; return;
    }

    const n = st.devices.length;
    html += '<div style="border-radius:16px;border:1px solid ' + (n ? 'rgba(116,255,58,.4)' : 'rgba(255,184,77,.45)') + ';background:' + (n ? 'rgba(46,232,77,.06)' : 'rgba(255,184,77,.06)') + ';padding:14px;margin-bottom:16px;display:flex;gap:12px;align-items:center">' +
      '<div style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;border:1px solid ' + (n ? 'rgba(116,255,58,.5)' : 'rgba(255,184,77,.5)') + ';color:' + (n ? 'var(--green-hot)' : '#ffb84d') + '">' +
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3Z"/>' + (n ? '<path d="M8.5 12l2.5 2.5 5-5"/>' : '<path d="M12 8v5M12 16h.01"/>') + '</svg></div>' +
      '<div><div style="font-weight:800">' + (n ? 'Face ID activo' : 'Face ID sin configurar') + '</div>' +
      '<div style="color:var(--muted);font-size:12.5px">' + (n ? (n + (n === 1 ? ' dispositivo registrado' : ' dispositivos registrados')) : 'Registrá tu iPhone y tu Mac') + '</div></div></div>';

    if(n){
      html += '<div style="color:var(--muted);font-size:12px;letter-spacing:.06em;margin-bottom:8px">DISPOSITIVOS</div>';
      html += st.devices.map(d => '<div style="' + CARD + '"><div style="font-weight:800">' + esc(d.name) + '</div>' +
        '<div style="color:var(--muted);font-size:12.5px">Alta ' + esc(fmtDate(d.createdAt)) + ' · usado ' + esc(d.lastUsedAt ? fmtDate(d.lastUsedAt) : 'nunca') + '</div></div>').join('');
      html += '<div style="height:8px"></div>';
      html += '<button data-sec="test" style="' + BTN_MAIN + '"' + (S.busy ? ' disabled' : '') + '>' + (S.busy && S.step === 'testing' ? 'Verificando...' : 'Probar Face ID') + '</button>';
    }

    if(S.step === 'form' || S.step === 'ready' || S.step === 'registering'){
      const ready = S.step !== 'form';
      html += '<div style="border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);padding:16px;margin:8px 0">' +
        '<div style="font-weight:800;font-size:17px;margin-bottom:4px">Registrar este dispositivo</div>' +
        '<div style="color:var(--muted);font-size:13px;margin-bottom:12px">' + (ready ? 'Todo listo. Tocá el botón y confirmá con Face ID.' : 'Poné un nombre y el código de configuración.') + '</div>' +
        '<input id="secName" maxlength="40" autocomplete="off" placeholder="Nombre (ej: iPhone de Santiago)" style="' + INPUT + '" value="' + esc(S.regName) + '"' + (ready ? ' disabled' : '') + '>' +
        '<input id="secCode" type="password" autocomplete="off" placeholder="Código de configuración" style="' + INPUT + '"' + (ready ? ' disabled value="••••••••"' : '') + '>' +
        (ready
          ? '<button data-sec="register" style="' + BTN_MAIN + '"' + (S.busy ? ' disabled' : '') + '>' + (S.step === 'registering' ? 'Registrando...' : 'Registrar con Face ID') + '</button>'
          : '<button data-sec="continue" style="' + BTN_MAIN + '"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Verificando código...' : 'Continuar') + '</button>') +
        '<button data-sec="cancel" style="' + BTN_SEC + '">Cancelar</button></div>';
    } else if(st.setupEnabled){
      html += '<button data-sec="start" style="' + BTN_SEC + '">Registrar este dispositivo</button>';
    }

    html += '<div style="color:var(--muted);font-size:12.5px;line-height:1.55;margin-top:10px">' +
      (st.setupEnabled
        ? 'El registro de dispositivos está <b>habilitado</b> porque existe ADMIN_SETUP_CODE en Supabase. Cuando registres tu iPhone y tu Mac, borralo: así nadie puede agregar un Face ID nuevo.'
        : 'El registro de dispositivos está <b>cerrado</b>. Para agregar uno nuevo hay que volver a crear ADMIN_SETUP_CODE en Supabase.') +
      '</div>';

    v.innerHTML = html;
  }

  async function load(){
    S.status = null; render();
    const r = await call({ action: 'status' });
    S.status = r.ok ? { devices: r.devices || [], setupEnabled: !!r.setupEnabled } : { error: r.error || 'No se pudo cargar.' };
    render();
    if(r.ok && (r.devices || []).length) prefetchAuth();
  }

  async function onContinue(){
    const name = (document.getElementById('secName') || {}).value || '';
    const code = (document.getElementById('secCode') || {}).value || '';
    if(!name.trim()){ notify('Poné un nombre para el dispositivo.'); return; }
    if(!code){ notify('Falta el código de configuración.'); return; }
    S.regName = name.trim().slice(0, 40); S.regCode = code;
    S.busy = true; render();
    const r = await call({ action: 'register-options', setupCode: code });
    S.busy = false;
    if(!r.ok){ S.regCode = ''; notify(r.error || 'No se pudo continuar.'); render(); return; }
    S.regOptions = r.options; S.step = 'ready'; render();
  }

  async function onRegister(){
    if(!S.regOptions){ S.step = 'form'; render(); return; }
    const opts = S.regOptions; S.regOptions = null;
    S.busy = true; S.step = 'registering'; render();
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: creationOptions(opts) });
    } catch(err){
      S.busy = false; S.step = 'form'; S.regCode = ''; render();
      notify(friendlyWebAuthnError(err)); return;
    }
    const r = await call({ action: 'register-verify', setupCode: S.regCode, deviceName: S.regName, response: registrationJSON(cred) });
    S.busy = false; S.regCode = '';
    if(!r.ok){ S.step = 'form'; render(); notify(r.error || 'No se pudo registrar.'); return; }
    S.step = 'idle'; S.regName = '';
    notify('Face ID registrado en este dispositivo.');
    load();
  }

  async function onTest(){
    S.busy = true; S.step = 'testing'; render();
    const r = await verify();
    S.busy = false; S.step = 'idle';
    notify(r.ok ? ('Face ID verificado (' + (r.device || 'dispositivo') + ').') : (r.error || 'Face ID no válido.'));
    load();
  }

  document.addEventListener('click', function(e){
    const b = e.target.closest('[data-sec]');
    if(!b || !view() || !view().contains(b)) return;
    e.preventDefault();
    if(S.busy) return;
    const a = b.dataset.sec;
    if(a === 'reload') load();
    else if(a === 'start'){ S.step = 'form'; render(); }
    else if(a === 'cancel'){ S.step = 'idle'; S.regOptions = null; S.regCode = ''; render(); }
    else if(a === 'continue') onContinue();
    else if(a === 'register') onRegister();
    else if(a === 'test') onTest();
  });

  function watch(){
    const v = view(); if(!v) return;
    const go = () => {
      if(!v.classList.contains('active')) return;
      if(!window.SPOTRA_IS_ADMIN){ v.innerHTML = '<div class="panel" style="color:var(--muted)">Solo para administradores.</div>'; return; }
      if(S.step === 'idle') load();
    };
    go();
    new MutationObserver(go).observe(v, { attributes: true, attributeFilter: ['class'] });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  window.SpotraFaceID = { verify, prefetch: prefetchAuth, supported,
    _test: { toB64url, fromB64url, creationOptions, requestOptions, registrationJSON, authenticationJSON } };
})();
