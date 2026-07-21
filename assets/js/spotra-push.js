/* SPOTRA · Notificaciones push (v3)
   - v3: el control vive en Perfil > Configuración (siempre visible).
   - v2: el botón se muestra siempre primero; la consulta al service worker no bloquea la interfaz.
   - Solo funciona con la app INSTALADA en el celular (requisito de iOS).
   - Pide permiso con un toque del usuario, se suscribe y guarda la suscripción en Supabase.
   - Pensado para mobile: el panel se adapta y los mensajes explican qué hacer. */
(function(){
  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function B(){ return window.SpotraBackend || null; }

  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function supported(){
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function urlBase64ToUint8Array(base64String){
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const arr = new Uint8Array(raw.length);
    for(let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function showBox(show){
    const box = document.getElementById('pushBox');
    if(box) box.style.display = show ? '' : 'none';
  }
  function hint(text){
    const el = document.getElementById('pushHint');
    if(!el) return;
    if(text){ el.textContent = text; el.style.display = ''; }
    else el.style.display = 'none';
  }

  function swReady(ms){
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(() => resolve(null), ms || 4000))
    ]);
  }

  async function ensureRegistration(){
    if(!supported()) return null;
    let reg = await swReady(4000);
    if(reg) return reg;
    try { reg = await navigator.serviceWorker.register('sw.js'); } catch(e){ console.warn('[SPOTRA] SW register:', e); return null; }
    return await swReady(6000);
  }

  async function currentSubscription(){
    if(!supported()) return null;
    const reg = await swReady(3000);
    if(!reg) return null;
    try { return await reg.pushManager.getSubscription(); } catch(e){ return null; }
  }

  async function refreshUI(){
    if(!supported()){
      showBox(false);
      hint('Tu navegador no admite notificaciones push.');
      return;
    }
    if(isIOS() && !isStandalone()){
      showBox(false);
      hint('Para recibir avisos, instalá SPOTRA en tu pantalla de inicio: tocá Compartir y luego "Agregar a inicio". Después volvé acá y activalas.');
      return;
    }
    if(Notification.permission === 'denied'){
      showBox(false);
      hint('Bloqueaste las notificaciones. Podés habilitarlas desde los ajustes del navegador para SPOTRA.');
      return;
    }
    /* mostramos el botón de inmediato: no dependemos del service worker para pintarlo */
    showBox(true);
    hint('');
    const sub = await currentSubscription();
    const btn = document.getElementById('pushBtn');
    if(btn){
      const label = btn.querySelector('[data-push-label]') || btn;
      label.textContent = sub ? 'Desactivar notificaciones' : 'Activar notificaciones';
      btn.dataset.on = sub ? '1' : '';
    }
  }

  async function enable(){
    if(!B()){ toast('Sin conexión con el servidor.'); return; }
    const uid = await B().getUserId();
    if(!uid){ toast('Iniciá sesión para activar las notificaciones.'); return; }
    const key = window.SPOTRA_VAPID_PUBLIC_KEY;
    if(!key){ toast('Falta configurar la clave de notificaciones.'); return; }
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ toast('No se activaron las notificaciones.'); refreshUI(); return; }
    try {
      const reg = await ensureRegistration();
      if(!reg){ toast('El servicio de notificaciones no está listo. Cerrá y abrí la app.'); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
      const res = await B().savePushSubscription(sub);
      if(!res.ok){ toast('No se pudo guardar la suscripción.'); return; }
      toast('Notificaciones activadas.');
    } catch(err){
      console.warn('[SPOTRA] push subscribe:', err);
      toast('No se pudo activar. Probá cerrar y abrir la app.');
    }
    refreshUI();
  }

  async function disable(){
    try {
      const sub = await currentSubscription();
      if(sub){
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        if(B()) await B().deletePushSubscription(endpoint);
      }
      toast('Notificaciones desactivadas.');
    } catch(err){
      console.warn('[SPOTRA] push unsubscribe:', err);
      toast('No se pudo desactivar.');
    }
    refreshUI();
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('#pushBtn');
    if(btn){ btn.dataset.on ? disable() : enable(); return; }
    if(e.target.closest('[data-open-modal="settings"]') || e.target.closest('.notif-wrap')) setTimeout(refreshUI, 120);
  });

  function boot(){
    refreshUI();
    /* segundo intento cuando el service worker ya se registró */
    setTimeout(refreshUI, 1500);
    if('serviceWorker' in navigator){
      navigator.serviceWorker.ready.then(() => refreshUI()).catch(() => {});
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SpotraPush = { refreshUI, enable, disable };
})();
