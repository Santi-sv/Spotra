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
  + '.spotra-gate{position:fixed;inset:0;z-index:99999;overflow-y:auto;-webkit-overflow-scrolling:touch;background:radial-gradient(120% 80% at 50% 0%,#121a13 0%,#070907 60%);color:#f5f7f4;font-family:"General Sans",system-ui,-apple-system,sans-serif;}'
  + '.sg-wrap{max-width:560px;margin:0 auto;padding:28px 18px 56px;}'
  + '.sg-logo{font-family:"Clash Display","General Sans",sans-serif;font-weight:700;font-size:26px;letter-spacing:.14em;color:#fff;text-align:center;}'
  + '.sg-logo span{color:#2ee84d;}'
  + '.sg-kicker{text-align:center;color:#2ee84d;font-size:11px;letter-spacing:.22em;text-transform:uppercase;margin-top:6px;font-weight:600;}'
  + '.sg-h1{font-family:"Clash Display","General Sans",sans-serif;font-weight:700;font-size:28px;line-height:1.15;text-align:center;margin:26px 0 10px;}'
  + '.sg-h1 em{font-style:normal;color:#2ee84d;}'
  + '.sg-sub{text-align:center;color:#9aa39a;font-size:15px;line-height:1.5;margin:0 auto 22px;max-width:420px;}'
  + '.sg-card{background:rgba(16,22,18,.9);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:18px;}'
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
  + '.sg-phone{width:296px;margin:0 auto;background:#0b0f0c;border:8px solid #1b211c;border-radius:34px;box-shadow:0 20px 50px rgba(0,0,0,.6);overflow:hidden;}'
  + '.sg-screenbox{width:280px;height:497px;overflow:hidden;position:relative;background:#070907;border-radius:26px;margin:0 auto;}'
  + '.sg-rail{display:flex;height:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;}'
  + '.sg-rail::-webkit-scrollbar{display:none;}'
  + '.sg-rail figure{flex:0 0 280px;margin:0;scroll-snap-align:center;}'
  + '.sg-rail img{width:280px;height:497px;object-fit:cover;object-position:top center;display:block;}'
  + '.sg-dots{display:flex;gap:7px;justify-content:center;margin-top:14px;}'
  + '.sg-dots button{width:8px;height:8px;padding:0;border:0;border-radius:50%;background:#2a332b;cursor:pointer;}'
  + '.sg-dots button.on{background:#2ee84d;width:20px;border-radius:999px;}'
  + '.sg-caption{text-align:center;color:#9aa39a;font-size:13px;margin:10px 0 0;min-height:19px;}'
  + '.sg-demo-hint{text-align:center;color:#606960;font-size:12px;margin-top:8px;}'
  + '@media(max-width:360px){.sg-phone{width:266px}.sg-screenbox{width:250px;height:444px}.sg-rail figure{flex-basis:250px}.sg-rail img{width:250px;height:444px}}'
  + '.sg-access{margin-top:30px;text-align:center;}'
  + '.sg-access summary{color:#9aa39a;font-size:13px;cursor:pointer;list-style:none;}'
  + '.sg-access summary::-webkit-details-marker{display:none;}'
  + '.sg-access .sg-card{margin-top:12px;text-align:left;}'
  + '.sg-link{display:block;width:100%;margin-top:10px;background:none;border:0;color:#9aa39a;font-size:13px;font-family:inherit;text-decoration:underline;cursor:pointer;padding:6px;}'
  + '.sg-foot{text-align:center;color:#4e564e;font-size:11px;margin-top:26px;line-height:1.6;}'
  + '.sg-foot a{color:#8d968d;text-decoration:none;}'
  + '@media(max-width:360px){.sg-phone{width:250px}.sg-screen{height:440px}}';

  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- demo: capturas reales de la app ---------- */
  var SHOTS = [
    { src:'assets/preview/p1-inicio.webp',  cap:'Inicio: tu red rider, spots cercanos y accesos rapidos' },
    { src:'assets/preview/p2-mapa.webp',    cap:'Mapa: skateparks, spots y tiendas cargados por riders' },
    { src:'assets/preview/p3-spot.webp',    cap:'Ficha del spot: fotos, descripcion y como llegar' },
    { src:'assets/preview/p4-eventos.webp', cap:'Eventos: competencias, inscripciones y ranking' },
    { src:'assets/preview/p7-market.webp',  cap:'Market: usados entre riders, contacto directo por WhatsApp' },
    { src:'assets/preview/p8-foro.webp',    cap:'Foro: la escena hablando, con fotos, likes y comentarios' },
    { src:'assets/preview/p5-perfil.webp',  cap:'Perfil: tu muro, tus podios y tus redes' }
  ];


  function demoHTML(){
    var slides = SHOTS.map(function(s, i){
      return '<figure><img src="' + s.src + '" alt="Pantalla de SPOTRA" ' + (i ? 'loading="lazy"' : '') + '></figure>';
    }).join('');
    var dots = SHOTS.map(function(s, i){
      return '<button type="button" data-shot="' + i + '" class="' + (i === 0 ? 'on' : '') + '" aria-label="Pantalla ' + (i+1) + '"></button>';
    }).join('');
    return '<div class="sg-phone"><div class="sg-screenbox"><div class="sg-rail" id="sgRail">' + slides + '</div></div></div>'
      + '<div class="sg-dots" id="sgDots">' + dots + '</div>'
      + '<p class="sg-caption" id="sgCap">' + SHOTS[0].cap + '</p>';
  }

  function wireGallery(){
    var rail = gate.querySelector('#sgRail');
    var dots = gate.querySelector('#sgDots');
    var cap = gate.querySelector('#sgCap');
    if(!rail || !dots) return;

    function current(){
      var fig = rail.querySelector('figure');
      var w = fig ? fig.offsetWidth : 280;
      return Math.round(rail.scrollLeft / w);
    }
    function paint(){
      var i = Math.max(0, Math.min(SHOTS.length - 1, current()));
      Array.prototype.forEach.call(dots.children, function(b, n){
        b.classList.toggle('on', n === i);
      });
      if(cap) cap.textContent = SHOTS[i].cap;
    }
    var t;
    rail.addEventListener('scroll', function(){
      clearTimeout(t);
      t = setTimeout(paint, 80);
    });
    dots.addEventListener('click', function(ev){
      var b = ev.target.closest('[data-shot]');
      if(!b) return;
      var fig = rail.querySelector('figure');
      var w = fig ? fig.offsetWidth : 280;
      rail.scrollTo({ left: w * parseInt(b.getAttribute('data-shot'), 10), behavior:'smooth' });
    });
  }

  /* ---------- overlay ---------- */
  var gate = document.createElement('div');
  gate.className = 'spotra-gate';
  gate.innerHTML = ''
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
  +   '<h3 class="sg-sec-title">Mira como va a ser por dentro</h3>'
  +   '<p class="sg-sec-sub">Capturas reales de SPOTRA. Desliza para ver las pantallas.</p>'
  +   demoHTML()
  +   '<p class="sg-demo-hint">Version en desarrollo. Algunas pantallas van a cambiar.</p>'
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
