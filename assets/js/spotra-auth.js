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

  /* ---------- intercepta los botones de auth ANTES del handler general ---------- */
  document.addEventListener('click', function(e){
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
      client.auth.onAuthStateChange(() => applyAuthUI());
    }
  })();

  window.SpotraAuth = {
    applyAuthUI, ensureProfile,
    isAdmin: async () => {
      const c = await db(); if(!c) return false;
      const { data } = await c.auth.getSession();
      const s = data ? data.session : null;
      return !!(s && s.user && s.user.app_metadata && s.user.app_metadata.role === 'admin');
    },
    signOut: async () => { const c = await db(); if(c) await c.auth.signOut(); }
  };
})();
