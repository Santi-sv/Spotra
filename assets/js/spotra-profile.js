/* SPOTRA · Perfil editable real (lee y guarda en la tabla profiles) */
(function(){
  function notify(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  async function db(){ if(window.SpotraBackend && window.SpotraBackend.getClient) return await window.SpotraBackend.getClient(); return null; }

  async function currentUser(){
    const c = await db(); if(!c) return null;
    const { data } = await c.auth.getUser();
    return (data && data.user) || null;
  }

  function val(id){ const el = document.getElementById(id); return el ? el.value : ''; }
  function setVal(id, v){ const el = document.getElementById(id); if(el) el.value = (v == null ? '' : v); }
  function setText(sel, v){ const el = document.querySelector(sel); if(el) el.textContent = v; }
  function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function countryName(code){ return ({ UY:'Uruguay', AR:'Argentina', BR:'Brasil' })[code] || code || ''; }
  function closeModal(){ const x = document.querySelector('#modalBg [data-close-modal]'); if(x) x.click(); }

  function socialUrl(platform, raw){
    if(!raw) return '';
    if(/^https?:\/\//i.test(raw)) return raw;
    const h = raw.replace(/^@/, '');
    if(platform === 'instagram') return 'https://instagram.com/' + h;
    if(platform === 'tiktok') return 'https://tiktok.com/@' + h;
    if(platform === 'facebook') return 'https://facebook.com/' + h;
    return raw;
  }

  function wireSocial(platform, value){
    const btn = document.querySelector('[data-social="' + platform + '"]');
    if(!btn) return;
    const url = platform === 'email' ? (value ? ('mailto:' + value) : '') : socialUrl(platform, value);
    btn.onclick = (e) => {
      e.preventDefault();
      if(url) window.open(url, '_blank', 'noopener');
      else notify('Agregá tu ' + platform + ' en Configuración → Editar perfil.');
    };
  }

  async function loadProfile(){
    const c = await db(); if(!c) return;
    const user = await currentUser(); if(!user) return;
    const { data: p, error } = await c.from('profiles')
      .select('full_name, username, email, phone, country_code, city, discipline, bio, instagram, tiktok, facebook, account_type')
      .eq('id', user.id).maybeSingle();
    if(error || !p){ if(error) console.warn('[SPOTRA] perfil:', error.message); return; }

    setText('[data-profile-name]', p.full_name || 'Rider');
    setText('[data-profile-handle]', '@' + (p.username || (p.full_name || 'rider').toLowerCase().replace(/\s+/g, '.')));
    setText('[data-profile-discipline]', p.discipline ? cap(p.discipline) : 'Rider');
    setText('[data-profile-location]', [p.city, countryName(p.country_code)].filter(Boolean).join(', ') || '—');
    const bioEl = document.querySelector('[data-profile-bio]');
    if(bioEl) bioEl.textContent = p.bio || '';
    if(window.setUserName) window.setUserName((p.full_name || 'Rider').split(' ')[0]);

    wireSocial('instagram', p.instagram);
    wireSocial('tiktok', p.tiktok);
    wireSocial('facebook', p.facebook);
    wireSocial('email', p.email || user.email);

    const parts = (p.full_name || '').split(' ');
    setVal('pfNombre', parts.shift() || '');
    setVal('pfApellido', parts.join(' '));
    setVal('pfUsername', p.username || '');
    setVal('pfDiscipline', p.discipline || '');
    setVal('pfInstagram', p.instagram || '');
    setVal('pfTiktok', p.tiktok || '');
    setVal('pfFacebook', p.facebook || '');
    setVal('pfBio', p.bio || '');
    setVal('pfEmail', p.email || user.email || '');
    setVal('pfPhone', p.phone || '');
  }

  async function saveProfile(){
    const c = await db(); const user = await currentUser();
    if(!c || !user){ notify('Iniciá sesión.'); return; }
    const nombre = (val('pfNombre') || '').trim();
    if(!nombre){ notify('El nombre es obligatorio.'); return; }
    const full_name = (nombre + ' ' + (val('pfApellido') || '').trim()).trim();
    const patch = {
      full_name,
      username: val('pfUsername').trim() || null,
      discipline: val('pfDiscipline').trim().toLowerCase() || null,
      instagram: val('pfInstagram').trim() || null,
      tiktok: val('pfTiktok').trim() || null,
      facebook: val('pfFacebook').trim() || null,
      bio: val('pfBio').trim() || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await c.from('profiles').update(patch).eq('id', user.id);
    if(error){
      if(/duplicate|unique/i.test(error.message)) notify('Ese usuario (@) ya está tomado.');
      else notify('No se pudo guardar: ' + error.message);
      return;
    }
    notify('Perfil actualizado.');
    closeModal();
    loadProfile();
  }

  async function saveContact(){
    const c = await db(); const user = await currentUser();
    if(!c || !user){ notify('Iniciá sesión.'); return; }
    const patch = { email: val('pfEmail').trim() || null, phone: val('pfPhone').trim() || null, updated_at: new Date().toISOString() };
    const { error } = await c.from('profiles').update(patch).eq('id', user.id);
    if(error){ notify('No se pudo guardar: ' + error.message); return; }
    notify('Contacto actualizado.');
    closeModal();
    loadProfile();
  }

  async function changePassword(){
    const c = await db(); const user = await currentUser();
    if(!c || !user){ notify('Iniciá sesión.'); return; }
    const cur = val('currentPassword'), nw = val('newPassword'), rp = val('repeatPassword');
    if(!cur || !nw){ notify('Completá las contraseñas.'); return; }
    if(nw.length < 8){ notify('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if(nw !== rp){ notify('Las contraseñas nuevas no coinciden.'); return; }
    const { error: e1 } = await c.auth.signInWithPassword({ email: user.email, password: cur });
    if(e1){ notify('La contraseña actual es incorrecta.'); return; }
    const { error: e2 } = await c.auth.updateUser({ password: nw });
    if(e2){ notify('No se pudo cambiar: ' + e2.message); return; }
    notify('Contraseña actualizada.');
    closeModal();
  }

  // interceptar guardado ANTES de los handlers maqueta
  document.addEventListener('click', function(e){
    const save = e.target.closest('[data-save-settings]');
    if(save){
      e.preventDefault(); e.stopImmediatePropagation();
      const form = save.closest('.modal-form');
      const which = form ? form.dataset.form : '';
      if(which === 'editContact') saveContact(); else saveProfile();
      return;
    }
    const pass = e.target.closest('[data-change-password]');
    if(pass){
      e.preventDefault(); e.stopImmediatePropagation();
      changePassword();
    }
  }, true);

  function watch(){
    const v = document.querySelector('[data-view="profile"]');
    if(!v) return;
    if(v.classList.contains('active')) loadProfile();
    new MutationObserver(() => { if(v.classList.contains('active')) loadProfile(); })
      .observe(v, { attributes: true, attributeFilter: ['class'] });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  window.SpotraProfile = { loadProfile };
})();
