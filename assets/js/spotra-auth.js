/* SPOTRA · Autenticación real con Supabase Auth
   - Registro (signUp) + creación del perfil en la tabla "profiles"
   - Inicio de sesión (signIn) con persistencia de sesión
   - Estado de UI: oculta "Crear cuenta" / "Iniciar sesión" si hay sesión y saluda por nombre
   No usa service_role. Respeta RLS. El rol admin se setea aparte en app_metadata. */
(function(){
  const TYPE_TO_ACCOUNT = {
    'rider':'rider', 'tienda':'store', 'marca / sponsor':'brand',
    'marca':'brand', 'sponsor':'brand', 'organizador':'organizer'
  };
  const COUNTRY_TO_CODE = { 'uruguay':'UY', 'argentina':'AR', 'brasil':'BR', 'brazil':'BR' };

  function notify(msg){ (window.toast || function(m){ console.log('[SPOTRA]', m); })(msg); }

  async function db(){
    if(window.SpotraBackend && window.SpotraBackend.getClient){
      return await window.SpotraBackend.getClient();
    }
    return null;
  }

  /* ---------- lectura del formulario de registro ---------- */
  function readSignup(){
    const ins = document.querySelectorAll('#signupForm input');
    const typeLabel = (document.querySelector('.type-grid .type-card.active .card-label') || {}).textContent || 'Rider';
    const discipline = (document.querySelector('.discipline-grid .discipline-card.active .card-label') || {}).textContent || '';
    const countrySel = document.getElementById('signupCountry');
    const countryName = countrySel ? countrySel.value : 'Uruguay';
    return {
      fullName: (ins[0] && ins[0].value || '').trim(),
      email:    (ins[1] && ins[1].value || '').trim(),
      phone:    (ins[2] && ins[2].value || '').trim(),
      password: (ins[3] && ins[3].value) || '',
      city:     (ins[4] && ins[4].value || '').trim(),
      accountType: TYPE_TO_ACCOUNT[typeLabel.trim().toLowerCase()] || 'rider',
      countryCode: COUNTRY_TO_CODE[countryName.trim().toLowerCase()] || 'UY',
      discipline: discipline.trim().toLowerCase()
    };
  }

  function validate(formId){
    const form = document.getElementById(formId);
    if(!form) return true;
    let bad = 0;
    form.querySelectorAll('input,select').forEach(inp => {
      const invalid = !inp.checkValidity();
      const field = inp.closest('.field');
      if(field) field.classList.toggle('error', invalid);
      if(invalid) bad++;
    });
    if(bad){ notify('Revisá los campos marcados en rojo.'); return false; }
    return true;
  }

  /* ---------- crear/garantizar el perfil ---------- */
  async function ensureProfile(){
    const client = await db(); if(!client) return null;
    const { data: u } = await client.auth.getUser();
    const user = u && u.user; if(!user) return null;

    let pending = {};
    try { pending = JSON.parse(localStorage.getItem('spotraPendingProfile') || '{}'); } catch {}
    const meta = user.user_metadata || {};

    const row = {
      id: user.id,
      full_name: pending.fullName || meta.full_name || (user.email || 'Rider').split('@')[0],
      account_type: pending.accountType || meta.account_type || 'rider',
      email: user.email || null,
      phone: pending.phone || null,
      country_code: pending.countryCode || 'UY',
      city: pending.city || null,
      discipline: pending.discipline || null
    };

    // insert idempotente: si ya existe el perfil, no hace nada
    const { error } = await client.from('profiles')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    if(error) console.warn('[SPOTRA] perfil:', error.message);

    try { localStorage.removeItem('spotraPendingProfile'); } catch {}

    const { data: prof } = await client.from('profiles')
      .select('id, full_name, account_type').eq('id', user.id).maybeSingle();
    return prof;
  }

  /* ---------- estado de la interfaz según sesión ---------- */
  async function applyAuthUI(){
    const client = await db();
    let session = null, profile = null;
    if(client){
      const { data } = await client.auth.getSession();
      session = data ? data.session : null;
    }
    const authed = !!session;
    document.body.classList.toggle('is-authed', authed);

    // botones de la topbar (solo los que NO están dentro de una vista)
    document.querySelectorAll('[data-route="signin"],[data-route="signup"]').forEach(btn => {
      if(btn.closest('[data-view]')) return;
      btn.style.display = authed ? 'none' : '';
    });
    ensureLogoutButton(authed);

    if(authed){
      profile = await ensureProfile();
      const name = (profile && profile.full_name)
        || (session.user.user_metadata || {}).full_name
        || (session.user.email || '').split('@')[0];
      if(window.setUserName) window.setUserName(name || 'Rider');
    }
    return { session, profile };
  }

  async function doLogout(){
    const client = await db();
    if(client) await client.auth.signOut();
    try { localStorage.removeItem('spotraPendingProfile'); } catch {}
    notify('Sesión cerrada.');
    location.hash = 'login';
    location.reload();
  }

  function ensureLogoutButton(show){
    const actions = document.querySelector('header .actions');
    if(!actions) return;
    let btn = document.getElementById('spotraLogout');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'spotraLogout';
      btn.className = 'ghost-btn';
      btn.textContent = 'Salir';
      btn.addEventListener('click', doLogout);
      actions.appendChild(btn);
    }
    btn.style.display = show ? '' : 'none';
  }

  // Cerrar sesión desde cualquier botón con [data-logout] (ej. Configuración)
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-logout]')){
      e.preventDefault();
      doLogout();
    }
  });

  function roleHome(accountType){
    if(accountType === 'brand') return 'brand';
    if(accountType === 'admin') return 'admin';
    return 'rider';
  }

  /* ---------- registro ---------- */
  async function handleSignup(){
    if(!validate('signupForm')) return;
    const f = readSignup();
    if(!f.email || !f.password){ notify('Completá email y contraseña.'); return; }

    const client = await db();
    if(!client){ notify('No hay conexión con el backend.'); return; }

    try { localStorage.setItem('spotraPendingProfile', JSON.stringify(f)); } catch {}

    try {
      const { data, error } = await client.auth.signUp({
        email: f.email,
        password: f.password,
        options: { data: { full_name: f.fullName, account_type: f.accountType } }
      });
      if(error){ notify(traducir(error.message)); return; }

      if(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0){
        notify('Ese email ya tiene una cuenta. Iniciá sesión.');
        return;
      }

      if(data.session){
        const profile = await ensureProfile();
        const first = ((profile && profile.full_name) || f.fullName || 'rider').split(' ')[0];
        notify('Cuenta creada. Bienvenido a SPOTRA, ' + first + '.');
        await applyAuthUI();
        if(window.setRole) window.setRole(roleHome(f.accountType));
      } else {
        notify('Te enviamos un email para confirmar tu cuenta. Confirmalo y luego iniciá sesión.');
      }
    } catch(err){
      console.error('[SPOTRA] signup error:', err);
      notify('Error al crear la cuenta: ' + ((err && err.message) ? err.message : 'reintentá'));
    }
  }

  /* ---------- inicio de sesión ---------- */
  async function handleLogin(formId){
    if(!validate(formId)) return;
    const inputs = document.querySelectorAll('#' + formId + ' input');
    const identifier = (inputs[0] && inputs[0].value || '').trim();
    const password = (inputs[1] && inputs[1].value) || '';

    if(!identifier.includes('@')){
      notify('Por ahora el ingreso es con email. Usá tu email registrado.');
      return;
    }
    const client = await db();
    if(!client){ notify('No hay conexión con el backend.'); return; }

    notify('Ingresando...');
    try {
      let signedIn = false;
      try {
        const { error } = await Promise.race([
          client.auth.signInWithPassword({ email: identifier, password }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
        ]);
        if(error){ notify(traducir(error.message)); return; }
        signedIn = true;
      } catch(raceErr){
        // si la llamada se colgó pero la sesión quedó creada, seguimos igual
        const { data } = await client.auth.getSession();
        if(!(data && data.session)){ notify('La conexión tardó demasiado. Reintentá en unos segundos.'); return; }
        signedIn = true;
      }
      if(!signedIn) return;

      const ui = await applyAuthUI();
      const accountType = (ui.profile && ui.profile.account_type) || 'rider';
      const first = (((ui.profile && ui.profile.full_name) || identifier).split(' ')[0]).split('@')[0];
      notify('Bienvenido de vuelta, ' + first + '.');
      if(window.setRole) window.setRole(roleHome(accountType));
    } catch(err){
      console.error('[SPOTRA] login error:', err);
      notify('Error al iniciar sesión: ' + ((err && err.message) ? err.message : 'reintentá'));
    }
  }

  function traducir(msg){
    msg = String(msg || '');
    if(/Invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
    if(/Email not confirmed/i.test(msg)) return 'Tenés que confirmar tu email antes de entrar.';
    if(/already registered|User already/i.test(msg)) return 'Ese email ya tiene una cuenta.';
    if(/Password should be/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
    return msg;
  }

  /* ---------- recuperar contraseña: pedir el enlace ---------- */
  async function handleForgot(){
    const emailInput = document.querySelector('#loginForm input[autocomplete="username"]')
      || document.querySelector('#loginForm input');
    const email = (emailInput && emailInput.value || '').trim();
    if(!email || !email.includes('@')){
      if(emailInput){ const fld = emailInput.closest('.field'); if(fld) fld.classList.add('error'); }
      notify('Escribí tu email arriba y tocá de nuevo "Olvidaste tu contraseña".');
      return;
    }
    const client = await db();
    if(!client){ notify('No hay conexión con el backend.'); return; }
    notify('Enviando enlace de recuperación...');
    try {
      const redirectTo = location.origin + location.pathname;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if(error){ notify(traducir(error.message)); return; }
      notify('Si ese email tiene cuenta, te enviamos un enlace para recuperar la contraseña.');
    } catch(err){
      console.error('[SPOTRA] resetPasswordForEmail:', err);
      notify('No se pudo enviar el enlace. Reintentá en unos segundos.');
    }
  }

  /* ---------- recuperar contraseña: fijar la nueva ---------- */
  function ensureRecoveryOverlay(){
    if(document.getElementById('spotraRecovery')) return;
    const o = document.createElement('div');
    o.id = 'spotraRecovery';
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(3,5,4,.86);backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;padding:18px';
    o.innerHTML = ''
      + '<div style="width:min(440px,95vw);background:linear-gradient(150deg,rgba(14,20,15,.99),rgba(6,9,7,1));border:1px solid rgba(116,255,58,.4);border-radius:24px;padding:24px;box-shadow:0 40px 110px rgba(0,0,0,.7)">'
      +   '<b style="font-family:var(--display);font-size:24px;color:#fff;display:block">Nueva contraseña</b>'
      +   '<p style="color:var(--muted);font-size:13.5px;line-height:1.5;margin:8px 0 16px">Escribí dos veces tu nueva contraseña para tu cuenta de SPOTRA.</p>'
      +   '<div class="field full" style="margin-bottom:10px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--green-hot);width:22px;height:22px"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="recPass1" type="password" minlength="8" placeholder="Nueva contraseña (min. 8)" autocomplete="new-password" style="flex:1;background:transparent;border:0;outline:0;color:var(--text);font-size:15px"></div>'
      +   '<div class="field full"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--green-hot);width:22px;height:22px"><path d="M12 3l8 4v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-5"/></svg><input id="recPass2" type="password" minlength="8" placeholder="Reingresa la contraseña" autocomplete="new-password" style="flex:1;background:transparent;border:0;outline:0;color:var(--text);font-size:15px"></div>'
      +   '<button id="recSave" style="width:100%;height:54px;margin-top:18px;border-radius:16px;font-family:var(--display);font-size:16px;font-weight:700;color:#051006;background:linear-gradient(135deg,#46f05f,#2ee84d 55%,#21c93e);box-shadow:0 12px 30px rgba(46,232,77,.3)">Guardar contraseña</button>'
      +   '<button id="recCancel" style="width:100%;height:46px;margin-top:10px;border-radius:14px;border:1px solid rgba(255,255,255,.16);color:var(--muted);background:transparent;font-weight:700">Cancelar</button>'
      + '</div>';
    document.body.appendChild(o);
    document.getElementById('recSave').addEventListener('click', submitRecovery);
    document.getElementById('recCancel').addEventListener('click', closeRecovery);
  }
  function openRecovery(){ ensureRecoveryOverlay(); const o = document.getElementById('spotraRecovery'); if(o) o.style.display = 'flex'; }
  function closeRecovery(){ const o = document.getElementById('spotraRecovery'); if(o) o.style.display = 'none'; }

  async function submitRecovery(){
    const v1 = (document.getElementById('recPass1') || {}).value || '';
    const v2 = (document.getElementById('recPass2') || {}).value || '';
    if(v1.length < 8){ notify('La contraseña debe tener al menos 8 caracteres.'); return; }
    if(v1 !== v2){ notify('Las contraseñas no coinciden.'); return; }
    const client = await db();
    if(!client){ notify('No hay conexión con el backend.'); return; }
    const btn = document.getElementById('recSave');
    if(btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      const { error } = await client.auth.updateUser({ password: v1 });
      if(error){ notify(traducir(error.message)); if(btn){ btn.disabled = false; btn.textContent = 'Guardar contraseña'; } return; }
      closeRecovery();
      notify('Contraseña actualizada. Ya estás dentro de SPOTRA.');
      const ui = await applyAuthUI();
      if(window.setRole) window.setRole(roleHome(ui.profile && ui.profile.account_type));
    } catch(err){
      console.error('[SPOTRA] updateUser:', err);
      notify('No se pudo guardar la contraseña. Reintentá.');
      if(btn){ btn.disabled = false; btn.textContent = 'Guardar contraseña'; }
    }
  }

  /* ---------- intercepta los botones de auth ANTES del handler general ---------- */
  document.addEventListener('click', function(e){
    const forgot = e.target.closest('.auth-forgot');
    if(forgot){ e.preventDefault(); e.stopImmediatePropagation(); handleForgot(); return; }
    const loginBtn  = e.target.closest('.auth-enter[data-validate="loginForm"]');
    const signinBtn = e.target.closest('[data-validate="signinForm"]');
    const signupBtn = e.target.closest('.signup-cta[data-validate="signupForm"]');
    if(!loginBtn && !signinBtn && !signupBtn) return;
    e.preventDefault();
    e.stopImmediatePropagation();   // evita que el navegador legacy navegue sin autenticar
    if(signupBtn) handleSignup();
    else handleLogin(loginBtn ? 'loginForm' : 'signinForm');
  }, true);

  /* ---------- arranque + cambios de sesión ---------- */
  function boot(){
    if(/type=recovery/.test(location.hash) || /[?&]type=recovery/.test(location.search)){
      openRecovery();
    }
    applyAuthUI().then(({ session, profile }) => {
      const h = location.hash;
      if(session && (h === '#login' || h === '#signup' || h === '' || h === '#')){
        if(window.setRole) window.setRole(roleHome(profile && profile.account_type));
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  (async () => {
    const client = await db();
    if(client && client.auth && client.auth.onAuthStateChange){
      client.auth.onAuthStateChange((event, session) => {
        if(event === 'PASSWORD_RECOVERY'){ openRecovery(); return; }
        applyAuthUI().then(({ profile }) => {
          if(event === 'SIGNED_IN'){
            const h = location.hash;
            if(h === '#login' || h === '#signup' || h === '' || h === '#'){
              if(window.setRole) window.setRole(roleHome(profile && profile.account_type));
            }
          }
        });
      });
    }
  })();

  window.SpotraAuth = {
    applyAuthUI, ensureProfile, requestPasswordReset: handleForgot, openRecovery,
    isAdmin: async () => {
      const c = await db(); if(!c) return false;
      const { data } = await c.auth.getSession();
      const s = data ? data.session : null;
      return !!(s && s.user && s.user.app_metadata && s.user.app_metadata.role === 'admin');
    },
    signOut: async () => { const c = await db(); if(c) await c.auth.signOut(); }
  };
})();
