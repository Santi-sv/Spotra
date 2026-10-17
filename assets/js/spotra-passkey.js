/* SPOTRA · Entrar con Face ID o huella (passkeys de Supabase) — v1, 16/10/2026
   - Login: botón "Entrar con Face ID o huella" arriba del email (y en la pantalla "Iniciar sesión").
   - Después de entrar con contraseña: tarjeta "Entrá más rápido la próxima" (Activar / Ahora no).
     A quien ya tenía la sesión abierta se le ofrece una vez al abrir la app. "Ahora no" la esconde 30 días.
   - Configuración › Cuenta y seguridad › Face ID / huella: ver, activar y quitar.
   Los navegadores (sobre todo Safari) piden Face ID solo justo después de un toque: por eso
   las opciones del servidor se piden ANTES (prefetch) y el toque las usa al instante.
   No se muestra dentro de Instagram/TikTok (ahí Face ID no funciona bien). El sistema Face ID del admin es aparte. */
(function(){
  if(window.SpotraPasskey) return;
  const ua = navigator.userAgent || '';
  const inApp = /Instagram|musical_ly|BytedanceWebview|TikTok|ttwebview|FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Snapchat|LinkedInApp|Twitter|\bLine\//i.test(ua);
  const supported = !!(window.PublicKeyCredential && navigator.credentials &&
    typeof navigator.credentials.create === 'function' && typeof navigator.credentials.get === 'function') && window.isSecureContext !== false;
  const usable = supported && !inApp;
  const FRESH_MS = 90 * 1000;          // opciones del servidor: se usan si tienen menos de 90 s
  const OFFER_KEY = 'spotra_pk_offer_'; // + id del usuario → cuándo tocó "Ahora no" (o 'done')
  const OFFER_WAIT_DAYS = 30;

  function notify(msg){ (window.toast || function(m){ console.log('[SPOTRA]', m); })(msg); }
  async function db(){
    if(window.SpotraBackend && window.SpotraBackend.getClient){
      try { return await window.SpotraBackend.getClient(); } catch(e){ return null; }
    }
    return null;
  }
  function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  function api(c){ return c && c.auth && c.auth.passkey; }

  /* ---------- base64url ↔ bytes ---------- */
  function fromB64url(str){
    str = String(str || '');
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function toB64url(buf){
    const bytes = new Uint8Array(buf);
    let bin = '';
    for(let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function mapCreds(list){
    return (list || []).map(c => Object.assign({}, c, { type: c.type || 'public-key', id: fromB64url(c.id) }));
  }

  /* ---------- opciones del servidor (JSON) → formato del navegador ---------- */
  function creationOptions(o){
    const P = window.PublicKeyCredential;
    if(P && typeof P.parseCreationOptionsFromJSON === 'function'){
      try { return P.parseCreationOptionsFromJSON(o); } catch(e){}
    }
    const out = Object.assign({}, o, {
      challenge: fromB64url(o.challenge),
      user: Object.assign({}, o.user, { id: fromB64url(o.user.id) })
    });
    if(o.excludeCredentials) out.excludeCredentials = mapCreds(o.excludeCredentials);
    return out;
  }
  function requestOptions(o){
    const P = window.PublicKeyCredential;
    if(P && typeof P.parseRequestOptionsFromJSON === 'function'){
      try { return P.parseRequestOptionsFromJSON(o); } catch(e){}
    }
    const out = Object.assign({}, o, { challenge: fromB64url(o.challenge) });
    if(o.allowCredentials) out.allowCredentials = mapCreds(o.allowCredentials);
    return out;
  }

  /* ---------- respuesta del navegador → JSON para el servidor ---------- */
  function credentialJSON(cred){
    if(cred && typeof cred.toJSON === 'function'){
      try { return cred.toJSON(); } catch(e){}
    }
    const r = cred.response;
    const response = { clientDataJSON: toB64url(r.clientDataJSON) };
    if(r.attestationObject){
      response.attestationObject = toB64url(r.attestationObject);
      if(typeof r.getTransports === 'function') response.transports = r.getTransports();
    } else {
      response.authenticatorData = toB64url(r.authenticatorData);
      response.signature = toB64url(r.signature);
      if(r.userHandle) response.userHandle = toB64url(r.userHandle);
    }
    return {
      id: cred.id,
      rawId: toB64url(cred.rawId),
      type: 'public-key',
      response,
      clientExtensionResults: typeof cred.getClientExtensionResults === 'function' ? cred.getClientExtensionResults() : {},
      authenticatorAttachment: cred.authenticatorAttachment || undefined
    };
  }

  function browserError(err, creating){
    const n = err && err.name;
    if(n === 'NotAllowedError' || n === 'AbortError') return '';   // canceló o se venció: sin mensaje
    if(n === 'InvalidStateError') return creating ? 'Este dispositivo ya tiene Face ID o huella activado para SPOTRA.' : 'No pudimos usar Face ID o huella. Probá de nuevo.';
    if(n === 'NotSupportedError') return 'Este dispositivo no permite Face ID ni huella para la web.';
    if(n === 'SecurityError') return 'Face ID o huella solo funciona desde app.spotra.online.';
    return 'No pudimos usar Face ID o huella. Probá de nuevo.';
  }
  function serverError(error){
    const m = String((error && error.message) || '');
    if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisá internet y probá de nuevo.';
    if(/expired|challenge/i.test(m)) return 'Se venció el tiempo. Tocá de nuevo.';
    if(/not found|unknown|no passkey|not registered|credential/i.test(m)) return 'Ese Face ID o huella ya no está activo en SPOTRA. Entrá con tu email y activalo de nuevo desde Configuración.';
    if(/rate limit|too many/i.test(m)) return 'Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo.';
    if(/disabled|not enabled/i.test(m)) return 'Entrar con Face ID o huella no está disponible por ahora.';
    return 'No pudimos entrar con Face ID o huella. Probá de nuevo o entrá con tu email.';
  }

  /* ---------- prefetch de opciones ---------- */
  let authPre = null, authLoading = null, regPre = null, regLoading = null;
  function fresh(p){ return !!(p && Date.now() - p.at < FRESH_MS); }
  function prefetchAuth(){
    if(authLoading) return authLoading;
    authLoading = (async () => {
      const c = await db();
      if(!api(c)) return false;
      try {
        const { data, error } = await c.auth.passkey.startAuthentication();
        authPre = (!error && data && data.options) ? { data, at: Date.now() } : null;
      } catch(e){ authPre = null; }
      return !!authPre;
    })().finally(() => { authLoading = null; });
    return authLoading;
  }
  function prefetchReg(){
    if(regLoading) return regLoading;
    regLoading = (async () => {
      const c = await db();
      if(!api(c)) return false;
      try {
        const { data, error } = await c.auth.passkey.startRegistration();
        regPre = (!error && data && data.options) ? { data, at: Date.now() } : null;
      } catch(e){ regPre = null; }
      return !!regPre;
    })().finally(() => { regLoading = null; });
    return regLoading;
  }

  function setBtnText(btn, text){
    if(!btn) return;
    const sp = btn.querySelector(':scope > span');
    if(!btn.dataset.pkLabel) btn.dataset.pkLabel = (sp || btn).textContent;
    (sp || btn).textContent = text || btn.dataset.pkLabel;
  }

  /* ---------- entrar ---------- */
  let loginBusy = false, justUsedPasskey = 0;
  async function login(btn){
    if(loginBusy) return;
    if(!fresh(authPre)){
      // las opciones no estaban listas: las pedimos y el siguiente toque abre Face ID
      loginBusy = true; if(btn) btn.disabled = true;
      setBtnText(btn, 'Preparando...');
      const ok = await prefetchAuth();
      loginBusy = false; if(btn) btn.disabled = false;
      setBtnText(btn, ok ? 'Tocá de nuevo para continuar' : '');
      if(!ok) notify('No pudimos conectar. Revisá internet y probá de nuevo.');
      return;
    }
    const pre = authPre; authPre = null;   // un solo uso
    loginBusy = true;
    let cred;
    try {
      cred = await navigator.credentials.get({ publicKey: requestOptions(pre.data.options) });
    } catch(err){
      loginBusy = false; setBtnText(btn, '');
      const m = browserError(err, false); if(m) notify(m);
      prefetchAuth();
      return;
    }
    if(btn) btn.disabled = true;
    setBtnText(btn, 'Entrando...');
    try {
      const c = await db();
      const { data, error } = await c.auth.passkey.verifyAuthentication({ challengeId: pre.data.challenge_id, credential: credentialJSON(cred) });
      if(error || !data || !data.session){ notify(serverError(error)); prefetchAuth(); return; }
      justUsedPasskey = Date.now();
      const ui = window.SpotraAuth && window.SpotraAuth.applyAuthUI ? await window.SpotraAuth.applyAuthUI() : {};
      const user = data.session.user || {};
      const first = (((ui.profile && ui.profile.full_name) || (user.user_metadata || {}).full_name || user.email || '').split(' ')[0]).split('@')[0];
      notify(first ? 'Bienvenido de vuelta, ' + first + '.' : 'Bienvenido de vuelta.');
      if(window.setRole) window.setRole(ui.isAdmin ? 'admin' : 'rider');
    } catch(err){
      console.error('[SPOTRA] passkey login:', err);
      notify('No pudimos entrar con Face ID o huella. Probá de nuevo o entrá con tu email.');
      prefetchAuth();
    } finally {
      loginBusy = false;
      if(btn) btn.disabled = false;
      setBtnText(btn, '');
    }
  }

  /* ---------- activar (registrar) ---------- */
  function deviceName(){
    if(/iPhone/i.test(ua)) return 'iPhone';
    if(/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
    if(/Android/i.test(ua)) return 'Android';
    if(/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
    if(/Windows/i.test(ua)) return 'Windows';
    return 'Computadora';
  }
  let regBusy = false;
  async function register(btn){
    if(regBusy) return false;
    if(!fresh(regPre)){
      regBusy = true; if(btn) btn.disabled = true;
      setBtnText(btn, 'Preparando...');
      const ok = await prefetchReg();
      regBusy = false; if(btn) btn.disabled = false;
      setBtnText(btn, ok ? 'Tocá de nuevo para continuar' : '');
      if(!ok) notify('No pudimos conectar. Revisá internet y probá de nuevo.');
      return false;
    }
    const pre = regPre; regPre = null;
    regBusy = true;
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: creationOptions(pre.data.options) });
    } catch(err){
      regBusy = false; setBtnText(btn, '');
      const m = browserError(err, true); if(m) notify(m);
      prefetchReg();
      return false;
    }
    if(btn) btn.disabled = true;
    setBtnText(btn, 'Activando...');
    try {
      const c = await db();
      const { data, error } = await c.auth.passkey.verifyRegistration({ challengeId: pre.data.challenge_id, credential: credentialJSON(cred) });
      if(error){
        notify(/already|exists|duplicate/i.test(String(error.message || '')) ? 'Este dispositivo ya tiene Face ID o huella activado para SPOTRA.' : 'No pudimos activarlo. Probá de nuevo.');
        prefetchReg();
        return false;
      }
      const id = data && (data.id || (data.passkey && data.passkey.id));
      if(id){ try { await c.auth.passkey.update({ passkeyId: id, friendlyName: deviceName() }); } catch(e){} }
      const uid = await userId(); if(uid) lsSet(OFFER_KEY + uid, 'done');
      notify('Listo: la próxima entrás con Face ID o huella.');
      return true;
    } catch(err){
      console.error('[SPOTRA] passkey register:', err);
      notify('No pudimos activarlo. Probá de nuevo.');
      prefetchReg();
      return false;
    } finally {
      regBusy = false;
      if(btn) btn.disabled = false;
      setBtnText(btn, '');
    }
  }

  async function userId(){
    const c = await db(); if(!c) return '';
    try { const { data } = await c.auth.getSession(); return (data && data.session && data.session.user && data.session.user.id) || ''; }
    catch(e){ return ''; }
  }
  async function listPasskeys(){
    const c = await db();
    if(!api(c)) return { ok: false, items: [] };
    try {
      const { data, error } = await c.auth.passkey.list();
      if(error) return { ok: false, items: [] };
      const items = Array.isArray(data) ? data : ((data && (data.passkeys || data.items)) || []);
      return { ok: true, items };
    } catch(e){ return { ok: false, items: [] }; }
  }

  /* ---------- pantalla de login ---------- */
  let refreshTimer = null, refreshCount = 0;
  function onLoginScreen(){
    const v = document.querySelector('.view.active');
    const name = v && v.dataset.view;
    return name === 'login' || name === 'signin';
  }
  function keepFresh(){
    // mientras la pantalla de login está a la vista, las opciones se renuevan (máx. ~8 minutos)
    clearTimeout(refreshTimer);
    if(!usable || !onLoginScreen() || document.hidden || refreshCount > 6) return;
    if(!fresh(authPre)) { refreshCount++; prefetchAuth(); }
    refreshTimer = setTimeout(keepFresh, 30 * 1000);
  }
  function showLoginButtons(){
    if(!usable) return;
    document.querySelectorAll('.pk-login-wrap').forEach(w => { w.hidden = false; });
  }

  /* ---------- tarjeta "Entrá más rápido la próxima" ---------- */
  const FACE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 15.5c1.4 1.2 3.6 1.2 5 0"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  const CSS = `
#spotraPkOffer{position:fixed;inset:0;z-index:9450;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.58);font-family:var(--body,'General Sans',sans-serif);animation:pkFade .2s ease-out}
@keyframes pkFade{from{opacity:0}to{opacity:1}}
@keyframes pkUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
#spotraPkOffer .pk-card{width:100%;max-width:440px;margin:0 10px calc(12px + env(safe-area-inset-bottom));padding:26px 20px 14px;border-radius:24px;background:#0b0f0c;border:1px solid rgba(116,255,58,.32);box-shadow:0 -10px 50px rgba(0,0,0,.6);color:#f5f7f4;display:flex;flex-direction:column;gap:14px;animation:pkUp .28s cubic-bezier(.2,.8,.3,1)}
#spotraPkOffer .pk-icon{width:64px;height:64px;border-radius:20px;background:rgba(116,255,58,.12);display:grid;place-items:center;align-self:center;color:#74ff3a}
#spotraPkOffer .pk-icon svg{width:38px;height:38px}
#spotraPkOffer h3{margin:0;font-family:var(--display,'Clash Display',sans-serif);font-weight:700;font-size:24px;line-height:1.1;text-align:center;letter-spacing:0}
#spotraPkOffer h3 em{font-style:normal;color:#74ff3a}
#spotraPkOffer p{margin:0;font-size:15px;line-height:1.5;color:#b9c2ba;text-align:center}
#spotraPkOffer ul{margin:2px 0 4px;padding:0;list-style:none;display:grid;gap:9px}
#spotraPkOffer li{display:flex;gap:10px;align-items:center;font-size:14px;color:#c9cfca}
#spotraPkOffer li svg{width:18px;height:18px;color:#74ff3a;flex-shrink:0}
#spotraPkOffer .pk-yes{min-height:54px;border-radius:16px;border:0;background:linear-gradient(135deg,#74ff3a,#19b335);color:#051006;font-family:var(--display,'Clash Display',sans-serif);font-weight:700;font-size:16px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
#spotraPkOffer .pk-yes[disabled]{opacity:.65;cursor:default}
#spotraPkOffer .pk-no{min-height:44px;border:0;background:transparent;color:#8d968e;font-weight:600;font-size:14.5px;cursor:pointer}`;
  function ensureCss(){
    if(document.getElementById('spotraPkCss')) return;
    const st = document.createElement('style');
    st.id = 'spotraPkCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function uiBusy(){
    const mb = document.getElementById('modalBg');
    if(mb && mb.classList.contains('open')) return true;
    if(document.getElementById('spotraInstallSheet') || document.getElementById('spotraInapp') || document.body.classList.contains('spotri-open')) return true;
    const rec = document.getElementById('spotraRecovery');
    if(rec && rec.style.display !== 'none') return true;
    return onLoginScreen() || document.hidden;
  }

  let offerShown = false, offerChecking = false;
  async function maybeOffer(tries){
    if(!usable || offerShown || offerChecking) return;
    if(Date.now() - justUsedPasskey < 5 * 60 * 1000) return;
    offerChecking = true;
    try {
      let platform = false;
      try { platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch(e){}
      if(!platform) return;
      const uid = await userId();
      if(!uid) return;
      const mark = lsGet(OFFER_KEY + uid);
      if(mark === 'done') return;
      if(mark && Date.now() - Number(mark) < OFFER_WAIT_DAYS * 864e5) return;
      if(uiBusy()){
        if((tries || 0) < 30) setTimeout(() => maybeOffer((tries || 0) + 1), 8000);   // espera hasta ~4 min a que se libere la pantalla
        return;
      }
      const r = await listPasskeys();
      if(!r.ok) return;
      if(r.items.length){ lsSet(OFFER_KEY + uid, 'done'); return; }
      if(uiBusy()) return;
      prefetchReg();
      showOffer(uid);
    } finally { offerChecking = false; }
  }

  function showOffer(uid){
    if(document.getElementById('spotraPkOffer')) return;
    offerShown = true;
    ensureCss();
    const box = document.createElement('div');
    box.id = 'spotraPkOffer';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Activar Face ID o huella');
    box.innerHTML = `<div class="pk-card">
      <div class="pk-icon">${FACE_SVG}</div>
      <h3>Entrá más rápido <em>la próxima.</em></h3>
      <p>Activá Face ID o tu huella y entrás a SPOTRA con un toque, sin escribir email ni contraseña.</p>
      <ul>
        <li>${CHECK_SVG}<span>Más seguro que una contraseña</span></li>
        <li>${CHECK_SVG}<span>Tu cara o huella nunca sale de tu dispositivo</span></li>
        <li>${CHECK_SVG}<span>Lo podés quitar en Configuración</span></li>
      </ul>
      <button type="button" class="pk-yes" data-pk-yes><span>Activar</span></button>
      <button type="button" class="pk-no" data-pk-no>Ahora no</button>
    </div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener('click', async e => {
      if(e.target.closest('[data-pk-no]') || e.target === box){
        lsSet(OFFER_KEY + uid, String(Date.now()));
        close();
        return;
      }
      const yes = e.target.closest('[data-pk-yes]');
      if(yes){
        const ok = await register(yes);
        if(ok) close();
      }
    });
  }

  /* ---------- Configuración › Cuenta y seguridad › Face ID / huella ---------- */
  function fmtDate(v){
    const d = v ? new Date(v) : null;
    if(!d || isNaN(d)) return '';
    const p = n => (n < 10 ? '0' : '') + n;
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  async function renderSettings(){
    const list = document.getElementById('pkList');
    const add = document.querySelector('[data-passkey-add]');
    const note = document.getElementById('pkNote');
    if(!list) return;
    if(add) add.hidden = true;
    if(note) note.hidden = true;
    list.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'pk-empty';
    loading.textContent = 'Cargando...';
    list.appendChild(loading);
    if(usable) prefetchReg();
    const r = await listPasskeys();
    list.innerHTML = '';
    if(!r.ok){
      const e = document.createElement('div');
      e.className = 'pk-empty';
      e.textContent = 'No pudimos cargar tus accesos. Revisá internet y probá de nuevo.';
      list.appendChild(e);
    } else if(!r.items.length){
      const e = document.createElement('div');
      e.className = 'pk-empty';
      e.textContent = 'Todavía no lo activaste en ningún dispositivo.';
      list.appendChild(e);
    } else {
      r.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'pk-item';
        row.innerHTML = FACE_SVG + '<div class="pk-tx"><b></b><span></span></div><button type="button">Quitar</button>';
        row.querySelector('b').textContent = item.friendly_name || item.name || 'Face ID / huella';
        const when = fmtDate(item.created_at);
        row.querySelector('.pk-tx span').textContent = when ? 'Activado el ' + when : '';
        row.querySelector('button').addEventListener('click', () => removePasskey(item.id));
        list.appendChild(row);
      });
    }
    if(usable){
      if(add) add.hidden = false;
    } else if(note){
      note.textContent = inApp
        ? 'Abrí SPOTRA en Safari o Chrome para activarlo (dentro de Instagram o TikTok no funciona).'
        : 'Este navegador no permite Face ID ni huella.';
      note.hidden = false;
    }
  }
  async function removePasskey(id){
    if(!id) return;
    if(!window.confirm('¿Quitar este acceso? Vas a poder activarlo de nuevo cuando quieras.')) return;
    const c = await db();
    try {
      const { error } = await c.auth.passkey.delete({ passkeyId: id });
      if(error){ notify('No pudimos quitarlo. Probá de nuevo.'); return; }
      notify('Acceso quitado.');
    } catch(e){ notify('No pudimos quitarlo. Probá de nuevo.'); return; }
    renderSettings();
  }

  /* ---------- eventos ---------- */
  let pwLoginAt = 0;
  document.addEventListener('pointerdown', e => {
    // si las opciones están por vencer, las renovamos apenas el dedo toca el botón
    if(e.target.closest('[data-passkey-login]') && !fresh(authPre)) prefetchAuth();
  }, true);
  document.addEventListener('click', e => {
    if(e.target.closest('.auth-enter[data-validate="loginForm"], [data-validate="signinForm"]')) pwLoginAt = Date.now();
    const lb = e.target.closest('[data-passkey-login]');
    if(lb){ e.preventDefault(); login(lb); return; }
    const add = e.target.closest('[data-passkey-add]');
    if(add){
      e.preventDefault();
      register(add).then(ok => { if(ok) renderSettings(); });
      return;
    }
    if(e.target.closest('[data-open-modal="passkeys"]')) setTimeout(renderSettings, 0);
  });
  document.addEventListener('visibilitychange', () => { if(!document.hidden){ refreshCount = 0; keepFresh(); } });
  window.addEventListener('hashchange', () => { refreshCount = 0; setTimeout(keepFresh, 300); });

  function boot(){
    showLoginButtons();
    setTimeout(keepFresh, 600);
    // quien ya tenía la sesión abierta: se le ofrece una vez, unos segundos después de abrir la app
    setTimeout(() => maybeOffer(0), 7000);
    (async () => {
      const c = await db();
      if(c && c.auth && c.auth.onAuthStateChange){
        c.auth.onAuthStateChange(event => {
          if(event === 'SIGNED_IN' && Date.now() - pwLoginAt < 60 * 1000){
            pwLoginAt = 0;
            setTimeout(() => maybeOffer(0), 1800);
          }
        });
      }
    })();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SpotraPasskey = { supported: usable, login, register, list: listPasskeys, offer: () => maybeOffer(0), refreshSettings: renderSettings };
})();
