/* SPOTRA — Capa de lanzamiento
   Idioma + landing publica + lista de espera + demo navegable + acceso privado.
   ------------------------------------------------------------------
   ENLACE DE ACCESO:  https://spotra.onrender.com/?k=TU-PALABRA
   En el codigo solo vive el hash de la palabra (PBKDF2, 250.000 vueltas).
   Para cambiarla: en la consola del navegador escribi  spotraHash('palabra-nueva')
   y pega lo que devuelve en HASH_ACCESO.
   ------------------------------------------------------------------ */
(function(){
  'use strict';

  var HASH_ACCESO = 'T6NAEk5OpQcxC441WeFdomJSqXr6OeY9bY1VPbIB+PQ=';
  var SALT = 'spotra-gate-v3';
  var ITER = 250000;
  var WHATSAPP_FALLBACK = '59896452060';
  var KEY_ACCESS = 'spotra_access';
  var KEY_BIO = 'spotra_bio_id';
  var KEY_SESSION = 'spotra_session';
  var KEY_LANG = 'spotra_lang';
  var KEY_AUD = 'spotra_aud';

  var cfg = window.SPOTRA_CONFIG || {};

  function ls(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
  function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }
  function hasBio(){ return !!ls(KEY_BIO); }

  function unlockSession(){ try { sessionStorage.setItem(KEY_SESSION,'ok'); } catch(e){} }
  function unlockRemembered(){ lsSet(KEY_ACCESS,'ok'); }

  function hasAccess(){
    try { if(sessionStorage.getItem(KEY_SESSION) === 'ok') return true; } catch(e){}
    if(hasBio()) return false;
    return ls(KEY_ACCESS) === 'ok';
  }
  function releaseLock(){ document.documentElement.classList.remove('gate-lock'); }

  if(hasAccess()){ releaseLock(); return; }
  document.documentElement.classList.add('gate-lock');

  /* ---------- enlace secreto ---------- */
  function derive(text){
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(text), 'PBKDF2', false, ['deriveBits'])
      .then(function(key){
        return crypto.subtle.deriveBits({ name:'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash:'SHA-256' }, key, 256);
      })
      .then(function(bits){
        var b = new Uint8Array(bits), out = '';
        for(var i=0;i<b.length;i++) out += String.fromCharCode(b[i]);
        return btoa(out);
      });
  }
  window.spotraHash = function(text){ return derive(text).then(function(h){ console.log(h); return h; }); };

  function secretFromUrl(){
    try { var v = new URLSearchParams(location.search).get('k'); return v ? v.trim() : ''; } catch(e){ return ''; }
  }
  function cleanUrl(){ try { history.replaceState(null, '', location.pathname); } catch(e){} }

  /* ---------- Face ID / Touch ID ---------- */
  var bioSupported = !!(window.PublicKeyCredential && navigator.credentials && location.protocol === 'https:');
  function rand(n){ var a = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(a); return a; }
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
        timeout: 60000, attestation: 'none'
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
        userVerification: 'required', timeout: 60000
      }
    }).then(function(a){ if(!a) throw new Error('cancelado'); return true; });
  }

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
  + '.sg-langscreen{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:24px;background:#070907;}'
  + '.sg-langbox{position:relative;z-index:1;width:100%;max-width:420px;text-align:center;}'
  + '.sg-langbox .sg-logo{margin-bottom:6px;}'
  + '.sg-langtitle{font-family:"Clash Display","General Sans",sans-serif;font-size:20px;font-weight:600;margin:22px 0 4px;}'
  + '.sg-langsub{color:#9aa39a;font-size:13.5px;margin:0 0 20px;}'
  + '.sg-langlist{display:grid;gap:10px;}'
  + '.sg-langlist button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:rgba(10,15,11,.82);border:1px solid rgba(255,255,255,.14);border-radius:14px;color:#f5f7f4;font-family:inherit;font-size:15px;font-weight:600;padding:14px 16px;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}'
  + '.sg-langlist button:active{border-color:#2ee84d;}'
  + '.sg-langlist b{font-size:20px;line-height:1;}'
  + '.sg-langlist span{display:block;font-size:12px;color:#9aa39a;font-weight:400;margin-top:2px;}'
  + '.sg-phonerow{display:grid;grid-template-columns:118px 1fr;gap:8px;}'
  + '.sg-phonerow select{padding-left:10px;padding-right:6px;}'
  + '.sg-langswitch{background:none;border:0;color:#8d968d;font-size:12px;font-family:inherit;text-decoration:underline;cursor:pointer;padding:4px;}'
  + '.sg-ig{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;margin-top:14px;padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(10,15,11,.8);color:#f5f7f4;font-family:inherit;font-size:14.5px;font-weight:600;cursor:pointer;text-decoration:none;}'
  + '.sg-ig svg{width:19px;height:19px;color:#2ee84d;}'
  + '.sg-benefits{display:grid;gap:10px;margin:22px 0 0;padding:0;list-style:none;}'
  + '.sg-benefits li{background:rgba(10,15,11,.82);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:15px 16px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}'
  + '.sg-benefits b{display:block;font-family:\"Clash Display\",\"General Sans\",sans-serif;font-size:16px;margin-bottom:4px;}'
  + '.sg-benefits p{margin:0;color:#9aa39a;font-size:13.5px;line-height:1.5;}'
  + '.sg-offer{margin-top:22px;border:1px solid rgba(46,232,77,.45);background:linear-gradient(160deg,rgba(46,232,77,.14),rgba(10,15,11,.9));border-radius:18px;padding:20px;text-align:center;}'
  + '.sg-offer .tag{color:#2ee84d;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;}'
  + '.sg-offer .price{font-family:\"Clash Display\",\"General Sans\",sans-serif;font-size:34px;font-weight:700;margin:6px 0 4px;}'
  + '.sg-offer p{margin:0;color:#b9c1b9;font-size:13.5px;line-height:1.5;}'
  + '.sg-audience{display:grid;gap:10px;margin-top:6px;}'
  + '.sg-audience button{display:block;width:100%;text-align:left;background:rgba(10,15,11,.82);border:1px solid rgba(255,255,255,.14);border-radius:14px;color:#f5f7f4;font-family:inherit;font-size:15.5px;font-weight:600;padding:16px;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}'
  + '.sg-audience button span{display:block;font-size:12.5px;color:#9aa39a;font-weight:400;margin-top:3px;}'
  + '.sg-audience button:active{border-color:#2ee84d;}'
  /* ----- landing de marcas ----- */
  + '.sg-brand{position:relative;z-index:1;}'
  + '.sg-topnav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0 10px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:26px;}'
  + '.sg-topnav .brandmark{font-family:\"Clash Display\",\"General Sans\",sans-serif;font-weight:700;font-size:19px;letter-spacing:.12em;}'
  + '.sg-topnav .brandmark span{color:#2ee84d;}'
  + '.sg-topnav nav{display:none;gap:22px;}'
  + '.sg-topnav nav a{color:#9aa39a;font-size:13.5px;text-decoration:none;padding-bottom:4px;}'
  + '.sg-topnav nav a.on{color:#f5f7f4;border-bottom:2px solid #2ee84d;}'
  + '.sg-navcta{border:1px solid #2ee84d;color:#2ee84d;background:none;border-radius:999px;font-family:inherit;font-size:13px;font-weight:700;padding:9px 16px;cursor:pointer;white-space:nowrap;}'
  + '.sg-hero{display:grid;gap:26px;}'
  + '.sg-hero-h1{font-family:\"Clash Display\",\"General Sans\",sans-serif;font-weight:700;font-size:34px;line-height:1.08;margin:12px 0 14px;text-shadow:0 2px 18px rgba(0,0,0,.8);}'
  + '.sg-hero-h1 em{font-style:normal;color:#2ee84d;display:block;}'
  + '.sg-hero-lead{color:#b9c1b9;font-size:15.5px;line-height:1.55;margin:0 0 20px;max-width:520px;}'
  + '.sg-ctas{display:flex;flex-wrap:wrap;gap:10px;}'
  + '.sg-cta-main{background:#2ee84d;color:#06210c;border:0;border-radius:999px;font-family:inherit;font-weight:700;font-size:15px;padding:14px 22px;cursor:pointer;}'
  + '.sg-cta-ghost{background:none;color:#f5f7f4;border:1px solid rgba(255,255,255,.25);border-radius:999px;font-family:inherit;font-weight:600;font-size:15px;padding:14px 22px;cursor:pointer;}'
  + '.sg-quote{border-left:2px solid #2ee84d;padding-left:14px;margin-top:26px;color:#cfd6cf;font-size:14.5px;line-height:1.6;font-style:italic;}'
  + '.sg-quote small{display:block;margin-top:10px;font-style:normal;color:#606960;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;}'
  + '.sg-cards{display:grid;gap:12px;margin:0;padding:0;list-style:none;}'
  + '.sg-cards li{position:relative;display:grid;grid-template-columns:46px 1fr;gap:14px;align-items:start;background:rgba(10,15,11,.82);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:16px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}'
  + '.sg-cards .ico{width:46px;height:46px;border-radius:14px;border:1px solid rgba(46,232,77,.35);display:flex;align-items:center;justify-content:center;background:rgba(46,232,77,.08);}'
  + '.sg-cards .ico svg{width:22px;height:22px;color:#2ee84d;}'
  + '.sg-cards .num{color:#606960;font-size:11px;letter-spacing:.18em;font-weight:700;}'
  + '.sg-cards b{display:block;font-family:\"Clash Display\",\"General Sans\",sans-serif;font-size:16.5px;margin:2px 0 5px;}'
  + '.sg-cards p{margin:0;color:#9aa39a;font-size:13.5px;line-height:1.5;}'
  + '.sg-offerbar{display:grid;gap:14px;align-items:center;margin:30px 0 0;border:1px solid rgba(46,232,77,.45);background:linear-gradient(140deg,rgba(46,232,77,.16),rgba(10,15,11,.92));border-radius:20px;padding:22px;}'
  + '.sg-offerbar .tag{color:#2ee84d;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;}'
  + '.sg-offerbar .price{font-family:\"Clash Display\",\"General Sans\",sans-serif;font-size:38px;font-weight:700;line-height:1;margin:6px 0 0;}'
  + '.sg-offerbar p{margin:0;color:#cfd6cf;font-size:14px;line-height:1.55;}'
  + '.sg-final{display:grid;gap:24px;margin-top:34px;}'
  + '.sg-bullets{display:grid;gap:14px;margin:18px 0 0;padding:0;list-style:none;}'
  + '.sg-bullets li{display:grid;grid-template-columns:42px 1fr;gap:13px;align-items:start;}'
  + '.sg-bullets .ico{width:42px;height:42px;border-radius:13px;border:1px solid rgba(46,232,77,.3);background:rgba(46,232,77,.07);display:flex;align-items:center;justify-content:center;}'
  + '.sg-bullets .ico svg{width:20px;height:20px;color:#2ee84d;}'
  + '.sg-bullets b{display:block;font-size:15px;margin-bottom:3px;}'
  + '.sg-bullets p{margin:0;color:#9aa39a;font-size:13.5px;line-height:1.5;}'
  + '@media(min-width:900px){'
  +   '.sg-brand .sg-wrapinner{max-width:1100px;margin:0 auto;}'
  +   '.sg-topnav nav{display:flex;}'
  +   '.sg-hero{grid-template-columns:1.05fr 1fr;align-items:start;gap:42px;}'
  +   '.sg-hero-h1{font-size:50px;}'
  +   '.sg-offerbar{grid-template-columns:auto 1fr;gap:28px;}'
  +   '.sg-final{grid-template-columns:1fr 1fr;align-items:start;gap:40px;}'
  +   '.sg-brand .sg-card{margin-top:0;}'
  + '}'
  + '@media(min-width:900px){.sg-demo-grid{align-items:start}.sg-steps-wrap{margin-top:6px}}'
  + '.sg-bg.brand{background-image:url(\"assets/preview/brand-hero-mobile.webp\");background-position:center top;}'
  + '@media(min-width:900px){.sg-bg.brand{background-image:url(\"assets/preview/brand-hero.webp\");background-position:center top;background-size:100% auto;}}'
  + '.sg-bg.brand::after{background:linear-gradient(180deg,rgba(7,9,7,.35) 0%,rgba(7,9,7,.72) 34%,rgba(7,9,7,.94) 62%,#070907 82%);}';


  /* ---------- idiomas ---------- */
  var LANGS = [
    { code:'es-uy', flag:'\uD83C\uDDFA\uD83C\uDDFE', name:'Español', note:'Rio de la Plata' },
    { code:'es',    flag:'\uD83C\uDDF2\uD83C\uDDFD', name:'Español', note:'Latinoamerica' },
    { code:'pt-br', flag:'\uD83C\uDDE7\uD83C\uDDF7', name:'Português', note:'Brasil' },
    { code:'en',    flag:'\uD83C\uDDFA\uD83C\uDDF8', name:'English', note:'International' }
  ];

  var T = {
    'es-uy': {
      kicker:'Proximamente',
      h1a:'Estamos creando la mejor app para ', h1b:'skaters de Latinoamerica',
      sub:'Mapa colaborativo de spots, eventos con ranking, market de usados entre riders y foro. Todo en un solo lugar.',
      formTitle:'Queres ser parte?',
      formHint:'Dejanos tu nombre y tu numero. Te avisamos primero cuando abramos.',
      name:'Nombre', namePh:'Tu nombre',
      country:'Pais', phone:'Telefono (WhatsApp)', phonePh:'99 123 456',
      disc:'Que andas', discSkate:'Skate', discBmx:'BMX', discRollers:'Rollers', discOther:'Otro / solo miro',
      send:'Quiero estar en la lista', sending:'Guardando...',
      errName:'Escribi tu nombre.', errPhone:'Escribi un telefono valido.', errCountry:'Elegi tu pais.',
      ok:'Listo {n}. Ya estas en la lista. Te escribimos cuando abramos.',
      dup:'Ese numero ya estaba anotado. Tranquilo, te avisamos igual.',
      fail:'No pudimos guardarlo ahora. Mandanos los datos por WhatsApp: ',
      failLink:'abrir WhatsApp',
      demoKicker:'Recorrido por la app',
      demoTitleA:'Mira ', demoTitleB:' por dentro',
      demoLead:'Es SPOTRA funcionando. Toca la barra de abajo del telefono, desliza las pantallas o elegi una de la lista.',
      demoHint:'Demo navegable con datos de ejemplo. Version en desarrollo.',
      changeLang:'Cambiar idioma',
      accessTitle:'Acceso privado', enter:'Entrar', enterBio:'Entrar con Face ID',
      bioSetup:'Activa Face ID / Touch ID en este dispositivo. Despues, cada vez que abras el enlace te pide la cara o la huella.',
      bioAdd:'Activar Face ID / Touch ID', bioSkip:'Entrar sin activarlo',
      bioFail:'No se pudo verificar. Proba de nuevo.', bioNo:'Este dispositivo no pudo registrar Face ID.',
      opening:'Abriendo la app...',
      steps:['Inicio','Mapa','Eventos','Market','Foro','Perfil'],
      caps:['Tu red rider al abrir: spots cercanos, eventos y accesos rapidos.',
            'Skateparks, spots de calle y tiendas. Desliza dentro del mapa para ver la ficha del spot.',
            'Competencias y juntadas con inscripcion, resultados y ranking.',
            'Usados entre riders, con contacto directo por WhatsApp.',
            'La escena hablando: fotos, likes y comentarios.',
            'Tu muro, tus podios, tus redes y tu SPOTRA ID.']
    },
    'es': {
      kicker:'Proximamente',
      h1a:'Estamos creando la mejor app para ', h1b:'skaters de Latinoamerica',
      sub:'Mapa colaborativo de spots, eventos con ranking, mercado de usados entre riders y foro. Todo en un solo lugar.',
      formTitle:'Quieres ser parte?',
      formHint:'Dejanos tu nombre y tu numero. Te avisamos primero cuando abramos.',
      name:'Nombre', namePh:'Tu nombre',
      country:'Pais', phone:'Telefono (WhatsApp)', phonePh:'99 123 456',
      disc:'Que practicas', discSkate:'Skate', discBmx:'BMX', discRollers:'Patines', discOther:'Otro / solo miro',
      send:'Quiero estar en la lista', sending:'Guardando...',
      errName:'Escribe tu nombre.', errPhone:'Escribe un telefono valido.', errCountry:'Elige tu pais.',
      ok:'Listo {n}. Ya estas en la lista. Te escribimos cuando abramos.',
      dup:'Ese numero ya estaba anotado. Igual te avisamos.',
      fail:'No pudimos guardarlo ahora. Mandanos los datos por WhatsApp: ',
      failLink:'abrir WhatsApp',
      demoKicker:'Recorrido por la app',
      demoTitleA:'Mira ', demoTitleB:' por dentro',
      demoLead:'Es SPOTRA funcionando. Toca la barra de abajo del telefono, desliza las pantallas o elige una de la lista.',
      demoHint:'Demo navegable con datos de ejemplo. Version en desarrollo.',
      changeLang:'Cambiar idioma',
      accessTitle:'Acceso privado', enter:'Entrar', enterBio:'Entrar con Face ID',
      bioSetup:'Activa Face ID / Touch ID en este dispositivo. Despues, cada vez que abras el enlace te pide la cara o la huella.',
      bioAdd:'Activar Face ID / Touch ID', bioSkip:'Entrar sin activarlo',
      bioFail:'No se pudo verificar. Intenta de nuevo.', bioNo:'Este dispositivo no pudo registrar Face ID.',
      opening:'Abriendo la app...',
      steps:['Inicio','Mapa','Eventos','Mercado','Foro','Perfil'],
      caps:['Tu red rider al abrir: spots cercanos, eventos y accesos rapidos.',
            'Skateparks, spots de calle y tiendas. Desliza dentro del mapa para ver la ficha del spot.',
            'Competencias y quedadas con inscripcion, resultados y ranking.',
            'Usados entre riders, con contacto directo por WhatsApp.',
            'La escena hablando: fotos, likes y comentarios.',
            'Tu muro, tus podios, tus redes y tu SPOTRA ID.']
    },
    'pt-br': {
      kicker:'Em breve',
      h1a:'Estamos criando o melhor app para ', h1b:'skatistas da America Latina',
      sub:'Mapa colaborativo de picos, eventos com ranking, mercado de usados entre riders e forum. Tudo em um so lugar.',
      formTitle:'Quer fazer parte?',
      formHint:'Deixe seu nome e seu numero. Avisamos voce primeiro quando abrirmos.',
      name:'Nome', namePh:'Seu nome',
      country:'Pais', phone:'Telefone (WhatsApp)', phonePh:'11 91234 5678',
      disc:'O que voce anda', discSkate:'Skate', discBmx:'BMX', discRollers:'Patins', discOther:'Outro / so olhando',
      send:'Quero entrar na lista', sending:'Salvando...',
      errName:'Escreva seu nome.', errPhone:'Escreva um telefone valido.', errCountry:'Escolha seu pais.',
      ok:'Pronto {n}. Voce esta na lista. A gente avisa quando abrir.',
      dup:'Esse numero ja estava na lista. Vamos avisar voce do mesmo jeito.',
      fail:'Nao conseguimos salvar agora. Mande seus dados pelo WhatsApp: ',
      failLink:'abrir WhatsApp',
      demoKicker:'Passeio pelo app',
      demoTitleA:'Veja ', demoTitleB:' por dentro',
      demoLead:'E o SPOTRA funcionando. Toque na barra de baixo do celular, deslize as telas ou escolha uma da lista.',
      demoHint:'Demo navegavel com dados de exemplo. Versao em desenvolvimento.',
      changeLang:'Mudar idioma',
      accessTitle:'Acesso privado', enter:'Entrar', enterBio:'Entrar com Face ID',
      bioSetup:'Ative Face ID / Touch ID neste aparelho. Depois, toda vez que abrir o link ele pede seu rosto ou digital.',
      bioAdd:'Ativar Face ID / Touch ID', bioSkip:'Entrar sem ativar',
      bioFail:'Nao foi possivel verificar. Tente de novo.', bioNo:'Este aparelho nao conseguiu registrar Face ID.',
      opening:'Abrindo o app...',
      steps:['Inicio','Mapa','Eventos','Mercado','Forum','Perfil'],
      caps:['Sua rede rider ao abrir: picos proximos, eventos e atalhos.',
            'Pistas, picos de rua e lojas. Deslize dentro do mapa para ver a ficha do pico.',
            'Campeonatos e encontros com inscricao, resultados e ranking.',
            'Usados entre riders, com contato direto pelo WhatsApp.',
            'A cena conversando: fotos, curtidas e comentarios.',
            'Seu mural, seus podios, suas redes e seu SPOTRA ID.']
    },
    'en': {
      kicker:'Coming soon',
      h1a:'We are building the best app for ', h1b:'Latin American skaters',
      sub:'Collaborative spot map, events with rankings, rider-to-rider used gear market and forum. All in one place.',
      formTitle:'Want in?',
      formHint:'Leave your name and number. You will be the first to know when we open.',
      name:'Name', namePh:'Your name',
      country:'Country', phone:'Phone (WhatsApp)', phonePh:'555 123 456',
      disc:'What you ride', discSkate:'Skate', discBmx:'BMX', discRollers:'Rollers', discOther:'Other / just looking',
      send:'Add me to the list', sending:'Saving...',
      errName:'Please write your name.', errPhone:'Please write a valid phone.', errCountry:'Pick your country.',
      ok:'Done {n}. You are on the list. We will text you when we open.',
      dup:'That number was already on the list. We will still reach out.',
      fail:'We could not save it right now. Send us your details on WhatsApp: ',
      failLink:'open WhatsApp',
      demoKicker:'App walkthrough',
      demoTitleA:'See ', demoTitleB:' from the inside',
      demoLead:'This is SPOTRA running. Tap the bottom bar of the phone, swipe the screens or pick one from the list.',
      demoHint:'Interactive demo with sample data. Work in progress.',
      changeLang:'Change language',
      accessTitle:'Private access', enter:'Enter', enterBio:'Enter with Face ID',
      bioSetup:'Turn on Face ID / Touch ID on this device. From then on, the link will ask for your face or fingerprint.',
      bioAdd:'Turn on Face ID / Touch ID', bioSkip:'Enter without it',
      bioFail:'Could not verify. Try again.', bioNo:'This device could not register Face ID.',
      opening:'Opening the app...',
      steps:['Home','Map','Events','Market','Forum','Profile'],
      caps:['Your rider network at a glance: nearby spots, events and shortcuts.',
            'Skateparks, street spots and shops. Swipe inside the map to open the spot sheet.',
            'Contests and meetups with signups, results and rankings.',
            'Used gear between riders, with direct WhatsApp contact.',
            'The scene talking: photos, likes and comments.',
            'Your wall, your podiums, your socials and your SPOTRA ID.']
    }
  };

  var IG_URL = 'https://instagram.com/spotra.ok';

  var AUD = {
    'es-uy': { title:'Como entras a SPOTRA?', rider:'Soy rider', riderNote:'Ando en skate, BMX o rollers',
               brand:'Soy marca o tienda', brandNote:'Vendo, auspicio o doy clases', back:'Volver' },
    'es':    { title:'Como entras a SPOTRA?', rider:'Soy rider', riderNote:'Ando en patineta, BMX o patines',
               brand:'Soy marca o tienda', brandNote:'Vendo, patrocino o doy clases', back:'Volver' },
    'pt-br': { title:'Como voce entra no SPOTRA?', rider:'Sou rider', riderNote:'Ando de skate, BMX ou patins',
               brand:'Sou marca ou loja', brandNote:'Vendo, patrocino ou dou aulas', back:'Voltar' },
    'en':    { title:'How do you come into SPOTRA?', rider:'I am a rider', riderNote:'I skate, ride BMX or rollers',
               brand:'I am a brand or shop', brandNote:'I sell, sponsor or teach', back:'Back' }
  };

  var B = {
    'es-uy': {
      kicker:'Para marcas y tiendas',
      h1a:'Tu marca, donde los riders ', h1b:'realmente estan',
      sub:'SPOTRA es el mapa y la comunidad de skate, BMX y rollers de Latinoamerica. Tu tienda aparece adentro de la app, no al costado.',
      benefits:[
        ['Perfil verificado en el mapa','Tu local con fotos, horarios, redes y como llegar. Te encuentran mientras buscan spots.'],
        ['Eventos con tu nombre','Auspicia competencias y juntadas: tu marca en la ficha del evento, en las inscripciones y en el podio.'],
        ['Publicaciones en el Market','Subi producto y la gente te escribe directo por WhatsApp. Sin comisiones por venta.'],
        ['Alcance regional','Uruguay primero, despues Argentina y Brasil. La misma escena en un solo lugar.'],
        ['Numeros claros','Cuanta gente vio tu perfil, de que zona es y que disciplina practica.']
      ],
      offerTag:'Prueba para las primeras marcas',
      offerPrice:'USD 0,99',
      offerNote:'Los primeros 3 meses completos. Sin permanencia: si no te sirve, te das de baja y listo.',
      formTitle:'Queres probarla?',
      formHint:'Dejanos los datos y te escribimos para darte el acceso.',
      brandName:'Marca o tienda', brandPh:'Nombre de tu marca',
      contact:'Nombre de contacto',
      kind:'Que hacen', kindShop:'Tienda', kindBrand:'Marca', kindSchool:'Escuela o clases', kindOther:'Otro',
      send:'Quiero probar SPOTRA',
      ok:'Listo. Te escribimos por WhatsApp para darte el acceso.',
      ig:'Seguinos en Instagram',
      navBrands:"Para Marcas",
      navDemo:"La app",
      navJoin:"Sumate",
      seeHow:"Ver como funciona",
      quote:"Mas riders. Mas comunidad. Mas movimiento.",
      quoteFoot:"Latinoamerica rueda aqui",
      joinKicker:"Acceso anticipado para marcas y tiendas",
      formCardTitle:"Completa tus datos",
      formCardHint:"Te escribimos a la brevedad para darte el acceso y contarte como funciona.",
      bullets:[["Acceso anticipado","Se de las primeras marcas en probar la plataforma."],["3 meses completos","Con acompañamiento nuestro mientras la usas."],["Sin permanencia","Si no te sirve, te das de baja y listo."],["Una comunidad real","Riders de Uruguay, Argentina y Brasil en un solo lugar."]],
      demoKicker:'Asi se ve por dentro',
      demoTitleA:'Mira ', demoTitleB:' por dentro',
      demoLead:'Esta es la app que van a usar los riders. Toca la barra de abajo y recorrela.'
    },
    'es': {
      kicker:'Para marcas y tiendas',
      h1a:'Tu marca, donde los riders ', h1b:'realmente estan',
      sub:'SPOTRA es el mapa y la comunidad de patineta, BMX y patines de Latinoamerica. Tu tienda aparece dentro de la app, no al costado.',
      benefits:[
        ['Perfil verificado en el mapa','Tu local con fotos, horarios, redes y como llegar. Te encuentran mientras buscan spots.'],
        ['Eventos con tu nombre','Patrocina competencias y quedadas: tu marca en la ficha del evento, en las inscripciones y en el podio.'],
        ['Publicaciones en el Mercado','Sube producto y la gente te escribe directo por WhatsApp. Sin comisiones por venta.'],
        ['Alcance regional','Uruguay primero, despues Argentina y Brasil. La misma escena en un solo lugar.'],
        ['Numeros claros','Cuanta gente vio tu perfil, de que zona es y que disciplina practica.']
      ],
      offerTag:'Prueba para las primeras marcas',
      offerPrice:'USD 0,99',
      offerNote:'Los primeros 3 meses completos. Sin permanencia: si no te sirve, te das de baja y listo.',
      formTitle:'Quieres probarla?',
      formHint:'Dejanos los datos y te escribimos para darte el acceso.',
      brandName:'Marca o tienda', brandPh:'Nombre de tu marca',
      contact:'Nombre de contacto',
      kind:'Que hacen', kindShop:'Tienda', kindBrand:'Marca', kindSchool:'Escuela o clases', kindOther:'Otro',
      send:'Quiero probar SPOTRA',
      ok:'Listo. Te escribimos por WhatsApp para darte el acceso.',
      ig:'Siguenos en Instagram',
      navBrands:"Para Marcas",
      navDemo:"La app",
      navJoin:"Sumate",
      seeHow:"Ver como funciona",
      quote:"Mas riders. Mas comunidad. Mas movimiento.",
      quoteFoot:"Latinoamerica rueda aqui",
      joinKicker:"Acceso anticipado para marcas y tiendas",
      formCardTitle:"Completa tus datos",
      formCardHint:"Te escribimos pronto para darte el acceso y contarte como funciona.",
      bullets:[["Acceso anticipado","Se de las primeras marcas en probar la plataforma."],["3 meses completos","Con acompañamiento nuestro mientras la usas."],["Sin permanencia","Si no te sirve, te das de baja y listo."],["Una comunidad real","Riders de toda Latinoamerica en un solo lugar."]],
      demoKicker:'Asi se ve por dentro',
      demoTitleA:'Mira ', demoTitleB:' por dentro',
      demoLead:'Esta es la app que van a usar los riders. Toca la barra de abajo y recorrela.'
    },
    'pt-br': {
      kicker:'Para marcas e lojas',
      h1a:'Sua marca onde os riders ', h1b:'realmente estao',
      sub:'O SPOTRA e o mapa e a comunidade de skate, BMX e patins da America Latina. Sua loja aparece dentro do app, nao do lado.',
      benefits:[
        ['Perfil verificado no mapa','Sua loja com fotos, horarios, redes e como chegar. Te acham enquanto procuram picos.'],
        ['Eventos com o seu nome','Patrocine campeonatos e encontros: sua marca na ficha do evento, nas inscricoes e no podio.'],
        ['Anuncios no Mercado','Publique produto e a pessoa fala com voce direto no WhatsApp. Sem comissao por venda.'],
        ['Alcance regional','Uruguai primeiro, depois Argentina e Brasil. A mesma cena em um so lugar.'],
        ['Numeros claros','Quantas pessoas viram seu perfil, de que regiao sao e o que praticam.']
      ],
      offerTag:'Teste para as primeiras marcas',
      offerPrice:'USD 0,99',
      offerNote:'Os 3 primeiros meses completos. Sem fidelidade: se nao servir, voce cancela e pronto.',
      formTitle:'Quer testar?',
      formHint:'Deixe seus dados e a gente te escreve para liberar o acesso.',
      brandName:'Marca ou loja', brandPh:'Nome da sua marca',
      contact:'Nome do contato',
      kind:'O que voces fazem', kindShop:'Loja', kindBrand:'Marca', kindSchool:'Escola ou aulas', kindOther:'Outro',
      send:'Quero testar o SPOTRA',
      ok:'Pronto. A gente te escreve no WhatsApp para liberar o acesso.',
      ig:'Siga a gente no Instagram',
      navBrands:"Para Marcas",
      navDemo:"O app",
      navJoin:"Participe",
      seeHow:"Ver como funciona",
      quote:"Mais riders. Mais comunidade. Mais movimento.",
      quoteFoot:"A America Latina anda aqui",
      joinKicker:"Acesso antecipado para marcas e lojas",
      formCardTitle:"Preencha seus dados",
      formCardHint:"A gente te escreve em breve para liberar o acesso e explicar como funciona.",
      bullets:[["Acesso antecipado","Seja uma das primeiras marcas a testar a plataforma."],["3 meses completos","Com acompanhamento do nosso time enquanto voce usa."],["Sem fidelidade","Se nao servir, voce cancela e pronto."],["Uma comunidade real","Riders do Uruguai, Argentina e Brasil em um so lugar."]],
      demoKicker:'Como e por dentro',
      demoTitleA:'Veja ', demoTitleB:' por dentro',
      demoLead:'Esse e o app que os riders vao usar. Toque na barra de baixo e navegue.'
    },
    'en': {
      kicker:'For brands and shops',
      h1a:'Your brand where the riders ', h1b:'actually are',
      sub:'SPOTRA is the map and the community for skate, BMX and rollers in Latin America. Your shop shows up inside the app, not beside it.',
      benefits:[
        ['Verified profile on the map','Your shop with photos, hours, socials and directions. Riders find you while looking for spots.'],
        ['Events with your name on them','Sponsor contests and meetups: your brand on the event page, the signups and the podium.'],
        ['Listings in the Market','Post gear and people message you straight on WhatsApp. No sales commission.'],
        ['Regional reach','Uruguay first, then Argentina and Brazil. One scene, one place.'],
        ['Clear numbers','How many riders saw your profile, where they are and what they ride.']
      ],
      offerTag:'Trial for the first brands',
      offerPrice:'USD 0.99',
      offerNote:'For the first 3 full months. No lock-in: if it is not for you, cancel and that is it.',
      formTitle:'Want to try it?',
      formHint:'Leave your details and we will message you with access.',
      brandName:'Brand or shop', brandPh:'Your brand name',
      contact:'Contact name',
      kind:'What you do', kindShop:'Shop', kindBrand:'Brand', kindSchool:'School or lessons', kindOther:'Other',
      send:'I want to try SPOTRA',
      ok:'Done. We will message you on WhatsApp with access.',
      ig:'Follow us on Instagram',
      navBrands:"For Brands",
      navDemo:"The app",
      navJoin:"Join",
      seeHow:"See how it works",
      quote:"More riders. More community. More movement.",
      quoteFoot:"Latin America rides here",
      joinKicker:"Early access for brands and shops",
      formCardTitle:"Fill in your details",
      formCardHint:"We will message you shortly with access and walk you through it.",
      bullets:[["Early access","Be one of the first brands to try the platform."],["3 full months","With our team alongside you while you use it."],["No lock-in","If it is not for you, cancel and that is it."],["A real community","Riders across Latin America in one place."]],
      demoKicker:'What it looks like inside',
      demoTitleA:'See ', demoTitleB:' from the inside',
      demoLead:'This is the app riders will use. Tap the bottom bar and walk through it.'
    }
  };

  function a(k){ var d = AUD[lang] || AUD['es-uy']; return d[k]; }
  function b(k){ var d = B[lang] || B['es-uy']; return d[k]; }

  function igButton(label){
    return '<a class="sg-ig" href="' + IG_URL + '" target="_blank" rel="noopener">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      + '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>'
      + '<circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>'
      + esc(label) + '</a>';
  }

  var COUNTRIES = [
    { code:'UY', dial:'598', es:'Uruguay', pt:'Uruguai', en:'Uruguay' },
    { code:'AR', dial:'54',  es:'Argentina', pt:'Argentina', en:'Argentina' },
    { code:'BR', dial:'55',  es:'Brasil', pt:'Brasil', en:'Brazil' },
    { code:'CL', dial:'56',  es:'Chile', pt:'Chile', en:'Chile' },
    { code:'PY', dial:'595', es:'Paraguay', pt:'Paraguai', en:'Paraguay' },
    { code:'BO', dial:'591', es:'Bolivia', pt:'Bolivia', en:'Bolivia' },
    { code:'PE', dial:'51',  es:'Peru', pt:'Peru', en:'Peru' },
    { code:'CO', dial:'57',  es:'Colombia', pt:'Colombia', en:'Colombia' },
    { code:'EC', dial:'593', es:'Ecuador', pt:'Equador', en:'Ecuador' },
    { code:'VE', dial:'58',  es:'Venezuela', pt:'Venezuela', en:'Venezuela' },
    { code:'MX', dial:'52',  es:'Mexico', pt:'Mexico', en:'Mexico' },
    { code:'CR', dial:'506', es:'Costa Rica', pt:'Costa Rica', en:'Costa Rica' },
    { code:'PA', dial:'507', es:'Panama', pt:'Panama', en:'Panama' },
    { code:'GT', dial:'502', es:'Guatemala', pt:'Guatemala', en:'Guatemala' },
    { code:'DO', dial:'1',   es:'Rep. Dominicana', pt:'Rep. Dominicana', en:'Dominican Rep.' },
    { code:'US', dial:'1',   es:'Estados Unidos', pt:'Estados Unidos', en:'United States' },
    { code:'ES', dial:'34',  es:'España', pt:'Espanha', en:'Spain' }
  ];

  var lang = ls(KEY_LANG) || '';
  var audience = ls(KEY_AUD) || '';
  function t(k){ var d = T[lang] || T['es-uy']; return d[k]; }
  function countryName(c){
    if(lang === 'pt-br') return c.pt;
    if(lang === 'en') return c.en;
    return c.es;
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var gate = null;

  /* ---------- pantalla de idioma y publico ---------- */
  function mountLang(){
    var el = document.createElement('div');
    el.className = 'spotra-gate sg-langscreen';

    function langStep(){
      el.innerHTML = '<div class="sg-bg"></div><div class="sg-grid"></div>'
        + '<div class="sg-langbox">'
        +   '<div class="sg-logo">SPOT<span>RA</span></div>'
        +   '<div class="sg-langtitle">Elegi tu idioma · Escolha seu idioma · Choose your language</div>'
        +   '<p class="sg-langsub">SPOTRA · Uruguay</p>'
        +   '<div class="sg-langlist">'
        +     LANGS.map(function(l){
                return '<button type="button" data-lang="' + l.code + '"><b>' + l.flag + '</b>'
                  + '<span style="font-size:15px;color:#f5f7f4;font-weight:600">' + l.name
                  + '<span>' + l.note + '</span></span></button>';
              }).join('')
        +   '</div>'
        + '</div>';
    }

    function audStep(){
      el.innerHTML = '<div class="sg-bg"></div><div class="sg-grid"></div>'
        + '<div class="sg-langbox">'
        +   '<div class="sg-logo">SPOT<span>RA</span></div>'
        +   '<div class="sg-langtitle">' + esc(a('title')) + '</div>'
        +   '<div class="sg-audience">'
        +     '<button type="button" data-aud="rider">' + esc(a('rider'))
        +       '<span>' + esc(a('riderNote')) + '</span></button>'
        +     '<button type="button" data-aud="marca">' + esc(a('brand'))
        +       '<span>' + esc(a('brandNote')) + '</span></button>'
        +   '</div>'
        +   '<button class="sg-langswitch" data-aud-back="1" style="margin-top:16px">' + esc(a('back')) + '</button>'
        + '</div>';
    }

    el.addEventListener('click', function(ev){
      var l = ev.target.closest('[data-lang]');
      if(l){
        lang = l.getAttribute('data-lang');
        lsSet(KEY_LANG, lang);
        audStep();
        return;
      }
      if(ev.target.closest('[data-aud-back]')){ langStep(); return; }
      var au = ev.target.closest('[data-aud]');
      if(au){
        var aud = au.getAttribute('data-aud');
        lsSet(KEY_AUD, aud);
        el.remove();
        mountGate(aud);
      }
    });

    langStep();
    if(lang && T[lang]) audStep();
    document.body.appendChild(el);
  }

  /* ---------- demo navegable ---------- */
  var VIEWS = ['home','map','events','market','community','profile'];

  function demoHTML(kicker, titleA, titleB, lead){
    var steps = t('steps').map(function(name, i){
      return '<li><button type="button" data-shot="' + i + '" class="' + (i === 0 ? 'on' : '') + '">'
        + '<span class="num">0' + (i + 1) + '</span>' + esc(name) + '</button></li>';
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
      +   '<iframe class="sg-frame" id="sgFrame" src="demo.html" title="SPOTRA" loading="lazy"></iframe>'
      + '</div>'
      + '<div class="sg-home"></div>'
      + '</div></div></div>';
    return '<section class="sg-demo"><div class="sg-demo-grid">'
      + '<div class="sg-demo-head">'
      +   '<div class="sg-kicker2">' + esc(kicker) + '</div>'
      +   '<h3>' + esc(titleA) + '<span id="sgCapT">' + esc(t('steps')[0]) + '</span>' + esc(titleB) + '</h3>'
      +   '<p class="lead2">' + esc(lead) + '</p>'
      + '</div>'
      + phone
      + '<div class="sg-steps-wrap">'
      +   '<ol class="sg-steps" id="sgSteps">' + steps + '</ol>'
      +   '<p class="sg-caption" id="sgCap">' + esc(t('caps')[0]) + '</p>'
      + '</div>'
      + '</div></section>';
  }

  function wireDemo(){
    var frame = gate.querySelector('#sgFrame');
    var steps = gate.querySelector('#sgSteps');
    var capT = gate.querySelector('#sgCapT');
    var cap = gate.querySelector('#sgCap');
    if(!frame || !steps) return;

    function paint(view){
      var i = VIEWS.indexOf(view);
      if(i < 0) i = 0;
      Array.prototype.forEach.call(steps.querySelectorAll('button'), function(b, n){
        b.classList.toggle('on', n === i);
      });
      if(capT) capT.textContent = t('steps')[i];
      if(cap) cap.textContent = t('caps')[i];
    }
    steps.addEventListener('click', function(ev){
      var b = ev.target.closest('[data-shot]');
      if(!b) return;
      var view = VIEWS[parseInt(b.getAttribute('data-shot'), 10)];
      if(!view) return;
      paint(view);
      try { frame.contentWindow.postMessage({ spotraGo: view }, '*'); } catch(e){}
    });
    window.addEventListener('message', function(ev){
      var d = ev.data || {};
      if(d.spotraReady){ gate.classList.add('sg-live'); }
      if(d.spotraView){ paint(d.spotraView); }
    });
  }

  /* ---------- landing ---------- */
  function countrySelects(){
    var defCode = lang === 'pt-br' ? 'BR' : (lang === 'en' ? 'US' : (lang === 'es' ? 'MX' : 'UY'));
    var countryOpts = COUNTRIES.map(function(c){
      return '<option value="' + c.code + '" data-dial="' + c.dial + '"' + (c.code === defCode ? ' selected' : '') + '>'
        + esc(countryName(c)) + ' (+' + c.dial + ')</option>';
    }).join('');
    var dialOpts = COUNTRIES.map(function(c){
      return '<option value="' + c.code + '"' + (c.code === defCode ? ' selected' : '') + '>' + c.code + ' +' + c.dial + '</option>';
    }).join('');
    return { country: countryOpts, dial: dialOpts };
  }

  function footHTML(igLabel){
    return '<p class="sg-foot">SPOTRA · Uruguay<br>'
      + '<a href="' + IG_URL + '" target="_blank" rel="noopener">@spotra.ok</a> · spotra.2026@gmail.com<br>'
      + '<button class="sg-langswitch" id="sgLangSwitch">' + esc(t('changeLang')) + '</button></p>';
  }

  function mountGate(aud){
    audience = aud || ls(KEY_AUD) || 'rider';
    gate = document.createElement('div');
    gate.className = 'spotra-gate';
    var esMarca = audience === 'marca';
    gate.innerHTML = '<div class="sg-bg' + (esMarca ? ' brand' : '') + '"></div><div class="sg-grid"></div>'
      + (esMarca ? '' : '<div class="sg-glow"></div>')
      + '<div class="sg-wrap"' + (esMarca ? ' style="max-width:1140px"' : '') + '>'
      + (esMarca ? brandBody() : riderBody()) + '</div>';
    document.body.appendChild(gate);
    wireDemo();
    wireForm();
    gate.addEventListener('click', function(ev){
      var sc = ev.target.closest('[data-scroll]');
      if(!sc) return;
      var target = gate.querySelector('#' + sc.getAttribute('data-scroll'));
      if(target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    });

    gate.querySelector('#sgLangSwitch').addEventListener('click', function(){
      lsDel(KEY_LANG); lsDel(KEY_AUD);
      gate.remove(); gate = null;
      mountLang();
    });
  }

  function riderBody(){
    var sel = countrySelects();
    return ''
    + '<div class="sg-logo">SPOT<span>RA</span></div>'
    + '<div class="sg-kicker">' + esc(t('kicker')) + '</div>'
    + '<h1 class="sg-h1">' + esc(t('h1a')) + '<em>' + esc(t('h1b')) + '</em></h1>'
    + '<p class="sg-sub">' + esc(t('sub')) + '</p>'
    + '<div class="sg-card">'
    +   '<h2>' + esc(t('formTitle')) + '</h2>'
    +   '<p class="hint">' + esc(t('formHint')) + '</p>'
    +   '<form id="sgForm" novalidate>'
    +     '<div class="sg-field"><label for="sgName">' + esc(t('name')) + '</label>'
    +       '<input id="sgName" type="text" autocomplete="name" placeholder="' + esc(t('namePh')) + '" required></div>'
    +     '<div class="sg-field"><label for="sgCountry">' + esc(t('country')) + '</label>'
    +       '<select id="sgCountry">' + sel.country + '</select></div>'
    +     '<div class="sg-field"><label for="sgPhone">' + esc(t('phone')) + '</label>'
    +       '<div class="sg-phonerow"><select id="sgDial" aria-label="Prefijo">' + sel.dial + '</select>'
    +       '<input id="sgPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="' + esc(t('phonePh')) + '" required></div></div>'
    +     '<div class="sg-field"><label for="sgDisc">' + esc(t('disc')) + '</label><select id="sgDisc">'
    +       '<option value="skate">' + esc(t('discSkate')) + '</option>'
    +       '<option value="bmx">' + esc(t('discBmx')) + '</option>'
    +       '<option value="rollers">' + esc(t('discRollers')) + '</option>'
    +       '<option value="otro">' + esc(t('discOther')) + '</option>'
    +     '</select></div>'
    +     '<button class="sg-btn" type="submit" id="sgSubmit">' + esc(t('send')) + '</button>'
    +   '</form>'
    +   '<div class="sg-msg" id="sgMsg"></div>'
    +   igButton(b('ig'))
    + '</div>'
    + demoHTML(t('demoKicker'), t('demoTitleA'), t('demoTitleB'), t('demoLead'))
    + '<p class="sg-demo-hint">' + esc(t('demoHint')) + '</p>'
    + footHTML();
  }

  function icon(name){
    var paths = {
      pin:'<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
      cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      bag:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
      map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
      bars:'<path d="M5 20V12M12 20V5M19 20v-6"/>',
      rocket:'<path d="M12 3c3.5 1.6 5.6 5 5.6 9l-2.4 2.4H8.8L6.4 12C6.4 8 8.5 4.6 12 3Z"/><path d="M9 17c-1.4 1-2 2.4-2 4 1.6 0 3-.6 4-2M15 17c1.4 1 2 2.4 2 4-1.6 0-3-.6-4-2"/>',
      clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
      free:'<path d="M5 6h10l4 4v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M8 13h8M8 17h5"/>',
      people:'<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 7.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2-4.3"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
      + (paths[name] || paths.pin) + '</svg>';
  }

  function brandBody(){
    var sel = countrySelects();
    var icons = ['pin','cal','bag','map','bars'];
    var cards = b('benefits').map(function(x, i){
      return '<li><div class="ico">' + icon(icons[i] || 'pin') + '</div>'
        + '<div><div class="num">0' + (i + 1) + '</div><b>' + esc(x[0]) + '</b><p>' + esc(x[1]) + '</p></div></li>';
    }).join('');
    var bullets = b('bullets').map(function(x, i){
      return '<li><div class="ico">' + icon(['rocket','clock','free','people'][i] || 'rocket') + '</div>'
        + '<div><b>' + esc(x[0]) + '</b><p>' + esc(x[1]) + '</p></div></li>';
    }).join('');

    return '<div class="sg-brand"><div class="sg-wrapinner">'
    + '<div class="sg-topnav">'
    +   '<div class="brandmark">SPOT<span>RA</span></div>'
    +   '<nav><a href="#sgBenef" class="on">' + esc(b('navBrands')) + '</a>'
    +     '<a href="#sgDemo">' + esc(b('navDemo')) + '</a>'
    +     '<a href="#sgJoin">' + esc(b('navJoin')) + '</a></nav>'
    +   '<button class="sg-navcta" data-scroll="sgJoin">' + esc(b('send')) + '</button>'
    + '</div>'

    + '<section class="sg-hero" id="sgBenef">'
    +   '<div>'
    +     '<div class="sg-kicker" style="text-align:left">' + esc(b('kicker')) + '</div>'
    +     '<h1 class="sg-hero-h1">' + esc(b('h1a')) + '<em>' + esc(b('h1b')) + '</em></h1>'
    +     '<p class="sg-hero-lead">' + esc(b('sub')) + '</p>'
    +     '<div class="sg-ctas">'
    +       '<button class="sg-cta-main" data-scroll="sgJoin">' + esc(b('send')) + '</button>'
    +       '<button class="sg-cta-ghost" data-scroll="sgDemo">' + esc(b('seeHow')) + '</button>'
    +     '</div>'
    +     '<div class="sg-quote">' + esc(b('quote')) + '<small>' + esc(b('quoteFoot')) + '</small></div>'
    +   '</div>'
    +   '<ul class="sg-cards">' + cards + '</ul>'
    + '</section>'

    + '<div class="sg-offerbar">'
    +   '<div><div class="tag">' + esc(b('offerTag')) + '</div><div class="price">' + esc(b('offerPrice')) + '</div></div>'
    +   '<p>' + esc(b('offerNote')) + '</p>'
    + '</div>'

    + '<div id="sgDemo">' + demoHTML(b('demoKicker'), b('demoTitleA'), b('demoTitleB'), b('demoLead')) + '</div>'

    + '<section class="sg-final" id="sgJoin">'
    +   '<div>'
    +     '<div class="sg-kicker" style="text-align:left">' + esc(b('joinKicker')) + '</div>'
    +     '<h2 class="sg-hero-h1" style="font-size:32px">' + esc(b('formTitle')) + '</h2>'
    +     '<p class="sg-hero-lead">' + esc(b('formHint')) + '</p>'
    +     '<ul class="sg-bullets">' + bullets + '</ul>'
    +   '</div>'
    +   '<div class="sg-card">'
    +     '<h2>' + esc(b('formCardTitle')) + '</h2>'
    +     '<p class="hint">' + esc(b('formCardHint')) + '</p>'
    +     '<form id="sgForm" novalidate>'
    +       '<div class="sg-field"><label for="sgBrand">' + esc(b('brandName')) + '</label>'
    +         '<input id="sgBrand" type="text" placeholder="' + esc(b('brandPh')) + '" required></div>'
    +       '<div class="sg-field"><label for="sgName">' + esc(b('contact')) + '</label>'
    +         '<input id="sgName" type="text" autocomplete="name" placeholder="' + esc(t('namePh')) + '" required></div>'
    +       '<div class="sg-field"><label for="sgCountry">' + esc(t('country')) + '</label>'
    +         '<select id="sgCountry">' + sel.country + '</select></div>'
    +       '<div class="sg-field"><label for="sgPhone">' + esc(t('phone')) + '</label>'
    +         '<div class="sg-phonerow"><select id="sgDial" aria-label="Prefijo">' + sel.dial + '</select>'
    +         '<input id="sgPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="' + esc(t('phonePh')) + '" required></div></div>'
    +       '<div class="sg-field"><label for="sgDisc">' + esc(b('kind')) + '</label><select id="sgDisc">'
    +         '<option value="tienda">' + esc(b('kindShop')) + '</option>'
    +         '<option value="marca">' + esc(b('kindBrand')) + '</option>'
    +         '<option value="escuela">' + esc(b('kindSchool')) + '</option>'
    +         '<option value="otro">' + esc(b('kindOther')) + '</option>'
    +       '</select></div>'
    +       '<button class="sg-btn" type="submit" id="sgSubmit">' + esc(b('send')) + '</button>'
    +     '</form>'
    +     '<div class="sg-msg" id="sgMsg"></div>'
    +     igButton(b('ig'))
    +   '</div>'
    + '</section>'
    + footHTML()
    + '</div></div>';
  }

  function wireForm(){
    var form = gate.querySelector('#sgForm');
    var msg = gate.querySelector('#sgMsg');
    var submit = gate.querySelector('#sgSubmit');
    var country = gate.querySelector('#sgCountry');
    var dial = gate.querySelector('#sgDial');
    var brandEl = gate.querySelector('#sgBrand');
    var esMarca = audience === 'marca';

    country.addEventListener('change', function(){ dial.value = country.value; });
    dial.addEventListener('change', function(){ country.value = dial.value; });

    function show(kind, html){ msg.className = 'sg-msg ' + kind; msg.innerHTML = html; }

    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var nombre = gate.querySelector('#sgName').value.trim();
      var marca = brandEl ? brandEl.value.trim() : '';
      var raw = gate.querySelector('#sgPhone').value.replace(/\D/g, '');
      var code = country.value;
      var info = null;
      COUNTRIES.forEach(function(c){ if(c.code === code) info = c; });

      msg.className = 'sg-msg';
      if(esMarca && marca.length < 2){ show('err', esc(b('brandName'))); return; }
      if(nombre.length < 2){ show('err', esc(t('errName'))); return; }
      if(!info){ show('err', esc(t('errCountry'))); return; }
      if(raw.length < 6){ show('err', esc(t('errPhone'))); return; }

      raw = raw.replace(/^0+/, '');
      if(info.code === 'AR' && raw.charAt(0) !== '9') raw = '9' + raw;
      var full = '+' + info.dial + raw;

      submit.disabled = true;
      submit.textContent = t('sending');

      saveLead({
        nombre: nombre,
        marca: marca || null,
        tipo: esMarca ? 'marca' : 'rider',
        telefono: full,
        pais: info.code,
        prefijo: '+' + info.dial,
        disciplina: gate.querySelector('#sgDisc').value,
        idioma: lang
      }).then(function(res){
        submit.disabled = false;
        submit.textContent = esMarca ? b('send') : t('send');
        if(res.ok){
          form.style.display = 'none';
          show('ok', esMarca ? esc(b('ok')) : esc(t('ok').replace('{n}', nombre)));
        } else if(res.duplicate){
          show('ok', esc(t('dup')));
        } else {
          show('err', esc(t('fail'))
            + '<a href="https://wa.me/' + WHATSAPP_FALLBACK + '?text='
            + encodeURIComponent('SPOTRA: ' + (marca ? marca + ' - ' : '') + nombre + ' - ' + full + ' - ' + info.code)
            + '" target="_blank" rel="noopener">' + esc(t('failLink')) + '</a>');
        }
      });
    });
  }

  function saveLead(data){
    if(!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY){ return Promise.resolve({ ok:false }); }
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
        marca: data.marca,
        tipo: data.tipo,
        telefono: data.telefono,
        pais: data.pais,
        prefijo: data.prefijo,
        disciplina: data.disciplina,
        idioma: data.idioma,
        origen: 'landing'
      })
    }).then(function(r){
      if(r.ok) return { ok:true };
      return r.text().then(function(txt){
        var dup = r.status === 409 || (txt && (txt.indexOf('duplicate') !== -1 || txt.indexOf('23505') !== -1));
        console.warn('[SPOTRA] waitlist:', r.status, txt);
        return { ok:false, duplicate:dup };
      });
    }).catch(function(err){
      console.warn('[SPOTRA] waitlist error:', err);
      return { ok:false };
    });
  }

  /* ---------- pantalla privada de acceso ---------- */
  function mountAccess(){
    var el = document.createElement('div');
    el.className = 'spotra-gate';
    el.innerHTML = ''
    + '<div class="sg-bg"></div><div class="sg-grid"></div>'
    + '<div class="sg-wrap" style="padding-top:22vh">'
    +   '<div class="sg-logo">SPOT<span>RA</span></div>'
    +   '<div class="sg-kicker">' + esc(t('accessTitle')) + '</div>'
    +   '<div class="sg-card" style="margin-top:26px">'
    +     '<button class="sg-btn" type="button" id="sgGo">' + esc(t('enter')) + '</button>'
    +     '<div id="sgSetup" style="display:none;margin-top:14px;border-top:1px solid rgba(255,255,255,.1);padding-top:14px">'
    +       '<p class="hint" style="margin:0 0 10px">' + esc(t('bioSetup')) + '</p>'
    +       '<button class="sg-btn" type="button" id="sgAdd">' + esc(t('bioAdd')) + '</button>'
    +       '<button class="sg-link" type="button" id="sgSkip">' + esc(t('bioSkip')) + '</button>'
    +     '</div>'
    +     '<div class="sg-msg" id="sgAccMsg"></div>'
    +   '</div>'
    + '</div>';
    document.body.appendChild(el);

    var go = el.querySelector('#sgGo');
    var setup = el.querySelector('#sgSetup');
    var addBtn = el.querySelector('#sgAdd');
    var skipBtn = el.querySelector('#sgSkip');
    var msg = el.querySelector('#sgAccMsg');

    function say(kind, text){ msg.className = 'sg-msg ' + kind; msg.textContent = text; }
    function enterApp(){
      unlockSession();
      say('ok', t('opening'));
      setTimeout(function(){ location.reload(); }, 350);
    }
    if(hasBio() && bioSupported){ go.textContent = t('enterBio'); }

    go.addEventListener('click', function(){
      say('', '');
      if(hasBio() && bioSupported){
        bioLogin().then(enterApp).catch(function(err){
          console.warn('[SPOTRA] Face ID:', err);
          say('err', t('bioFail'));
        });
        return;
      }
      if(bioSupported){ go.style.display = 'none'; setup.style.display = 'block'; return; }
      enterApp();
    });
    addBtn.addEventListener('click', function(){
      addBtn.disabled = true;
      addBtn.textContent = t('sending');
      bioRegister().then(enterApp).catch(function(err){
        console.warn('[SPOTRA] registro Face ID:', err);
        addBtn.disabled = false;
        addBtn.textContent = t('bioAdd');
        say('err', t('bioNo'));
      });
    });
    skipBtn.addEventListener('click', function(){ unlockRemembered(); enterApp(); });
  }

  /* ---------- arranque ---------- */
  function start(){
    var secret = secretFromUrl();
    if(secret){
      cleanUrl();
      derive(secret).then(function(h){
        if(h === HASH_ACCESO){ if(!lang) lang = 'es-uy'; mountAccess(); }
        else { openPublic(); }
      }).catch(openPublic);
      return;
    }
    openPublic();
  }
  function openPublic(){
    if(lang && T[lang] && audience) mountGate(audience);
    else mountLang();
  }

  if(document.body){ start(); }
  else { document.addEventListener('DOMContentLoaded', start); }
})();
