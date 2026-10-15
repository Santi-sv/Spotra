/* SPOTRA · Aviso "Instalá SPOTRA en tu inicio" (v2, 15/10/2026 · v2: aparece a los 10 segundos)
   Para quien usa SPOTRA desde Safari o Chrome en el celular sin haberla instalado.
   - Aparece a los 10 segundos, como una tarjeta chica abajo (no tapa la app). Nunca en la app ya instalada,
     ni en computadora, ni dentro de Instagram/TikTok (eso lo resuelve spotra-inapp.js), ni con la guía de SPOTRI abierta.
   - Android con Chrome: botón "Instalar" abre el instalador del sistema. Si no está disponible, muestra los pasos.
   - iPhone: muestra los pasos con el ícono de Compartir (Safari o Chrome).
   - "Ahora no" o la ✕ lo esconden 7 días. Al instalarla no vuelve a aparecer. */
(function(){
  if(window.SpotraInstall) return;
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isIOSChrome = isIOS && /CriOS/i.test(ua);
  const inApp = /Instagram|musical_ly|BytedanceWebview|TikTok|ttwebview|FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Snapchat|LinkedInApp|Twitter|\bLine\//i.test(ua);
  function standalone(){
    try { return navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
    catch(e){ return false; }
  }
  const KEY = 'spotra_install_later';
  const DONE = 'spotra_installed';
  const WAIT_DAYS = 7;
  function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }

  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', () => { lsSet(DONE, '1'); hide(); });

  const TX = {
    es: {
      title: 'Instalá SPOTRA', sub: 'Abrila como una app y recibí avisos de sesiones cerca.',
      install: 'Instalar', how: 'Cómo', later: 'Ahora no', close: 'Cerrar',
      sheetTitle: 'Instalá SPOTRA en tu inicio', sheetSub: 'Queda como una app más: se abre a pantalla completa y te llegan los avisos.',
      ios: ['Tocá <b>Compartir</b> {share} en la barra de Safari', 'Bajá y elegí <b>Agregar a inicio</b>', 'Tocá <b>Agregar</b> arriba a la derecha'],
      iosChrome: ['Tocá <b>Compartir</b> {share} arriba a la derecha', 'Elegí <b>Agregar a inicio</b>', 'Tocá <b>Agregar</b>'],
      android: ['Tocá el menú <b>⋮</b> arriba a la derecha', 'Elegí <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>', 'Confirmá con <b>Instalar</b>'],
      ok: 'Listo'
    },
    pt: {
      title: 'Instale o SPOTRA', sub: 'Abra como um app e receba avisos de sessões perto de você.',
      install: 'Instalar', how: 'Como', later: 'Agora não', close: 'Fechar',
      sheetTitle: 'Instale o SPOTRA na tela de início', sheetSub: 'Fica como mais um app: abre em tela cheia e você recebe os avisos.',
      ios: ['Toque em <b>Compartilhar</b> {share} na barra do Safari', 'Role e escolha <b>Adicionar à Tela de Início</b>', 'Toque em <b>Adicionar</b> no canto superior direito'],
      iosChrome: ['Toque em <b>Compartilhar</b> {share} no canto superior direito', 'Escolha <b>Adicionar à Tela de Início</b>', 'Toque em <b>Adicionar</b>'],
      android: ['Toque no menu <b>⋮</b> no canto superior direito', 'Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>', 'Confirme em <b>Instalar</b>'],
      ok: 'Pronto'
    },
    en: {
      title: 'Install SPOTRA', sub: 'Open it like an app and get alerts for sessions near you.',
      install: 'Install', how: 'How', later: 'Not now', close: 'Close',
      sheetTitle: 'Add SPOTRA to your home screen', sheetSub: 'It works like any other app: full screen and with alerts.',
      ios: ['Tap <b>Share</b> {share} in the Safari bar', 'Scroll down and choose <b>Add to Home Screen</b>', 'Tap <b>Add</b> in the top right corner'],
      iosChrome: ['Tap <b>Share</b> {share} in the top right corner', 'Choose <b>Add to Home Screen</b>', 'Tap <b>Add</b>'],
      android: ['Tap the <b>⋮</b> menu in the top right corner', 'Choose <b>Install app</b> or <b>Add to Home screen</b>', 'Confirm with <b>Install</b>'],
      ok: 'Done'
    }
  };
  function lang(){
    const l = window.SpotraI18n && window.SpotraI18n.lang ? window.SpotraI18n.lang() : (document.documentElement.lang || 'es').slice(0, 2);
    return TX[l] ? l : 'es';
  }
  const SHARE = '<svg class="si-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M7 11H5v10h14V11h-2"/></svg>';
  const FACE = 'assets/Spotri/spotri-cara.webp';

  const CSS = `
#spotraInstall{position:fixed;left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom) + 98px);z-index:8500;display:flex;justify-content:center;pointer-events:none;font-family:var(--body,'General Sans',sans-serif)}
#spotraInstall .si-bar{pointer-events:auto;width:100%;max-width:440px;display:flex;align-items:center;gap:12px;padding:12px 12px 12px 12px;border-radius:20px;background:#0b0f0c;border:1px solid rgba(116,255,58,.34);box-shadow:0 14px 44px rgba(0,0,0,.6);color:#f5f7f4;animation:siUp .3s ease both}
@keyframes siUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
#spotraInstall .si-face{flex:0 0 46px;width:46px;height:46px;border-radius:14px;background:#13201a url('${FACE}') center/cover no-repeat;border:1px solid rgba(116,255,58,.3)}
#spotraInstall .si-tx{flex:1;min-width:0}
#spotraInstall .si-tx b{display:block;font-family:var(--display,'Clash Display',sans-serif);font-size:16.5px;font-weight:700;letter-spacing:0;line-height:1.15}
#spotraInstall .si-tx span{display:block;font-size:12.5px;line-height:1.3;color:#b9c2ba;margin-top:2px}
#spotraInstall .si-go{flex:0 0 auto;min-height:40px;padding:0 16px;border-radius:12px;border:0;background:linear-gradient(135deg,#74ff3a,#19b335);color:#06130a;font-weight:700;font-size:14.5px;cursor:pointer}
#spotraInstall .si-x{flex:0 0 30px;height:30px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#8a948c;display:grid;place-items:center;cursor:pointer;padding:0}
#spotraInstall .si-x svg{width:14px;height:14px}
#spotraInstallSheet{position:fixed;inset:0;z-index:9400;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);font-family:var(--body,'General Sans',sans-serif)}
#spotraInstallSheet .si-card{width:100%;max-width:440px;margin:0 10px calc(10px + env(safe-area-inset-bottom));padding:22px 20px 14px;border-radius:24px;background:#0b0f0c;border:1px solid rgba(116,255,58,.32);box-shadow:0 -10px 50px rgba(0,0,0,.6);color:#f5f7f4;animation:siUp .28s ease both}
#spotraInstallSheet .si-head{display:flex;gap:12px;align-items:center;margin-bottom:10px}
#spotraInstallSheet .si-head .si-face{flex:0 0 52px;width:52px;height:52px;border-radius:16px;background:#13201a url('${FACE}') center/cover no-repeat;border:1px solid rgba(116,255,58,.3)}
#spotraInstallSheet h3{font-family:var(--display,'Clash Display',sans-serif);font-size:21px;font-weight:700;margin:0;line-height:1.15;letter-spacing:0;word-spacing:.04em}
#spotraInstallSheet p{font-size:14px;line-height:1.45;color:#b9c2ba;margin:0 0 14px}
#spotraInstallSheet ol{margin:0 0 14px;padding:0;list-style:none;display:grid;gap:10px}
#spotraInstallSheet li{display:flex;gap:11px;align-items:center;font-size:14.5px;line-height:1.35}
#spotraInstallSheet li i{flex:0 0 26px;height:26px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:13px;background:rgba(116,255,58,.14);color:#74ff3a}
#spotraInstallSheet b{color:#fff}
#spotraInstallSheet .si-share{width:19px;height:19px;vertical-align:-4px;color:#4da3ff;margin:0 2px}
#spotraInstallSheet .si-ok{display:flex;width:100%;min-height:50px;align-items:center;justify-content:center;border-radius:15px;border:0;background:linear-gradient(135deg,#74ff3a,#19b335);color:#06130a;font-weight:700;font-size:15.5px;cursor:pointer}
#spotraInstallSheet .si-later{display:flex;width:100%;min-height:42px;align-items:center;justify-content:center;border:0;background:transparent;color:#8a948c;font-weight:600;font-size:14px;cursor:pointer;margin-top:4px}`;

  function ensureCss(){
    if(document.getElementById('spotraInstallCss')) return;
    const st = document.createElement('style');
    st.id = 'spotraInstallCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function later(){ lsSet(KEY, String(Date.now())); hide(); }
  function hide(){
    const b = document.getElementById('spotraInstall'); if(b) b.remove();
    const s = document.getElementById('spotraInstallSheet'); if(s) s.remove();
  }

  function steps(t){
    const list = isIOS ? (isIOSChrome ? t.iosChrome : t.ios) : t.android;
    return `<ol>${list.map((s, i) => `<li><i>${i + 1}</i><span>${s.replace('{share}', SHARE)}</span></li>`).join('')}</ol>`;
  }

  function openSheet(){
    ensureCss();
    const old = document.getElementById('spotraInstall'); if(old) old.remove();
    if(document.getElementById('spotraInstallSheet')) return;
    const t = TX[lang()];
    const box = document.createElement('div');
    box.id = 'spotraInstallSheet';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t.sheetTitle);
    box.innerHTML = `<div class="si-card">
      <div class="si-head"><span class="si-face" aria-hidden="true"></span><h3>${t.sheetTitle}</h3></div>
      <p>${t.sheetSub}</p>
      ${steps(t)}
      <button type="button" class="si-ok" data-si-ok>${t.ok}</button>
      <button type="button" class="si-later" data-si-later>${t.later}</button>
    </div>`;
    document.body.appendChild(box);
    box.addEventListener('click', e => {
      if(e.target.closest('[data-si-later]')){ later(); return; }
      if(e.target === box || e.target.closest('[data-si-ok]')){ later(); }
    });
  }

  async function install(){
    if(installEvt){
      const evt = installEvt; installEvt = null;
      try {
        evt.prompt();
        const choice = await evt.userChoice;
        if(choice && choice.outcome === 'accepted'){ lsSet(DONE, '1'); hide(); return; }
      } catch(e){}
      later();
      return;
    }
    openSheet();
  }

  function showBar(){
    if(document.getElementById('spotraInstall') || document.getElementById('spotraInstallSheet')) return;
    ensureCss();
    const t = TX[lang()];
    const bar = document.createElement('div');
    bar.id = 'spotraInstall';
    bar.innerHTML = `<div class="si-bar" role="region" aria-label="${t.title}">
      <span class="si-face" aria-hidden="true"></span>
      <div class="si-tx"><b>${t.title}</b><span>${t.sub}</span></div>
      <button type="button" class="si-go" data-si-go>${installEvt ? t.install : t.how}</button>
      <button type="button" class="si-x" data-si-x aria-label="${t.close}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>`;
    document.body.appendChild(bar);
    bar.addEventListener('click', e => {
      if(e.target.closest('[data-si-x]')){ later(); return; }
      if(e.target.closest('[data-si-go]')) install();
    });
  }

  function canShow(){
    if(standalone() || inApp || !(isIOS || isAndroid)) return false;
    if(lsGet(DONE) === '1') return false;
    const t = Number(lsGet(KEY) || 0);
    if(t && Date.now() - t < WAIT_DAYS * 864e5) return false;
    return true;
  }
  function busy(){
    // no encimar con la guía de SPOTRI, el aviso de Instagram/TikTok ni un formulario abierto
    const g = document.getElementById('spotriGuide');
    if(g && getComputedStyle(g).display !== 'none') return true;
    if(document.getElementById('spotraInapp')) return true;
    if(document.querySelector('.modal-bg.open, .modal-bg.active')) return true;
    return false;
  }
  function tryShow(n){
    if(!canShow()) return;
    if(busy()){ if(n < 40) setTimeout(() => tryShow(n + 1), 15000); return; }
    showBar();
  }

  window.SpotraInstall = { open: openSheet, show: showBar, install, canShow };
  if(canShow()) setTimeout(() => tryShow(0), 10000);
})();
