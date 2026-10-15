/* SPOTRA · Aviso "abrí SPOTRA en tu navegador" (v1, 15/10/2026)
   Cuando la app se abre desde el navegador interno de Instagram, TikTok, Facebook, etc., SPOTRA funciona,
   pero no se puede instalar ni recibir notificaciones. Este aviso explica cómo abrirla en Safari o Chrome.
   - Android: botón "Abrir en Chrome" (abre el mismo link en Chrome) + copiar link.
   - iPhone: pasos para abrir en Safari (menú ··· de la app) + copiar link.
   - Se muestra una vez por visita; "Seguir acá" lo cierra. */
(function(){
  const ua = navigator.userAgent || '';
  const APPS = [
    ['Instagram', /Instagram/i],
    ['TikTok', /musical_ly|BytedanceWebview|TikTok|ttwebview/i],
    ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i],
    ['Messenger', /Messenger|MESSENGER/],
    ['Snapchat', /Snapchat/i],
    ['LinkedIn', /LinkedInApp/i],
    ['X', /Twitter/i],
    ['LINE', /\bLine\//i]
  ];
  const hit = APPS.find(a => a[1].test(ua));
  if(!hit) return;
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if(standalone) return;
  try { if(sessionStorage.getItem('spotra_inapp_seen') === '1') return; } catch(e){}

  const APP = hit[0];
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const TX = {
    es: {
      title: 'Abrí SPOTRA en tu navegador',
      why: `Estás dentro de ${APP}. Acá SPOTRA funciona, pero no se puede instalar ni recibir avisos de sesiones.`,
      ios: ['Tocá <b>···</b> arriba a la derecha', 'Elegí <b>Abrir en el navegador</b> (o <b>Abrir en Safari</b>)'],
      android: 'Tocá el botón y se abre en Chrome. Si no funciona, usá el menú <b>⋮</b> → <b>Abrir en el navegador</b>.',
      chrome: 'Abrir en Chrome', copy: 'Copiar link', copied: 'Link copiado. Pegalo en Safari o Chrome.', stay: 'Seguir acá'
    },
    pt: {
      title: 'Abra o SPOTRA no seu navegador',
      why: `Você está dentro do ${APP}. Aqui o SPOTRA funciona, mas não dá para instalar nem receber avisos de sessões.`,
      ios: ['Toque em <b>···</b> no canto superior direito', 'Escolha <b>Abrir no navegador</b> (ou <b>Abrir no Safari</b>)'],
      android: 'Toque no botão e abre no Chrome. Se não funcionar, use o menu <b>⋮</b> → <b>Abrir no navegador</b>.',
      chrome: 'Abrir no Chrome', copy: 'Copiar link', copied: 'Link copiado. Cole no Safari ou Chrome.', stay: 'Continuar aqui'
    },
    en: {
      title: 'Open SPOTRA in your browser',
      why: `You're inside ${APP}. SPOTRA works here, but you can't install it or get session alerts.`,
      ios: ['Tap <b>···</b> in the top right corner', 'Choose <b>Open in browser</b> (or <b>Open in Safari</b>)'],
      android: 'Tap the button to open it in Chrome. If it doesn\'t work, use the <b>⋮</b> menu → <b>Open in browser</b>.',
      chrome: 'Open in Chrome', copy: 'Copy link', copied: 'Link copied. Paste it in Safari or Chrome.', stay: 'Stay here'
    }
  };
  function lang(){
    const l = window.SpotraI18n && window.SpotraI18n.lang ? window.SpotraI18n.lang() : (document.documentElement.lang || 'es').slice(0, 2);
    return TX[l] ? l : 'es';
  }
  function toast(m){ (window.toast || function(){})(m); }

  const CSS = `
#spotraInapp{position:fixed;inset:0;z-index:9500;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);font-family:var(--body,'General Sans',sans-serif)}
#spotraInapp .ia-card{width:100%;max-width:440px;margin:0 10px calc(10px + env(safe-area-inset-bottom));padding:22px 20px 16px;border-radius:24px;background:#0b0f0c;border:1px solid rgba(116,255,58,.32);box-shadow:0 -10px 50px rgba(0,0,0,.6);color:#f5f7f4;animation:iaUp .28s ease both}
@keyframes iaUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
#spotraInapp h3{font-family:var(--display,'Clash Display',sans-serif);font-size:22px;font-weight:700;margin:0 0 8px;line-height:1.15;letter-spacing:0;word-spacing:.04em}
#spotraInapp p{font-size:14px;line-height:1.45;color:#b9c2ba;margin:0 0 14px}
#spotraInapp ol{margin:0 0 16px;padding:0;list-style:none;display:grid;gap:9px}
#spotraInapp li{display:flex;gap:11px;align-items:center;font-size:14.5px;line-height:1.35}
#spotraInapp li i{flex:0 0 26px;height:26px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:13px;background:rgba(116,255,58,.14);color:#74ff3a}
#spotraInapp b{color:#fff}
#spotraInapp .ia-btn{display:flex;width:100%;min-height:50px;align-items:center;justify-content:center;gap:8px;border-radius:15px;font-weight:700;font-size:15.5px;border:0;cursor:pointer;margin-top:9px;text-decoration:none}
#spotraInapp .ia-main{background:linear-gradient(135deg,#74ff3a,#19b335);color:#06130a}
#spotraInapp .ia-ghost{background:transparent;color:#f5f7f4;border:1px solid rgba(255,255,255,.16)}
#spotraInapp .ia-stay{background:transparent;color:#8a948c;font-weight:600;font-size:14px;min-height:42px;margin-top:4px}
#spotraInapp svg{width:18px;height:18px}`;

  function show(){
    if(document.getElementById('spotraInapp')) return;
    const t = TX[lang()];
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    const url = location.href.split('#')[0] + location.hash;
    const box = document.createElement('div');
    box.id = 'spotraInapp';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t.title);
    const copyIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
    let how = '';
    if(isAndroid){
      how = `<p>${t.android}</p><button type="button" class="ia-btn ia-main" data-ia-chrome>${t.chrome}</button>`;
    } else {
      how = `<ol>${t.ios.map((s, i) => `<li><i>${i + 1}</i><span>${s}</span></li>`).join('')}</ol>`;
    }
    box.innerHTML = `<div class="ia-card">
      <h3>${t.title}</h3>
      <p>${t.why}</p>
      ${how}
      <button type="button" class="ia-btn ${isAndroid ? 'ia-ghost' : 'ia-main'}" data-ia-copy>${copyIc}<span>${t.copy}</span></button>
      <button type="button" class="ia-btn ia-stay" data-ia-stay>${t.stay}</button>
    </div>`;
    document.body.appendChild(box);
    const close = () => { try { sessionStorage.setItem('spotra_inapp_seen', '1'); } catch(e){} box.remove(); };
    box.addEventListener('click', async e => {
      if(e.target === box || e.target.closest('[data-ia-stay]')){ close(); return; }
      if(e.target.closest('[data-ia-copy]')){
        let ok = false;
        try { await navigator.clipboard.writeText(url); ok = true; } catch(err){}
        if(!ok){
          try {
            const ta = document.createElement('textarea');
            ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
          } catch(err){}
        }
        toast(ok ? t.copied : url);
        return;
      }
      if(e.target.closest('[data-ia-chrome]')){
        const u = new URL(url);
        location.href = 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(show, 900));
  else setTimeout(show, 900);
})();
