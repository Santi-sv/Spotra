/* SPOTRA · Autenticación real con Supabase Auth (v11)
   - v11 (20/10/2026): registro en 2 pasos (Tus datos / Sobre vos), chequeo de contraseña en vivo,
     prefijo del celular según el país; los campos se leen por id (ya no por orden).
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

  /* ---------- contraseña: la misma regla que exige Supabase ----------
     10+ caracteres, con minúscula, mayúscula, número y símbolo de esta lista (otros símbolos, como ¡ ¿ ñ, no cuentan). */
  const PW_MSG = 'Contraseña: 10 caracteres o más, con mayúscula, minúscula, número y símbolo (por ejemplo ! ? # .).';
  const PW_SYMBOL = /[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,.\/`~]/;
  function passwordProblem(pw){
    pw = String(pw || '');
    if(pw.length < 10 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !PW_SYMBOL.test(pw)) return PW_MSG;
    return '';
  }
  window.SpotraPassword = { problem: passwordProblem, message: PW_MSG };

  /* ---------- fecha de nacimiento: Día / Mes / Año ----------
     El selector nativo de fecha no se podía tocar en iPhone (quedaba vacío y sin alto).
     Se reemplaza por tres listas; el <input> original queda oculto y guarda el valor AAAA-MM-DD,
     así el resto de los módulos lo siguen leyendo igual (#signupBirth, #birthDate, #grdBirth). */
  const BP_SELECTOR = '#signupBirth,#birthDate,#grdBirth';
  const BP_TXT = {
    es: { d: 'Día', m: 'Mes', y: 'Año', loc: 'es-UY' },
    pt: { d: 'Dia', m: 'Mês', y: 'Ano', loc: 'pt-BR' },
    en: { d: 'Day', m: 'Month', y: 'Year', loc: 'en-US' }
  };
  function bpLang(){
    try { const l = window.SpotraI18n && window.SpotraI18n.lang(); return BP_TXT[l] ? l : 'es'; } catch(e){ return 'es'; }
  }
  function bpMonths(lang){
    let f = null;
    try { f = new Intl.DateTimeFormat(BP_TXT[lang].loc, { month: 'long', timeZone: 'UTC' }); } catch(e){}
    const es = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return es.map((m, i) => {
      if(!f) return m;
      const s = f.format(new Date(Date.UTC(2000, i, 15)));
      return s.charAt(0).toUpperCase() + s.slice(1);
    });
  }
  function bpPad(n){ return (n < 10 ? '0' : '') + n; }
  function bpDays(y, m){ return new Date(Date.UTC(y || 2000, m || 1, 0)).getUTCDate(); }   // m en 1..12; sin año, febrero = 29
  function bpOption(value, text){ const o = document.createElement('option'); o.value = value; o.textContent = text; return o; }

  function bpUpgrade(input){
    if(!input || input.dataset.bp === '1') return;
    input.dataset.bp = '1';
    const required = input.required;
    const initial = /^\d{4}-\d{2}-\d{2}$/.test(input.value || '') ? input.value : '';
    input.required = false;
    input.type = 'hidden';
    input.value = initial;

    const wrap = document.createElement('div');
    wrap.className = 'bp';
    wrap.setAttribute('translate', 'no');
    const sd = document.createElement('select'), sm = document.createElement('select'), sy = document.createElement('select');
    sd.className = 'bp-d'; sm.className = 'bp-m'; sy.className = 'bp-y';
    [sd, sm, sy].forEach(s => { if(required) s.required = true; wrap.appendChild(s); });
    input.insertAdjacentElement('afterend', wrap);

    const thisYear = new Date().getFullYear();
    function paint(){
      const L = bpLang(), T = BP_TXT[L];
      const d = sd.value, m = sm.value, y = sy.value;
      sd.setAttribute('aria-label', T.d); sm.setAttribute('aria-label', T.m); sy.setAttribute('aria-label', T.y);
      // meses
      sm.textContent = '';
      sm.appendChild(bpOption('', T.m));
      bpMonths(L).forEach((name, i) => sm.appendChild(bpOption(String(i + 1), name)));
      sm.value = m;
      // años: de 13 años atrás hasta 1920 (lo que acepta la base)
      if(!sy.options.length){
        sy.appendChild(bpOption('', T.y));
        for(let yr = thisYear - 13; yr >= 1920; yr--) sy.appendChild(bpOption(String(yr), String(yr)));
      } else sy.options[0].textContent = T.y;
      sy.value = y;
      paintDays(d);
    }
    function paintDays(keep){
      const T = BP_TXT[bpLang()];
      const max = bpDays(+sy.value, +sm.value || 1);
      const cur = keep != null ? keep : sd.value;
      sd.textContent = '';
      sd.appendChild(bpOption('', T.d));
      for(let i = 1; i <= max; i++) sd.appendChild(bpOption(String(i), String(i)));
      sd.value = (cur && +cur <= max) ? cur : (cur ? String(max) : '');
    }
    function sync(){
      const d = +sd.value, m = +sm.value, y = +sy.value;
      input.value = (d && m && y) ? (y + '-' + bpPad(m) + '-' + bpPad(d)) : '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const field = wrap.closest('.field');
      if(field && input.value) field.classList.remove('error');
    }
    if(initial){
      const [y, m, d] = initial.split('-');
      paint();
      sy.value = String(+y); sm.value = String(+m); paintDays(String(+d));
    } else paint();
    sd.addEventListener('change', sync);
    sm.addEventListener('change', () => { paintDays(); sync(); });
    sy.addEventListener('change', () => { paintDays(); sync(); });
    window.addEventListener('spotra-lang', paint);
  }
  function bpScan(root){
    try {
      (root && root.querySelectorAll ? root : document).querySelectorAll(BP_SELECTOR).forEach(el => { if(el.tagName === 'INPUT') bpUpgrade(el); });
    } catch(e){ console.warn('[SPOTRA] fecha:', e); }
  }
  function bpStart(){
    bpScan(document);
    // el formulario del responsable (#grdBirth) se arma después
    new MutationObserver(muts => {
      for(const m of muts){ for(const n of m.addedNodes){ if(n.nodeType === 1 && (n.matches(BP_SELECTOR) || n.querySelector(BP_SELECTOR))){ bpScan(n.parentNode || document); return; } } }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bpStart); else bpStart();
  window.SpotraBirthPicker = { scan: bpScan };

  /* ---------- lectura del formulario de registro ---------- */
  const PHONE_PREFIX = { 'uruguay': '+598', 'argentina': '+54', 'brasil': '+55' };
  function val(id){ const el = document.getElementById(id); return el ? String(el.value || '') : ''; }
  function readSignup(){
    const typeLabel = (document.querySelector('.type-grid .type-card.active .card-label') || {}).textContent || 'Rider';
    const discipline = (document.querySelector('.discipline-grid .discipline-card.active .card-label') || {}).textContent || '';
    const countrySel = document.getElementById('signupCountry');
    const countryName = countrySel ? countrySel.value : 'Uruguay';
    let phone = val('suPhone').trim();
    if(phone && phone.charAt(0) !== '+') phone = (PHONE_PREFIX[countryName.trim().toLowerCase()] || '') + ' ' + phone;
    return {
      fullName: val('suName').trim(),
      email:    val('suEmail').trim(),
      phone:    phone.trim(),
      password: val('suPass'),
      city:     val('suCity').trim(),
      accountType: TYPE_TO_ACCOUNT[typeLabel.trim().toLowerCase()] || 'rider',
      countryCode: COUNTRY_TO_CODE[countryName.trim().toLowerCase()] || 'UY',
      discipline: discipline.trim().toLowerCase(),
      birthDate: (document.getElementById('signupBirth') || {}).value || ''
    };
  }
  function ageFrom(iso){
    if(!iso) return null;
    const b = new Date(iso + 'T12:00:00'), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if(n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a;
  }

  function validate(formId){
    const form = document.getElementById(formId);
    if(!form) return true;
    let bad = 0, pwBad = false, birthBad = false;
    const badFields = new Set();
    form.querySelectorAll('input,select').forEach(inp => {
      const invalid = !inp.checkValidity();
      const field = inp.closest('.field');
      if(field) field.classList.toggle('error', invalid);
      if(invalid){ badFields.add(field || inp); if(inp.type === 'password') pwBad = true; if(inp.closest('.bp')) birthBad = true; }
    });
    bad = badFields.size;
    // la fecha tiene tres listas: si falta una, toda la fila queda en rojo
    form.querySelectorAll('.bp').forEach(bp => { const fl = bp.closest('.field'); if(fl && [...bp.querySelectorAll('select')].some(x => !x.checkValidity())) fl.classList.add('error'); });
    if(bad){
      if(bad === 1 && pwBad && formId === 'signupForm') notify(PW_MSG);
      else if(bad === 1 && birthBad) notify('Completá tu fecha de nacimiento (día, mes y año).');
      else notify('Revisá los campos marcados en rojo.');
      return false;
    }
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
      account_type: (function(t){ return t === 'brand' ? 'brand' : 'rider'; })(pending.accountType || meta.account_type),
      email: user.email || null,
      phone: pending.phone || null,
      country_code: pending.countryCode || 'UY',
      city: pending.city || null,
      discipline: pending.discipline || null,
      birth_date: pending.birthDate || meta.birth_date || null
    };

    // insert idempotente: si ya existe el perfil, no hace nada
    const { error } = await client.from('profiles')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    if(error) console.warn('[SPOTRA] perfil:', error.message);

    // si el perfil ya existía sin fecha (por ejemplo, se confirmó el email en otro dispositivo), completarla
    if(row.birth_date){
      const { data: cur } = await client.from('profiles').select('birth_date').eq('id', user.id).maybeSingle();
      if(cur && !cur.birth_date) await client.from('profiles').update({ birth_date: row.birth_date }).eq('id', user.id);
    }
    try { localStorage.removeItem('spotraPendingProfile'); } catch {}

    const { data: prof } = await client.from('profiles')
      .select('id, full_name, account_type').eq('id', user.id).maybeSingle();
    return prof;
  }


  /* ---------- rol real (viene firmado por Supabase en el token) ---------- */
  function jwtRole(session){
    try {
      const t = session && session.access_token;
      if(!t) return '';
      const p = JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return (p.app_metadata && p.app_metadata.role) || '';
    } catch(err){ return ''; }
  }

  function markAdmin(isAdmin){
    document.body.dataset.isAdmin = isAdmin ? '1' : '0';
    document.body.dataset.authReady = '1';
    window.SPOTRA_IS_ADMIN = !!isAdmin;
    if(!isAdmin && /^admin-/.test((location.hash || '').slice(1)) && window.setRole){
      window.setRole('rider');
    }
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

    const isAdmin = jwtRole(session) === 'admin';
    markAdmin(authed && isAdmin);

    if(authed){
      profile = await ensureProfile();
      const name = (profile && profile.full_name)
        || (session.user.user_metadata || {}).full_name
        || (session.user.email || '').split('@')[0];
      if(window.setUserName) window.setUserName(name || 'Rider');
    }
    return { session, profile, isAdmin: authed && isAdmin };
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

  function roleHome(accountType, isAdmin){
    if(isAdmin || window.SPOTRA_IS_ADMIN) return 'admin';
    // SPOTRA es solo para riders por ahora: las cuentas marca/tienda (como @spotra) usan la misma app que un rider
    return 'rider';
  }

  /* ---------- registro ---------- */
  let signupBusy = false;
  async function handleSignup(){
    if(signupBusy) return;
    signupBusy = true;
    const btn = document.querySelector('.signup-cta[data-validate="signupForm"]');
    const label = btn ? btn.textContent : '';
    if(btn){ btn.disabled = true; btn.style.opacity = '.6'; }
    try { await doSignup(); }
    finally {
      signupBusy = false;
      if(btn){ btn.disabled = false; btn.style.opacity = ''; if(btn.textContent !== label) btn.textContent = label; }
    }
  }
  async function doSignup(){
    if(!validate('signupForm')) return;
    const f = readSignup();
    if(!f.email || !f.password){ notify('Completá email y contraseña.'); return; }
    const pwBad = passwordProblem(f.password);
    if(pwBad){
      notify(pwBad);
      const pf = document.querySelector('#signupForm input[type="password"]');
      if(pf){ const fl = pf.closest('.field'); if(fl) fl.classList.add('error'); }
      return;
    }
    const age = ageFrom(f.birthDate);
    if(age == null){ notify('Completá tu fecha de nacimiento (día, mes y año).'); const bf = document.getElementById('signupBirth'); if(bf){ const fl = bf.closest('.field'); if(fl) fl.classList.add('error'); } return; }
    if(age < 13){ notify('SPOTRA es para mayores de 13 años.'); return; }
    if(age > 110){ notify('Revisá tu fecha de nacimiento.'); return; }

    const client = await db();
    if(!client){ notify('No hay conexión con el backend.'); return; }

    // 20/10/2026: la contraseña nunca se guarda en el navegador (antes quedaba en spotraPendingProfile)
    try { const keep = Object.assign({}, f); delete keep.password; localStorage.setItem('spotraPendingProfile', JSON.stringify(keep)); } catch {}

    try {
      const { data, error } = await client.auth.signUp({
        email: f.email,
        password: f.password,
        options: { data: { full_name: f.fullName, account_type: (f.accountType === 'brand' ? 'brand' : 'rider'), birth_date: f.birthDate } }
      });
      if(error){ notify(traducir(error.message)); return; }

      if(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0){
        notify('Ese email ya tiene una cuenta. Iniciá sesión.');
        return;
      }

      if(data.session){
        const profile = await ensureProfile();
        const first = ((profile && profile.full_name) || f.fullName || 'rider').split(' ')[0];
        notify(age < 18 ? 'Cuenta creada. Como sos menor de 18, el próximo paso es vincular a tu madre, padre o tutor.' : 'Cuenta creada. Bienvenido a SPOTRA, ' + first + '.');
        await applyAuthUI();
        if(window.setRole) window.setRole(roleHome(f.accountType, false));
      } else {
        suGo(1);
        notify('Te enviamos un email para confirmar tu cuenta. Confirmalo y luego iniciá sesión.');
        setTimeout(() => {
          if(typeof window.setRoute === 'function') window.setRoute('login'); else location.hash = 'login';
          const li = document.querySelector('#loginForm input');
          if(li && !li.value) li.value = f.email;
        }, 1800);
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
      if(window.setRole) window.setRole(roleHome(accountType, ui.isAdmin));
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
    if(/Password should|weak_password|weak password/i.test(msg)) return PW_MSG;
    if(/rate limit|you can only request this after|too many requests/i.test(msg)) return 'Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo.';
    if(/invalid format|Unable to validate email|valid email/i.test(msg)) return 'Revisá el email: no parece válido.';
    if(/Error sending confirmation|sending.*email/i.test(msg)) return 'No pudimos enviar el email de confirmación. Probá de nuevo en unos minutos.';
    if(/Signups not allowed/i.test(msg)) return 'Los registros están cerrados por el momento.';
    if(/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Sin conexión. Revisá internet y probá de nuevo.';
    if(/New password should be different/i.test(msg)) return 'La nueva contraseña tiene que ser distinta a la anterior.';
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
      +   '<div class="field full" style="margin-bottom:10px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--green-hot);width:22px;height:22px"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="recPass1" type="password" minlength="10" placeholder="Nueva contraseña (mín. 10)" autocomplete="new-password" style="flex:1;background:transparent;border:0;outline:0;color:var(--text);font-size:15px"></div>'
      +   '<div class="field full"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--green-hot);width:22px;height:22px"><path d="M12 3l8 4v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V7l8-4Z"/><path d="m9 12 2 2 4-5"/></svg><input id="recPass2" type="password" minlength="10" placeholder="Reingresa la contraseña" autocomplete="new-password" style="flex:1;background:transparent;border:0;outline:0;color:var(--text);font-size:15px"></div>'
      +   '<div id="recMsg" style="display:none;margin-top:12px;font-size:13px;line-height:1.4"></div>'
      +   '<button id="recSave" type="button" style="width:100%;height:54px;margin-top:18px;border-radius:16px;font-family:var(--display);font-size:16px;font-weight:700;color:#051006;background:linear-gradient(135deg,#46f05f,#2ee84d 55%,#21c93e);box-shadow:0 12px 30px rgba(46,232,77,.3)">Guardar contraseña</button>'
      +   '<button id="recCancel" type="button" style="width:100%;height:46px;margin-top:10px;border-radius:14px;border:1px solid rgba(255,255,255,.16);color:var(--muted);background:transparent;font-weight:700">Cancelar</button>'
      + '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function(ev){
      if(ev.target.closest && ev.target.closest('#recSave')){ submitRecovery(); }
      else if(ev.target.closest && ev.target.closest('#recCancel')){ closeRecovery(); }
    });
  }
  function openRecovery(){ ensureRecoveryOverlay(); const o = document.getElementById('spotraRecovery'); if(o) o.style.display = 'flex'; }
  function closeRecovery(){ const o = document.getElementById('spotraRecovery'); if(o) o.style.display = 'none'; }

  function recStatus(msg, ok){
    const m = document.getElementById('recMsg');
    if(!m){ notify(msg); return; }
    m.style.display = 'block';
    m.style.color = ok ? 'var(--green-hot)' : '#ff7a7a';
    m.textContent = msg;
  }

  let recBusy = false;
  async function submitRecovery(){
    if(recBusy) return;
    const v1 = (document.getElementById('recPass1') || {}).value || '';
    const v2 = (document.getElementById('recPass2') || {}).value || '';
    if(passwordProblem(v1)){ recStatus(PW_MSG, false); return; }
    if(v1 !== v2){ recStatus('Las contraseñas no coinciden.', false); return; }
    const client = await db();
    if(!client){ recStatus('No hay conexión con el backend.', false); return; }
    const btn = document.getElementById('recSave');
    recBusy = true;
    if(btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
    recStatus('Guardando...', true);
    try {
      try { await authUrlDone; } catch(e){}
      const { data: sess } = await client.auth.getSession();
      if(!(sess && sess.session)){
        recStatus('El enlace venció o ya se usó. Cerrá esto y pedí uno nuevo desde "Olvidaste tu contraseña".', false);
        recBusy = false;
        if(btn){ btn.disabled = false; btn.textContent = 'Guardar contraseña'; }
        return;
      }
      const { error } = await client.auth.updateUser({ password: v1 });
      if(error){
        recStatus(traducir(error.message), false);
        recBusy = false;
        if(btn){ btn.disabled = false; btn.textContent = 'Guardar contraseña'; }
        return;
      }
      recStatus('Contraseña actualizada. Entrando...', true);
      notify('Contraseña actualizada. Ya estás dentro de SPOTRA.');
      setTimeout(async () => {
        closeRecovery();
        recBusy = false;
        const ui = await applyAuthUI();
        if(window.setRole) window.setRole(roleHome(ui.profile && ui.profile.account_type, ui.isAdmin));
      }, 800);
    } catch(err){
      console.error('[SPOTRA] updateUser:', err);
      recStatus('No se pudo guardar: ' + ((err && err.message) || 'reintentá'), false);
      recBusy = false;
      if(btn){ btn.disabled = false; btn.textContent = 'Guardar contraseña'; }
    }
  }

  /* ---------- registro en 2 pasos (20/10/2026) ---------- */
  const TT = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  let suStep = 1;
  function suGo(n){
    suStep = n;
    document.querySelectorAll('[data-su-step]').forEach(el => { el.hidden = el.dataset.suStep !== String(n); });
    document.querySelectorAll('[data-su-show]').forEach(el => { el.hidden = el.dataset.suShow !== String(n); });
    document.querySelectorAll('.su-steps span').forEach((el, i) => el.classList.toggle('on', i < n));
    const txt = document.getElementById('suStepTxt');
    if(txt) txt.textContent = n === 1 ? TT('Paso 1 de 2 · Tus datos') : TT('Paso 2 de 2 · Sobre vos');
    const back = document.getElementById('suBack');
    if(back){ if(n === 1) back.setAttribute('data-route', 'login'); else back.removeAttribute('data-route'); }
    const panel = document.querySelector('.su-panel');
    if(panel && panel.scrollIntoView) try { window.scrollTo(0, 0); } catch(e){}
    if(n === 2){ const b = document.querySelector('[data-su-step="2"] select, [data-su-step="2"] input:not([type="date"])'); if(b && window.matchMedia && matchMedia('(pointer:fine)').matches) b.focus(); }
  }
  function suRules(){
    const pw = val('suPass');
    const ok = { len: pw.length >= 10, case: /[a-z]/.test(pw) && /[A-Z]/.test(pw), num: /[0-9]/.test(pw), sym: PW_SYMBOL.test(pw) };
    document.querySelectorAll('#suRules [data-rule]').forEach(el => el.classList.toggle('ok', !!ok[el.dataset.rule]));
  }
  function suNext(){
    const step = document.querySelector('[data-su-step="1"]');
    if(!step) return;
    let bad = 0, pwOnly = true;
    step.querySelectorAll('input,select').forEach(inp => {
      let invalid = !inp.checkValidity();
      if(inp.id === 'suPass' && passwordProblem(inp.value)) invalid = true;
      const field = inp.closest('.field');
      if(field) field.classList.toggle('error', invalid);
      if(invalid){ bad++; if(inp.id !== 'suPass') pwOnly = false; }
    });
    if(bad){
      notify(bad === 1 && pwOnly ? PW_MSG : 'Revisá los campos marcados en rojo.');
      const first = step.querySelector('.field.error input'); if(first) first.focus();
      return;
    }
    suGo(2);
  }
  function suPrefix(){
    const sel = document.getElementById('signupCountry'), pre = document.getElementById('suPrefix');
    if(sel && pre) pre.textContent = PHONE_PREFIX[String(sel.value).toLowerCase()] || '';
  }
  document.addEventListener('input', e => { if(e.target && e.target.id === 'suPass') suRules(); });
  document.addEventListener('keydown', e => {
    if(e.key === 'Enter' && e.target && e.target.closest && e.target.closest('[data-su-step="1"]') && e.target.tagName === 'INPUT'){ e.preventDefault(); suNext(); }
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest) return;
    if(e.target.closest('#suNext')){ e.preventDefault(); suNext(); return; }
    if(e.target.closest('#suBack') && suStep === 2){ e.preventDefault(); e.stopImmediatePropagation(); suGo(1); return; }
    const eye = e.target.closest('#suEye');
    if(eye){
      const pw = document.getElementById('suPass'); if(!pw) return;
      const show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      eye.setAttribute('aria-label', TT(show ? 'Ocultar contraseña' : 'Mostrar contraseña'));
      eye.classList.toggle('on', show);
      return;
    }
    if(e.target.closest('.su .country-chip')) setTimeout(suPrefix, 0);
    if(e.target.closest('[data-route="signup"]')) suGo(1);
  }, true);

  /* ---------- intercepta los botones de auth ANTES del handler general ---------- */
  document.addEventListener('click', function(e){
    const forgot = e.target.closest('.auth-forgot');
    if(forgot){ e.preventDefault(); e.stopImmediatePropagation(); handleForgot(); return; }
    if(e.target.closest('#recSave')){ e.preventDefault(); e.stopImmediatePropagation(); submitRecovery(); return; }
    if(e.target.closest('#recCancel')){ e.preventDefault(); e.stopImmediatePropagation(); closeRecovery(); return; }
    const loginBtn  = e.target.closest('.auth-enter[data-validate="loginForm"]');
    const signinBtn = e.target.closest('[data-validate="signinForm"]');
    const signupBtn = e.target.closest('.signup-cta[data-validate="signupForm"]');
    if(!loginBtn && !signinBtn && !signupBtn) return;
    e.preventDefault();
    e.stopImmediatePropagation();   // evita que el navegador legacy navegue sin autenticar
    if(signupBtn) handleSignup();
    else handleLogin(loginBtn ? 'loginForm' : 'signinForm');
  }, true);

  /* ---------- vuelta desde un mail (recuperar contraseña / confirmar cuenta) ----------
     El cliente tiene detectSessionInUrl:false (por el cuelgue de Safari en iOS), así que
     la sesión que trae el enlace se arma acá a mano y después se limpia la dirección. */
  let authUrlDone = Promise.resolve(null);
  async function consumeAuthUrl(){
    const hp = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const qp = new URLSearchParams(location.search || '');
    const at = hp.get('access_token'), rt = hp.get('refresh_token');
    const code = qp.get('code');
    const errDesc = hp.get('error_description') || qp.get('error_description');
    if(!at && !code && !errDesc) return null;
    const r = { type: hp.get('type') || qp.get('type') || '', ok: false, error: '' };
    try {
      const client = await db();
      if(!client) r.error = 'Sin conexión';
      else if(errDesc) r.error = errDesc;
      else if(at && rt){
        const { error } = await client.auth.setSession({ access_token: at, refresh_token: rt });
        if(error) r.error = error.message; else r.ok = true;
      } else if(code){
        const { error } = await client.auth.exchangeCodeForSession(code);
        if(error) r.error = error.message; else r.ok = true;
      }
    } catch(err){ r.error = (err && err.message) || 'error'; }
    // saca los códigos de la dirección (no quedan en el historial ni se comparten)
    try { history.replaceState(null, '', location.pathname + '#login'); } catch(e){}
    return r;
  }

  /* ---------- arranque + cambios de sesión ---------- */
  function boot(){
    const wantsRecovery = /type=recovery/.test(location.hash) || /[?&]type=recovery/.test(location.search);
    if(wantsRecovery) openRecovery();
    authUrlDone = consumeAuthUrl();
    authUrlDone.then(r => {
      if(r && r.error){
        const msg = 'El enlace venció o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".';
        if(wantsRecovery) recStatus(msg, false); else notify(msg);
      } else if(r && r.ok && r.type === 'signup'){
        notify('¡Cuenta confirmada! Bienvenido a SPOTRA.');
      }
    }).catch(() => {}).then(() => applyAuthUI()).then(({ session, profile, isAdmin }) => {
      const h = location.hash;
      if(session && (h === '#login' || h === '#signup' || h === '' || h === '#')){
        if(window.setRole) window.setRole(roleHome(profile && profile.account_type, isAdmin));
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
        applyAuthUI().then(({ profile, isAdmin }) => {
          if(event === 'SIGNED_IN'){
            const h = location.hash;
            if(h === '#login' || h === '#signup' || h === '' || h === '#'){
              if(window.setRole) window.setRole(roleHome(profile && profile.account_type, isAdmin));
            }
          }
        });
      });
    }
  })();

  window.SpotraAuth = {
    applyAuthUI, ensureProfile, requestPasswordReset: handleForgot, openRecovery, translateError: traducir,
    isAdmin: async () => {
      const c = await db(); if(!c) return false;
      const { data } = await c.auth.getSession();
      const s = data ? data.session : null;
      return !!(s && s.user && s.user.app_metadata && s.user.app_metadata.role === 'admin');
    },
    signOut: async () => { const c = await db(); if(c) await c.auth.signOut(); }
  };
})();
