/* SPOTRA — Capa de lanzamiento (landing publica + lista de espera + demo)
   El acceso a la app NO se muestra en la pantalla: se abre solo con el enlace secreto
   y ademas pide Face ID / Touch ID.
   ------------------------------------------------------------------
   ENLACE DE ACCESO:  https://spotra.onrender.com/?k=TU-PALABRA
   En el codigo solo vive el hash de la palabra (PBKDF2, 250.000 vueltas),
   no la palabra. Para cambiarla: abri la consola del navegador en la landing,
   escribi  spotraHash('tu-palabra-nueva')  y pega lo que devuelve en HASH_ACCESO.
   ------------------------------------------------------------------ */
(function(){
  'use strict';

  var HASH_ACCESO = 'T6NAEk5OpQcxC441WeFdomJSqXr6OeY9bY1VPbIB+PQ=';  // hash del enlace secreto
  var SALT = 'spotra-gate-v3';
  var ITER = 250000;
  var WHATSAPP_FALLBACK = '59896452060';    // si falla el guardado, se ofrece WhatsApp
  var KEY_ACCESS = 'spotra_access';         // acceso recordado (sin Face ID)
  var KEY_BIO = 'spotra_bio_id';            // id de la llave Face ID / Touch ID
  var KEY_SESSION = 'spotra_session';       // acceso valido solo mientras la app este abierta

  var cfg = window.SPOTRA_CONFIG || {};

  function ls(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
  function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }
  function hasBio(){ return !!ls(KEY_BIO); }

  function unlockSession(){ try { sessionStorage.setItem(KEY_SESSION,'ok'); } catch(e){} }
  function unlockRemembered(){ lsSet(KEY_ACCESS,'ok'); }

  function hasAccess(){
    try { if(sessionStorage.getItem(KEY_SESSION) === 'ok') return true; } catch(e){}
    if(hasBio()) return false;               // con Face ID siempre se pide al abrir
    return ls(KEY_ACCESS) === 'ok';
  }
  function releaseLock(){
    document.documentElement.classList.remove('gate-lock');
  }

  if(hasAccess()){ releaseLock(); return; }

  document.documentElement.classList.add('gate-lock');

  /* ---------- enlace secreto ---------- */
  function derive(text){
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(text), 'PBKDF2', false, ['deriveBits'])
      .then(function(key){
        return crypto.subtle.deriveBits({
          name:'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash:'SHA-256'
        }, key, 256);
      })
      .then(function(bits){
        var b = new Uint8Array(bits), s = '';
        for(var i=0;i<b.length;i++) s += String.fromCharCode(b[i]);
        return btoa(s);
      });
  }
  // Ayuda para generar el hash de una palabra nueva desde la consola del navegador
  window.spotraHash = function(text){
    return derive(text).then(function(h){ console.log(h); return h; });
  };

  function secretFromUrl(){
    try {
      var v = new URLSearchParams(location.search).get('k');
      return v ? v.trim() : '';
    } catch(e){ return ''; }
  }

  function cleanUrl(){
    try { history.replaceState(null, '', location.pathname); } catch(e){}
  }

  /* ---------- Face ID / Touch ID (WebAuthn) ---------- */
  var bioSupported = !!(window.PublicKeyCredential && navigator.credentials && location.protocol === 'https:');

  function rand(n){
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a;
  }
  function b64url(buf){
    var bytes = new Uint8Array(buf), s = '';
    for(var i=0;i<bytes.length;i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function fromB64url(str){
    str = str.replace(/-/g,'+').replace(/_/g,'/');
    while(str.length % 4) str += '=';
    var bin = atob(str), bytes = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bioRegister(){
    return navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: 'SPOTRA' },
        user: { id: rand(16), name: 'admin@spotra', displayName: 'SPOTRA' },
        pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
        authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required', residentKey:'preferred' },
        timeout: 60000,
        attestation: 'none'
      }
    }).then(function(cred){
      if(!cred) throw new Error('sin credencial');
      lsSet(KEY_BIO, b64url(cred.rawId));
      lsDel(KEY_ACCESS);
      return true;
    });
  }

  function bioLogin(){
    var id = ls(KEY_BIO);
    if(!id) return Promise.reject(new Error('sin llave'));
    return navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type:'public-key', id: fromB64url(id) }],
        userVerification: 'required',
        timeout: 60000
      }
    }).then(function(assertion){
      if(!assertion) throw new Error('cancelado');
      return true;
    });
  }

  /* ---------- estilos ---------- */
  var css = ''
  + '.spotra-gate{position:fixed;inset:0;z-index:99999;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#070907;color:#f5f7f4;font-family:"General Sans",system-ui,-apple-system,sans-serif;}'
  + '.sg-bg{position:fixed;inset:0;background:url("assets/preview/landing-bg.webp") center top/cover no-repeat;opacity:1;}'
  + '.sg-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,9,7,.1) 0%,rgba(7,9,7,.38) 26%,rgba(7,9,7,.86) 56%,#070907 78%);}'
  + '.sg-grid{position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(46,232,77,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(46,232,77,.05) 1px,transparent 1px);background-size:56px 56px;mask-image:linear-gradient(180deg,rgba(0,0,0,.9),transparent 70%);-webkit-mask-image:linear-gradient(180deg,rgba(0,0,0,.9),transparent 70%);}'
  + '.sg-glow{position:fixed;left:50%;top:-140px;width:420px;height:420px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(46,232,77,.18),transparent 65%);pointer-events:none;}'
  + '.sg-wrap{position:relative;z-index:1;max-width:560px;margin:0 auto;padding:34px 18px 10px;}'
  + '.sg-demo{position:relative;z-index:1;padding:0 18px 10px;}'
  + '.sg-logo{font-family:"Clash Display","General Sans",sans-serif;font-weight:700;font-size:26px;letter-spacing:.14em;color:#fff;text-align:center;}'
  + '.sg-logo span{color:#2ee84d;}'
  + '.sg-kicker{text-align:center;color:#2ee84d;font-size:11px;letter-spacing:.22em;text-transform:uppercase;margin-top:6px;font-weight:600;}'
  + '.sg-h1{font-family:"Clash Display","General Sans",sans-serif;font-weight:700;font-size:29px;line-height:1.14;text-align:center;margin:26px 0 10px;text-shadow:0 2px 18px rgba(0,0,0,.8);}'
  + '.sg-h1 em{font-style:normal;color:#2ee84d;}'
  + '.sg-sub{text-align:center;color:#b9c1b9;font-size:15px;line-height:1.5;margin:0 auto 22px;max-width:420px;text-shadow:0 1px 10px rgba(0,0,0,.7);}'
  + '.sg-card{background:rgba(10,15,11,.82);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 18px 40px rgba(0,0,0,.45);}'
  + '.sg-card h2{font-family:"Clash Display","General Sans",sans-serif;font-size:17px;margin:0 0 4px;font-weight:600;}'
  + '.sg-card p.hint{color:#9aa39a;font-size:13px;margin:0 0 14px;}'
  + '.sg-field{margin-bottom:10px;}'
  + '.sg-field label{display:block;font-size:12px;color:#9aa39a;margin-bottom:5px;letter-spacing:.04em;}'
  + '.sg-field input,.sg-field select{width:100%;box-sizing:border-box;background:#0d110e;border:1px solid rgba(255,255,255,.14);border-radius:12px;color:#f5f7f4;font-size:16px;padding:12px 13px;font-family:inherit;outline:none;}'
  + '.sg-field input:focus,.sg-field select:focus{border-color:#2ee84d;}'
  + '.sg-btn{width:100%;border:0;border-radius:12px;background:#2ee84d;color:#06210c;font-weight:700;font-size:16px;padding:14px;font-family:inherit;cursor:pointer;letter-spacing:.01em;}'
  + '.sg-btn:active{transform:translateY(1px);}'
  + '.sg-btn[disabled]{opacity:.6;}'
  + '.sg-msg{margin-top:12px;font-size:14px;line-height:1.45;display:none;}'
  + '.sg-msg.ok{display:block;color:#2ee84d;}'
  + '.sg-msg.err{display:block;color:#ff8a7a;}'
  + '.sg-msg a{color:#2ee84d;}'
  + '.sg-sec-title{text-align:center;margin:34px 0 4px;font-family:"Clash Display","General Sans",sans-serif;font-size:19px;font-weight:600;}'
  + '.sg-sec-sub{text-align:center;color:#9aa39a;font-size:13px;margin:0 0 16px;}'
  /* demo phone */
  + '.sg-demo{margin:38px auto 0;max-width:1000px;}'
  + '.sg-demo-grid{display:grid;gap:22px;justify-items:center;grid-template-areas:"head" "phone" "steps";}'
  + '.sg-demo-head{grid-area:head;width:100%;max-width:420px;}'
  + '.sg-demo-phone{grid-area:phone;}'
  + '.sg-steps-wrap{grid-area:steps;width:100%;max-width:460px;min-width:0;}'
  + '.sg-demo-grid>*{min-width:0;max-width:100%;}'
  + '.sg-kicker2{color:#2ee84d;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:7px;}'
  + '.sg-kicker2::before{content:"";width:6px;height:6px;border-radius:50%;background:#2ee84d;}'
  + '.sg-demo-head h3{font-family:"Clash Display","General Sans",sans-serif;font-size:25px;line-height:1.15;margin:0 0 8px;font-weight:600;}'
  + '.sg-demo-head p.lead2{color:#9aa39a;font-size:14.5px;line-height:1.5;margin:0 0 18px;}'
  + '.sg-steps{list-style:none;margin:0;padding:2px 0 6px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;}'
  + '.sg-steps::-webkit-scrollbar{display:none;}'
  + '.sg-steps li{margin:0;flex:0 0 auto;}'
  + '.sg-steps button{display:flex;align-items:center;gap:8px;background:rgba(10,15,11,.6);border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:8px 14px 8px 8px;color:#9aa39a;font-family:inherit;font-size:14px;cursor:pointer;white-space:nowrap;transition:all .2s;}'
  + '.sg-steps .num{width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:10px;transition:all .2s;}'
  + '.sg-steps button.on{color:#f5f7f4;font-weight:600;border-color:rgba(46,232,77,.55);background:rgba(46,232,77,.08);}'
  + '.sg-steps button.on .num{background:#2ee84d;border-color:#2ee84d;color:#06210c;font-weight:700;}'
  + '.sg-device{width:300px;margin:0 auto;padding:10px;border-radius:46px;background:linear-gradient(155deg,#6b756d 0%,#252c26 18%,#161b17 52%,#2f372f 78%,#5c665e 100%);box-shadow:0 34px 70px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.16),0 0 60px rgba(46,232,77,.1),inset 0 1px 2px rgba(255,255,255,.22);}'
  + '.sg-screenbox{position:relative;width:280px;height:531px;margin:0 auto;border-radius:38px;overflow:hidden;background:#070907;}'
  + '.sg-island{position:absolute;top:9px;left:50%;transform:translateX(-50%);width:76px;height:21px;border-radius:999px;background:#000;z-index:4;}'
  + '.sg-status{position:relative;z-index:3;height:34px;display:flex;align-items:center;justify-content:space-between;padding:0 15px;background:#070907;color:#fff;font-size:11.5px;font-weight:600;letter-spacing:.02em;}'
  + '.sg-status svg{display:block;}'
  + '.sg-statusicons{display:flex;align-items:center;gap:5px;}'
  + '.sg-home{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);width:104px;height:4px;border-radius:999px;background:rgba(255,255,255,.5);z-index:4;}'
  + '.sg-viewport{position:relative;width:280px;height:497px;overflow:hidden;background:#070907;}'
  + '.sg-fallback{position:absolute;inset:0;width:280px;height:497px;object-fit:cover;object-position:top center;}'
  + '.sg-live .sg-fallback{display:none;}'
  + '.sg-frame{position:relative;z-index:1;width:390px;height:692px;border:0;display:block;background:#070907;transform:scale(.7179);transform-origin:top left;}'
  + '.sg-caption{text-align:center;color:#b9c1b9;font-size:13.5px;margin:12px auto 0;max-width:330px;min-height:19px;}'
  + '.sg-demo-hint{text-align:center;color:#606960;font-size:12px;margin-top:8px;}'
  + '@media(min-width:900px){.sg-demo{width:min(1000px,calc(100vw - 60px));margin-left:50%;transform:translateX(-50%);}.sg-demo-grid{grid-template-areas:"head phone" "steps phone";grid-template-columns:1fr auto;align-items:center;justify-items:start;column-gap:48px;row-gap:18px;}.sg-demo-head{text-align:left;max-width:460px}.sg-demo-head h3{font-size:34px}.sg-caption{text-align:left;margin-left:0;max-width:460px}.sg-steps-wrap{max-width:100%}.sg-steps{flex-wrap:wrap;overflow:visible}}'
  + '@media(max-width:360px){.sg-device{width:272px;padding:9px}.sg-screenbox{width:254px;height:485px}.sg-viewport,.sg-fallback{width:254px;height:451px}.sg-frame{transform:scale(.6513)}}'
  + '.sg-access{margin-top:30px;text-align:center;}'
  + '.sg-access summary{color:#9aa39a;font-size:13px;cursor:pointer;list-style:none;}'
  + '.sg-access summary::-webkit-details-marker{display:none;}'
  + '.sg-access .sg-card{margin-top:12px;text-align:left;}'
  + '.sg-link{display:block;width:100%;margin-top:10px;background:none;border:0;color:#9aa39a;font-size:13px;font-family:inherit;text-decoration:underline;cursor:pointer;padding:6px;}'
  + '.sg-foot{text-align:center;color:#4e564e;font-size:11px;margin-top:26px;line-height:1.6;}'
  + '.sg-foot a{color:#8d968d;text-decoration:none;}'
  + '';

  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- demo: capturas reales de la app ---------- */
  var STEPS = [
    { view:'home',      step:'Inicio',  cap:'Tu red rider al abrir: spots cercanos, eventos y accesos rapidos.' },
    { view:'map',       step:'Mapa',    cap:'Skateparks, spots de calle y tiendas. Desliza dentro del mapa para ver la ficha del spot.' },
    { view:'events',    step:'Eventos', cap:'Competencias y juntadas con inscripcion, resultados y ranking.' },
    { view:'market',    step:'Market',  cap:'Usados entre riders, con contacto directo por WhatsApp.' },
    { view:'community', step:'Foro',    cap:'La escena hablando: fotos, likes y comentarios.' },
    { view:'profile',   step:'Perfil',  cap:'Tu muro, tus podios, tus redes y tu SPOTRA ID.' }
  ];




  function demoHTML(){
    var steps = STEPS.map(function(s, i){
      return '<li><button type="button" data-shot="' + i + '" class="' + (i === 0 ? 'on' : '') + '">'
        + '<span class="num">0' + (i + 1) + '</span>' + s.step + '</button></li>';
    }).join('');
    var status = '<div class="sg-status"><span>9:41</span><span class="sg-statusicons">'
      + '<svg width="17" height="11" viewBox="0 0 17 11" fill="#fff"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>'
      + '<svg width="15" height="11" viewBox="0 0 16 12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M1 4.2a10 10 0 0 1 14 0"/><path d="M3.6 7a6.4 6.4 0 0 1 8.8 0"/><path d="M6.2 9.7a2.7 2.7 0 0 1 3.6 0"/></svg>'
      + '<svg width="24" height="12" viewBox="0 0 26 13" fill="none"><rect x=".7" y=".7" width="21" height="11.6" rx="3.4" stroke="rgba(255,255,255,.5)"/><rect x="2.4" y="2.4" width="17.6" height="8.2" rx="2.2" fill="#2ee84d"/><path d="M23.4 4.6v3.8c1.2-.3 1.8-1 1.8-1.9s-.6-1.6-1.8-1.9Z" fill="rgba(255,255,255,.5)"/></svg>'
      + '</span></div>';
    var phone = '<div class="sg-demo-phone"><div class="sg-device"><div class="sg-screenbox">'
      + '<div class="sg-island"></div>' + status
      + '<div class="sg-viewport">'
      +   '<img class="sg-fallback" src="assets/preview/p1-inicio.webp" alt="">'
      +   '<iframe class="sg-frame" id="sgFrame" src="demo.html" title="SPOTRA en funcionamiento" loading="lazy"></iframe>'
      + '</div>'
      + '<div class="sg-home"></div>'
      + '</div></div></div>';
    return '<section class="sg-demo"><div class="sg-demo-grid">'
      + '<div class="sg-demo-head">'
      +   '<div class="sg-kicker2">Recorrido por la app</div>'
      +   '<h3>Mira <span id="sgCapT">' + STEPS[0].step + '</span> por dentro</h3>'
      +   '<p class="lead2">Es SPOTRA funcionando. Tocá la barra de abajo del telefono, deslizá las pantallas o elegí una de la lista.</p>'
      + '</div>'
      + phone
      + '<div class="sg-steps-wrap">'
      +   '<ol class="sg-steps" id="sgSteps">' + steps + '</ol>'
      +   '<p class="sg-caption" id="sgCap">' + STEPS[0].cap + '</p>'
      + '</div>'
      + '</div></section>';
  }

  function wireGallery(){
    var frame = gate.querySelector('#sgFrame');
    var steps = gate.querySelector('#sgSteps');
    var capT = gate.querySelector('#sgCapT');
    var cap = gate.querySelector('#sgCap');
    if(!frame || !steps) return;

    function paint(view){
      var i = 0;
      STEPS.forEach(function(s, n){ if(s.view === view) i = n; });
      Array.prototype.forEach.call(steps.querySelectorAll('button'), function(b, n){
        b.classList.toggle('on', n === i);
      });
      if(capT) capT.textContent = STEPS[i].step;
      if(cap) cap.textContent = STEPS[i].cap;
    }

    steps.addEventListener('click', function(ev){
      var b = ev.target.closest('[data-shot]');
      if(!b) return;
      var s = STEPS[parseInt(b.getAttribute('data-shot'), 10)];
      if(!s) return;
      paint(s.view);
      try { frame.contentWindow.postMessage({ spotraGo: s.view }, '*'); } catch(e){}
    });

    window.addEventListener('message', function(ev){
      var d = ev.data || {};
      if(d.spotraReady){ gate.classList.add('sg-live'); }
      if(d.spotraView){ paint(d.spotraView); }
    });
  }

  /* ---------- overlay ---------- */
  var gate = document.createElement('div');
  gate.className = 'spotra-gate';
  gate.innerHTML = ''
  + '<div class="sg-bg"></div><div class="sg-grid"></div><div class="sg-glow"></div>'
  + '<div class="sg-wrap">'
  +   '<div class="sg-logo">SPOT<span>RA</span></div>'
  +   '<div class="sg-kicker">Proximamente</div>'
  +   '<h1 class="sg-h1">Estamos creando la mejor app para <em>skaters de Latinoamerica</em></h1>'
  +   '<p class="sg-sub">Mapa colaborativo de spots, eventos con ranking, market de usados entre riders y foro. Todo en un solo lugar.</p>'
  +   '<div class="sg-card">'
  +     '<h2>Queres ser parte?</h2>'
  +     '<p class="hint">Dejanos tu nombre y tu numero. Te avisamos primero cuando abramos.</p>'
  +     '<form id="sgForm" novalidate>'
  +       '<div class="sg-field"><label for="sgName">Nombre</label><input id="sgName" name="nombre" type="text" autocomplete="name" placeholder="Tu nombre" required></div>'
  +       '<div class="sg-field"><label for="sgPhone">Telefono (WhatsApp)</label><input id="sgPhone" name="telefono" type="tel" inputmode="tel" autocomplete="tel" placeholder="099 123 456" required></div>'
  +       '<div class="sg-field"><label for="sgDisc">Que andas</label><select id="sgDisc" name="disciplina"><option value="skate">Skate</option><option value="bmx">BMX</option><option value="rollers">Rollers</option><option value="otro">Otro / solo miro</option></select></div>'
  +       '<button class="sg-btn" type="submit" id="sgSubmit">Quiero estar en la lista</button>'
  +     '</form>'
  +     '<div class="sg-msg" id="sgMsg"></div>'
  +   '</div>'
  +   demoHTML()
  +   '<p class="sg-demo-hint">Demo navegable con datos de ejemplo. Version en desarrollo.</p>'
  +   '<p class="sg-foot">SPOTRA · Uruguay<br><a href="https://instagram.com/spotra.ok" target="_blank" rel="noopener">@spotra.ok</a> · spotra.2026@gmail.com</p>'
  + '</div>';

  function mount(){
    document.body.appendChild(gate);
    wire();
  }

  function wire(){
    wireGallery();
    /* lista de espera */
    var form = gate.querySelector('#sgForm');
    var msg = gate.querySelector('#sgMsg');
    var submit = gate.querySelector('#sgSubmit');

    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var nombre = gate.querySelector('#sgName').value.trim();
      var telefono = gate.querySelector('#sgPhone').value.trim();
      var disciplina = gate.querySelector('#sgDisc').value;

      msg.className = 'sg-msg';
      if(nombre.length < 2){ show('err', 'Escribi tu nombre.'); return; }
      if(telefono.replace(/\D/g,'').length < 7){ show('err', 'Escribi un telefono valido.'); return; }

      submit.disabled = true;
      submit.textContent = 'Guardando...';

      saveLead({ nombre:nombre, telefono:telefono, disciplina:disciplina })
        .then(function(res){
          submit.disabled = false;
          submit.textContent = 'Quiero estar en la lista';
          if(res.ok){
            form.style.display = 'none';
            show('ok', 'Listo ' + nombre + '. Ya estas en la lista. Te escribimos cuando abramos.');
          } else if(res.duplicate){
            show('ok', 'Ese numero ya estaba anotado. Tranquilo, te avisamos igual.');
          } else {
            show('err', 'No pudimos guardarlo ahora. Mandanos los datos por WhatsApp: '
              + '<a href="https://wa.me/' + WHATSAPP_FALLBACK + '?text='
              + encodeURIComponent('Hola SPOTRA, quiero estar en la lista. Nombre: ' + nombre + ' - Tel: ' + telefono + ' - ' + disciplina)
              + '" target="_blank" rel="noopener">abrir WhatsApp</a>');
          }
        });
    });

    function show(kind, html){
      msg.className = 'sg-msg ' + kind;
      msg.innerHTML = html;
    }

  }

  /* ---------- guardado en Supabase (tabla waitlist) ---------- */
  function saveLead(data){
    if(!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY){
      return Promise.resolve({ ok:false });
    }
    return fetch(cfg.SUPABASE_URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: {
        'apikey': cfg.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        nombre: data.nombre,
        telefono: data.telefono,
        disciplina: data.disciplina,
        origen: 'landing'
      })
    }).then(function(r){
      if(r.ok) return { ok:true };
      return r.text().then(function(t){
        var dup = r.status === 409 || (t && t.indexOf('duplicate') !== -1) || (t && t.indexOf('23505') !== -1);
        console.warn('[SPOTRA] waitlist:', r.status, t);
        return { ok:false, duplicate:dup };
      });
    }).catch(function(err){
      console.warn('[SPOTRA] waitlist error:', err);
      return { ok:false };
    });
  }

  /* ---------- pantalla privada de acceso (solo con el enlace correcto) ---------- */
  function buildAccess(){
    var el = document.createElement('div');
    el.className = 'spotra-gate';
    el.innerHTML = ''
    + '<div class="sg-bg"></div><div class="sg-grid"></div>'
    + '<div class="sg-wrap" style="padding-top:22vh">'
    +   '<div class="sg-logo">SPOT<span>RA</span></div>'
    +   '<div class="sg-kicker">Acceso privado</div>'
    +   '<div class="sg-card" style="margin-top:26px">'
    +     '<button class="sg-btn" type="button" id="sgGo">Entrar</button>'
    +     '<div id="sgSetup" style="display:none;margin-top:14px;border-top:1px solid rgba(255,255,255,.1);padding-top:14px">'
    +       '<p class="hint" style="margin:0 0 10px">Activa Face ID / Touch ID en este dispositivo. Despues, cada vez que abras el enlace te va a pedir la cara o la huella.</p>'
    +       '<button class="sg-btn" type="button" id="sgAdd">Activar Face ID / Touch ID</button>'
    +       '<button class="sg-link" type="button" id="sgSkip">Entrar sin activarlo</button>'
    +     '</div>'
    +     '<div class="sg-msg" id="sgAccMsg"></div>'
    +   '</div>'
    + '</div>';
    return el;
  }

  function mountAccess(){
    var el = buildAccess();
    document.body.appendChild(el);
    var go = el.querySelector('#sgGo');
    var setup = el.querySelector('#sgSetup');
    var addBtn = el.querySelector('#sgAdd');
    var skipBtn = el.querySelector('#sgSkip');
    var msg = el.querySelector('#sgAccMsg');

    function say(kind, text){
      msg.className = 'sg-msg ' + kind;
      msg.textContent = text;
    }
    function enterApp(){
      unlockSession();
      say('ok', 'Abriendo la app...');
      setTimeout(function(){ location.reload(); }, 350);
    }

    if(hasBio() && bioSupported){
      go.textContent = 'Entrar con Face ID';
    }

    go.addEventListener('click', function(){
      say('', '');
      if(hasBio() && bioSupported){
        bioLogin().then(enterApp).catch(function(err){
          console.warn('[SPOTRA] Face ID:', err);
          say('err', 'No se pudo verificar. Proba de nuevo.');
        });
        return;
      }
      if(bioSupported){
        go.style.display = 'none';
        setup.style.display = 'block';
        return;
      }
      enterApp();
    });

    addBtn.addEventListener('click', function(){
      addBtn.disabled = true;
      addBtn.textContent = 'Esperando a Face ID...';
      bioRegister().then(enterApp).catch(function(err){
        console.warn('[SPOTRA] registro Face ID:', err);
        addBtn.disabled = false;
        addBtn.textContent = 'Activar Face ID / Touch ID';
        say('err', 'Este dispositivo no pudo registrar Face ID.');
      });
    });

    skipBtn.addEventListener('click', function(){
      unlockRemembered();
      enterApp();
    });
  }

  /* ---------- arranque ---------- */
  function start(){
    var secret = secretFromUrl();
    if(!secret){ mount(); return; }
    cleanUrl();
    derive(secret).then(function(h){
      if(h === HASH_ACCESO){ mountAccess(); }
      else { mount(); }
    }).catch(function(){ mount(); });
  }

  if(document.body){ start(); }
  else { document.addEventListener('DOMContentLoaded', start); }
})();
