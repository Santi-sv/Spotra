/* SPOTRA · Cuadros al entrar (v1, 18/11/2026)
   Una hoja desde abajo con SPOTRI que invita a hacer algo real (aceptar un desafío, el reto de la semana,
   votar, sumarse a una sesión de hoy, ir a un evento, sumar un spot).
   Reglas (claude/SPOTRA-ALGORITMO.md):
   - Como máximo 1 por día y nunca el primer día que el rider usa la app.
   - "Recordar más tarde" = ese cuadro vuelve en 3 días · ✕ = no vuelve por 30 días · tocar el botón = 7 días.
   - Solo aparece si el dato es real (hay un desafío, hay sesión hoy...). Sin cuentas regresivas ni urgencias falsas.
   - Menores: no ven los cuadros que invitan a crear o aceptar batallas.
   - Respeta "reducir movimiento". Todo se guarda en el teléfono (localStorage), por usuario. */
(function(){
  'use strict';

  const B = () => window.SpotraBackend;
  const SB = () => window.SpotraBattles;
  const L = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  const pick = o => o[L()] || o.es;
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  const DAY = 864e5;
  const WAIT = { later: 3 * DAY, close: 30 * DAY, done: 7 * DAY };
  const ORDER = ['desafio', 'reto', 'votar', 'sesion', 'evento', 'spot'];
  const KEY = 'spotra_cx_';
  const IMG = 'assets/Spotri/';
  /* poses nuevas: si el archivo todavía no está subido, se usa la de respaldo */
  const POSE = {
    desafio: ['spotri-senalando.webp', 'spotri-parado.webp'],
    reto:    ['spotri-rodando-1.webp'],
    votar:   ['spotri-rodando-3.webp'],
    sesion:  ['spotri-rodando-2.webp'],
    evento:  ['spotri-trofeo.webp', 'spotri-parado.webp'],
    spot:    ['spotri-hola.webp']
  };

  /* ---------- memoria en el teléfono ---------- */
  function dayStr(t){ const d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function readState(uid){
    try { const s = JSON.parse(localStorage.getItem(KEY + uid) || 'null'); if(s && typeof s === 'object') return { first: s.first || '', last: s.last || '', wait: s.wait && typeof s.wait === 'object' ? s.wait : {} }; } catch(e){}
    return { first: '', last: '', wait: {} };
  }
  function writeState(uid, s){ try { localStorage.setItem(KEY + uid, JSON.stringify(s)); } catch(e){} }

  /* ---------- datos ---------- */
  let activity = null;
  async function loadActivity(){
    if(activity) return activity;
    activity = [];
    try {
      const c = B() && B().getClient ? await B().getClient() : null;
      if(c){ const { data } = await c.rpc('community_activity', { p_limit: 30 }); activity = Array.isArray(data) ? data : []; }
    } catch(e){ activity = []; }
    return activity;
  }
  function hhmm(t){ const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function locale(){ return window.SpotraI18n && window.SpotraI18n.mapsLang ? window.SpotraI18n.mapsLang() : 'es'; }

  /* cada función devuelve los datos del cuadro, o null si no corresponde mostrarlo */
  const FIND = {
    async desafio(ctx){
      if(ctx.adult !== 'adult' || !SB() || !SB().challenges) return null;
      const b = SB().challenges()[0];
      return b ? { b } : null;
    },
    async reto(ctx){
      if(ctx.adult !== 'adult' || !SB() || !SB().retoFor) return null;
      const r = SB().retoFor();
      return r && !r.mineThisWeek ? { r } : null;
    },
    async votar(){
      if(!SB() || !SB().voteCandidate) return null;
      const b = SB().voteCandidate();
      return b ? { b } : null;
    },
    async sesion(){
      const now = Date.now(), today = dayStr();
      const list = (await loadActivity()).filter(a => a.kind === 'session' && a.starts_at && dayStr(a.starts_at) === today && new Date(a.starts_at).getTime() > now - 1800000)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      return list[0] ? { a: list[0] } : null;
    },
    async evento(){
      const now = Date.now();
      const list = (await loadActivity()).filter(a => a.kind === 'event' && a.starts_at && new Date(a.starts_at).getTime() > now && new Date(a.starts_at).getTime() - now < 14 * DAY)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      return list[0] ? { a: list[0] } : null;
    },
    async spot(){ return {}; }
  };

  /* ---------- dibujo ---------- */
  const X_I = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const PLAY_I = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7Z"/></svg>';
  const PLUS_I = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const pill = (t, cls) => `<span class="cx-pill${cls ? ' ' + cls : ''}">${esc(t)}</span>`;

  function bodyHTML(id, d){
    if(id === 'desafio'){
      const b = d.b, until = new Date(new Date(b.created_at).getTime() + 7 * DAY);
      const wd = until.toLocaleDateString(locale(), { weekday: 'long' });
      return {
        title: pick({ es: `@${b.creator_name || 'rider'} te desafía`, pt: `@${b.creator_name || 'rider'} te desafia`, en: `@${b.creator_name || 'rider'} challenges you` }),
        html: `${pill(pick({ es: 'Te desafían', pt: 'Te desafiam', en: 'Challenge for you' }), 'or')}
          <h2 id="cxTitle" class="cx-h">${esc(pick({ es: `@${b.creator_name || 'rider'} te desafía`, pt: `@${b.creator_name || 'rider'} te desafia`, en: `@${b.creator_name || 'rider'} challenges you` }))}</h2>
          <p class="cx-sub">${esc(b.prompt)} · ${esc(SB().discLabel(b.discipline))}</p>
          <div class="cx-duel" aria-hidden="true"><div class="cx-duel-l"><span>${esc(pick({ es: 'Su clip', pt: 'O clipe dele', en: 'Their clip' }))}</span></div><div class="cx-duel-r"><span>${esc(pick({ es: 'Tu clip', pt: 'Seu clipe', en: 'Your clip' }))}</span></div><b class="cx-vs or">VS</b></div>
          <p class="cx-note">${esc(pick({ es: `Podés aceptar hasta el ${wd}. Si nadie acepta, la batalla se borra.`, pt: `Você pode aceitar até ${wd}. Se ninguém aceitar, a batalha é apagada.`, en: `You can accept until ${wd}. If nobody accepts, the battle is deleted.` }))}</p>`,
        cta: pick({ es: 'Ver el desafío', pt: 'Ver o desafio', en: 'See the challenge' }), accent: 'or'
      };
    }
    if(id === 'reto'){
      const r = d.r;
      const done = r.done ? pick({ es: `${r.done} rider${r.done === 1 ? '' : 's'} ya lo ${r.done === 1 ? 'subió' : 'subieron'}.`, pt: `${r.done} rider${r.done === 1 ? '' : 's'} já ${r.done === 1 ? 'enviou' : 'enviaram'}.`, en: `${r.done} rider${r.done === 1 ? '' : 's'} already did it.` }) : '';
      return {
        title: r.text,
        html: `${pill(pick({ es: 'Reto de la semana', pt: 'Desafio da semana', en: 'Challenge of the week' }) + ' · ' + r.label)}
          <h2 id="cxTitle" class="cx-h cx-poster">${esc(r.text)}</h2>
          <p class="cx-sub">${esc(pick({ es: 'Subí tu clip de 20 s. Otro rider lo acepta y el público vota. Termina el domingo.', pt: 'Envie seu clipe de 20 s. Outro rider aceita e o público vota. Termina no domingo.', en: 'Upload your 20 s clip. Another rider accepts and the crowd votes. Ends on Sunday.' }))}</p>
          ${done ? `<p class="cx-note">${esc(done)}</p>` : ''}`,
        cta: pick({ es: 'Aceptar el reto', pt: 'Aceitar o desafio', en: 'Take the challenge' })
      };
    }
    if(id === 'votar'){
      const b = d.b;
      return {
        title: b.prompt,
        html: `${pill(pick({ es: 'Votá una batalla', pt: 'Vote numa batalha', en: 'Vote on a battle' }))}
          <h2 id="cxTitle" class="cx-h">${esc(b.prompt)}</h2>
          <div class="cx-two" aria-hidden="true"><div><i>${PLAY_I}</i><b>@${esc(b.creator_name || '')}</b></div><div><i>${PLAY_I}</i><b>@${esc(b.opponent_name || '')}</b></div></div>
          <div class="cx-judge"><img src="${IMG}spotri-cara.webp" alt=""><p>${esc(pick({ es: `${b.total_votes || 0} riders ya votaron. El resultado se ve cuando votás.`, pt: `${b.total_votes || 0} riders já votaram. O resultado aparece quando você vota.`, en: `${b.total_votes || 0} riders have voted. Results show after you vote.` }))}</p></div>`,
        cta: pick({ es: 'Ver y votar', pt: 'Ver e votar', en: 'Watch and vote' })
      };
    }
    if(id === 'sesion'){
      const a = d.a, n = Number(a.n) || 0;
      return {
        title: hhmm(a.starts_at),
        html: `${pill(pick({ es: 'Hoy se rueda', pt: 'Hoje tem rolê', en: 'Riding today' }), 'bl')}
          <h2 id="cxTitle" class="cx-h">${esc(pick({ es: `Sesión a las ${hhmm(a.starts_at)}`, pt: `Sessão às ${hhmm(a.starts_at)}`, en: `Session at ${hhmm(a.starts_at)}` }))}</h2>
          <div class="cx-ses"><b>${esc(a.place_name || '')}</b>
            <span>${esc(a.username ? pick({ es: `La armó @${a.username}`, pt: `Criada por @${a.username}`, en: `Started by @${a.username}` }) : '')}${n ? ' · ' + esc(pick({ es: `${n} se ${n === 1 ? 'sumó' : 'sumaron'}`, pt: `${n} ${n === 1 ? 'entrou' : 'entraram'}`, en: `${n} joined` })) : ''}</span></div>`,
        cta: pick({ es: 'Ver la sesión', pt: 'Ver a sessão', en: 'See the session' })
      };
    }
    if(id === 'evento'){
      const a = d.a, w = new Date(a.starts_at);
      const wd = w.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '');
      const mo = w.toLocaleDateString(locale(), { month: 'short' }).replace('.', '');
      return {
        title: a.place_name,
        html: `${pill(pick({ es: 'Evento cerca', pt: 'Evento perto', en: 'Event nearby' }), 'or')}
          <div class="cx-ev"><div class="cx-date" aria-hidden="true"><span>${esc(wd)}</span><b>${w.getDate()}</b><span>${esc(mo)}</span></div>
            <div><h2 id="cxTitle" class="cx-h">${esc(a.place_name || '')}</h2><p class="cx-sub">${esc([a.city, hhmm(a.starts_at)].filter(Boolean).join(' · '))}</p></div></div>`,
        cta: pick({ es: 'Ver evento', pt: 'Ver evento', en: 'See event' })
      };
    }
    /* spot */
    const pin = (x, y, flip) => `<span class="cx-pin" style="left:${x}%;top:${y}px"><span><img src="${IMG}spotri-cara.webp" alt=""${flip ? ' class="flip"' : ''}></span><i></i></span>`;
    return {
      title: '',
      html: `${pill(pick({ es: 'Sumá un spot', pt: 'Adicione um spot', en: 'Add a spot' }))}
        <h2 id="cxTitle" class="cx-h">${esc(pick({ es: '¿Dónde rodás vos?', pt: 'Onde você anda?', en: 'Where do you ride?' }))}</h2>
        <p class="cx-sub">${esc(pick({ es: 'Si conocés un spot que no está en el mapa, sumalo y que lo encuentren todos.', pt: 'Se você conhece um spot que não está no mapa, adicione e deixe todo mundo encontrar.', en: 'If you know a spot that is not on the map, add it so everyone can find it.' }))}</p>
        <div class="cx-map" aria-hidden="true"><svg viewBox="0 0 350 150" preserveAspectRatio="none"><path d="M0 62h350M0 118h350M70 0v150M190 0v150M290 0v150M0 22l350 120" stroke="#1f281e" stroke-width="7" fill="none"/></svg>
          ${pin(20, 14)}${pin(82.9, 70, true)}<span class="cx-pin ghost" style="left:54.3%;top:42px"><span>${PLUS_I}</span><i></i></span><span class="cx-mine">${esc(pick({ es: 'Tu spot', pt: 'Seu spot', en: 'Your spot' }))}</span></div>`,
      cta: pick({ es: 'Agregar spot', pt: 'Adicionar spot', en: 'Add spot' })
    };
  }

  function css(){
    if(document.getElementById('cxCss')) return;
    const s = document.createElement('style');
    s.id = 'cxCss';
    s.textContent = `
#cxOv{position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center}
#cxOv .cx-bg{position:absolute;inset:0;border:0;padding:0;background:rgba(0,0,0,.68);cursor:pointer}
.cx-sheet{position:relative;width:100%;max-width:520px;box-sizing:border-box;background:#0f130f;color:#f5f7f4;border-top:1px solid #252b25;border-radius:26px 26px 0 0;padding:26px 20px max(18px,calc(env(safe-area-inset-bottom) + 10px));display:flex;flex-direction:column;font-family:var(--body);animation:cxUp .28s ease-out;max-height:calc(100% - 150px)}
.cx-sheet:focus{outline:none}
.cx-img{position:absolute;right:64px;height:170px;width:auto;top:-140px;pointer-events:none}
.cx-sheet.reto .cx-img{height:230px;top:-200px;right:56px}
.cx-handle{position:absolute;top:9px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:2px;background:#2f372f}
.cx-x{position:absolute;top:14px;right:12px;width:44px;height:44px;border-radius:22px;border:0;background:#1a1f1a;color:#c9cfca;display:flex;align-items:center;justify-content:center;z-index:2;cursor:pointer}
.cx-x svg{width:20px;height:20px}
.cx-scroll{overflow-y:auto;min-height:0;display:flex;flex-direction:column;padding-right:4px}
.cx-pill{align-self:flex-start;font-size:13px;font-weight:800;color:#74ff3a;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(116,255,58,.35);max-width:calc(100% - 70px)}
.cx-pill.or{color:#ffb878;border-color:rgba(255,154,61,.4)}
.cx-pill.bl{color:#8fd6ff;border-color:rgba(143,214,255,.4)}
.cx-h{margin:14px 0 0;max-width:72%;font-family:var(--display);font-size:30px;line-height:.95;text-transform:uppercase;overflow-wrap:anywhere}
.cx-h.cx-poster{max-width:none;font-size:50px;line-height:.88;color:#74ff3a}
.cx-sub{margin:8px 0 0;font-size:15px;line-height:1.45;color:#c9cfca}
.cx-note{margin:12px 0 0;font-size:13.5px;line-height:1.4;color:#aab2ab}
.cx-duel{position:relative;margin-top:16px;height:118px;flex-shrink:0;border-radius:14px;overflow:hidden;background:#0a0d0a}
.cx-duel-l{position:absolute;inset:0;clip-path:polygon(0 0,58% 0,42% 100%,0 100%);background:linear-gradient(135deg,#2a2016,#151008);display:flex;align-items:flex-end;padding:10px;box-sizing:border-box}
.cx-duel-l span{font-size:13px;font-weight:700;background:rgba(7,9,7,.75);padding:4px 9px;border-radius:999px}
.cx-duel-r{position:absolute;inset:0;clip-path:polygon(58% 0,100% 0,100% 100%,42% 100%);display:flex;align-items:center;justify-content:flex-end;padding-right:24px;box-sizing:border-box}
.cx-duel-r span{width:80px;height:80px;border:2px dashed #ff9a3d;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#ffb878;font-weight:800;font-size:13px}
.cx-vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-11deg);font-family:var(--display);font-size:22px;background:#74ff3a;color:#071006;padding:2px 8px 0;border-radius:5px}
.cx-vs.or{background:#ff9a3d;color:#160a00}
.cx-two{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px;flex-shrink:0}
.cx-two div{position:relative;height:132px;border-radius:14px;background:linear-gradient(160deg,#1d261b,#0b0e0b);display:flex;align-items:flex-end;padding:10px;box-sizing:border-box;min-width:0}
.cx-two div+div{background:linear-gradient(200deg,#1d261b,#0b0e0b);justify-content:flex-end}
.cx-two b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cx-two i{position:absolute;left:50%;top:42%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:rgba(7,9,7,.55);border:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center}
.cx-two i svg{width:16px;height:16px;margin-left:2px}
.cx-judge{margin-top:12px;display:flex;align-items:center;gap:10px}
.cx-judge img{width:34px;height:34px;border-radius:50%;flex-shrink:0}
.cx-judge p{margin:0;font-size:14px;line-height:1.4;color:#c9cfca}
.cx-ses{margin-top:14px;border-radius:16px;border:1px solid #252b25;background:#121712;padding:14px;display:flex;flex-direction:column;gap:6px}
.cx-ses b{font-size:16px}
.cx-ses span{font-size:13.5px;color:#aab2ab}
.cx-ev{margin-top:14px;display:flex;gap:14px;align-items:center}
.cx-ev .cx-h{margin:0;font-size:26px;max-width:none}
.cx-date{width:86px;flex-shrink:0;border-radius:14px;background:#ff9a3d;color:#160a00;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 0;text-transform:uppercase}
.cx-date span{font-size:13px;font-weight:800}
.cx-date b{font-family:var(--display);font-size:42px;line-height:.95}
.cx-map{position:relative;margin-top:14px;height:150px;flex-shrink:0;border-radius:14px;overflow:hidden;border:1px solid #1f251f;background:#101510}
.cx-map svg{position:absolute;inset:0;width:100%;height:100%}
.cx-pin{position:absolute;width:42px;height:50px;margin-left:-21px;display:flex;flex-direction:column;align-items:center}
.cx-pin>span{width:42px;height:42px;box-sizing:border-box;border-radius:50%;border:3px solid #74ff3a;background:#141814;overflow:hidden;display:flex;align-items:center;justify-content:center}
.cx-pin img{width:100%;height:100%;object-fit:cover;display:block}
.cx-pin img.flip{transform:scaleX(-1)}
.cx-pin i{width:0;height:0;margin-top:-1px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #74ff3a}
.cx-pin.ghost>span{border:2.5px dashed #f5f7f4;background:rgba(245,247,244,.06);color:#f5f7f4}
.cx-pin.ghost>span svg{width:18px;height:18px}
.cx-pin.ghost i{margin-top:2px;border-top-color:#f5f7f4;border-left-width:5px;border-right-width:5px;border-top-width:7px}
.cx-mine{position:absolute;left:54.3%;top:98px;transform:translateX(-50%);font-size:12.5px;font-weight:800;background:rgba(7,9,7,.8);padding:3px 9px;border-radius:999px;white-space:nowrap}
.cx-acts{margin-top:18px;display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.cx-go{height:52px;border-radius:14px;border:0;background:#74ff3a;color:#071006;font:800 16px var(--body);cursor:pointer}
.cx-sheet.or .cx-go{background:#ff9a3d;color:#160a00}
.cx-later{height:44px;border:0;background:transparent;color:#aab2ab;font:700 14px var(--body);cursor:pointer}
@keyframes cxUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@media (min-width:700px){#cxOv{align-items:center}.cx-sheet{border-radius:26px;border:1px solid #252b25;margin-top:150px}}
@media (max-width:360px){.cx-h{font-size:26px}.cx-h.cx-poster{font-size:42px}.cx-img{height:146px;top:-118px;right:58px}.cx-sheet.reto .cx-img{height:190px;top:-162px}.cx-sheet{padding-left:16px;padding-right:16px}}
@media (prefers-reduced-motion:reduce){.cx-sheet{animation:none}}
`;
    document.head.appendChild(s);
  }

  /* ---------- abrir / cerrar ---------- */
  let openId = null, lastFocus = null, uidNow = null;
  function setWait(id, ms){
    if(!uidNow) return;
    const s = readState(uidNow);
    s.wait[id] = Date.now() + ms;
    writeState(uidNow, s);
  }
  function close(how){
    const ov = document.getElementById('cxOv');
    if(!ov) return;
    if(openId && how) setWait(openId, WAIT[how] || WAIT.later);
    ov.remove();
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', onKey, true);
    openId = null;
    if(lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch(e){}
  }
  function onKey(e){
    if(e.key === 'Escape'){ e.preventDefault(); close('later'); return; }
    if(e.key === 'Tab'){
      const ov = document.getElementById('cxOv');
      const f = ov ? [...ov.querySelectorAll('.cx-sheet button')] : [];
      if(!f.length) return;
      const i = f.indexOf(document.activeElement);   /* -1 si el foco está en la hoja */
      if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }
  }
  function show(id, d){
    css();
    close();
    const v = bodyHTML(id, d);
    const pose = POSE[id];
    const ov = document.createElement('div');
    ov.id = 'cxOv';
    ov.innerHTML = `<button type="button" class="cx-bg" data-cx="later" tabindex="-1" aria-label="${esc(pick({ es: 'Recordar más tarde', pt: 'Lembrar mais tarde', en: 'Remind me later' }))}"></button>
      <section class="cx-sheet ${esc(id)}${v.accent ? ' ' + v.accent : ''}" role="dialog" aria-modal="true" aria-labelledby="cxTitle" tabindex="-1">
        <img class="cx-img" src="${IMG + pose[0]}" alt="">
        <span class="cx-handle" aria-hidden="true"></span>
        <button type="button" class="cx-x" data-cx="close" aria-label="${esc(pick({ es: 'Cerrar', pt: 'Fechar', en: 'Close' }))}">${X_I}</button>
        <div class="cx-scroll">${v.html}</div>
        <div class="cx-acts"><button type="button" class="cx-go" data-cx="go">${esc(v.cta)}</button>
          <button type="button" class="cx-later" data-cx="later">${esc(pick({ es: 'Recordar más tarde', pt: 'Lembrar mais tarde', en: 'Remind me later' }))}</button></div>
      </section>`;
    const img = ov.querySelector('.cx-img');
    if(pose[1]) img.addEventListener('error', () => { if(!img.dataset.fb){ img.dataset.fb = '1'; img.src = IMG + pose[1]; } });
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    openId = id;
    ov._data = d;
    lastFocus = document.activeElement;
    document.addEventListener('keydown', onKey, true);
    /* el foco va a la hoja (no al botón) para que el lector de pantalla la anuncie entera */
    const sheet = ov.querySelector('.cx-sheet');
    try { sheet.focus({ preventScroll: true }); } catch(e){ sheet.focus(); }
  }
  function act(id, d){
    if(id === 'desafio' || id === 'votar'){ SB().openById(d.b.id); return; }
    if(id === 'reto'){ SB().openCreate({ disc: d.r.disc, prompt: d.r.text }); return; }
    if(id === 'sesion'){
      if(window.setRoute) window.setRoute('map');
      let tries = 0;
      const go = () => { if(document.querySelector('#spotSheet.open')) return; if(window.SpotraMaps && window.SpotraMaps.openPlaceById) window.SpotraMaps.openPlaceById(d.a.place_id); if(++tries < 8) setTimeout(go, 800); };
      setTimeout(go, 500);
      return;
    }
    if(id === 'evento'){
      if(window.setRoute) window.setRoute('events');
      setTimeout(() => { if(window.SpotraEvents && window.SpotraEvents.openDetail) window.SpotraEvents.openDetail(d.a.id); }, 1400);
      return;
    }
    /* spot: el mismo botón del menú "+", así respeta los permisos de cuentas supervisadas */
    if(window.setRoute) window.setRoute('map');
    setTimeout(() => { const btn = document.querySelector('[data-open-modal="spot"]'); if(btn) btn.click(); }, 400);
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('#cxOv [data-cx]');
    if(!el) return;
    const ov = document.getElementById('cxOv');
    const id = openId, d = ov && ov._data;
    const how = el.dataset.cx;
    if(how === 'go'){ close('done'); if(id && d) act(id, d); return; }
    close(how === 'close' ? 'close' : 'later');
  });

  /* ---------- cuándo ---------- */
  function shown(el){
    if(!el.getClientRects().length) return false;
    if(getComputedStyle(el).visibility === 'hidden') return false;
    for(let n = el; n && n !== document.body; n = n.parentElement){ if(parseFloat(getComputedStyle(n).opacity) < 0.05) return false; }
    return true;
  }
  function blocked(){
    if(document.visibilityState === 'hidden') return true;
    if(document.body.classList.contains('spotri-open')) return true;
    if(document.querySelector('#modalBg.open, .bt-ov.open, #spotSheet.open, #cxOv')) return true;
    /* cualquier otra ventana encima (guía, ayuda, instalar, Face ID...) que se esté viendo */
    if([...document.querySelectorAll('[aria-modal="true"]')].some(shown)) return true;
    const h = (location.hash || '').slice(1);
    return /^admin/.test(h);
  }
  async function pickCard(uid, s){
    const ctx = { adult: 'nouser' };
    if(SB() && SB().load){ try { await SB().load(); ctx.adult = await SB().adultState(); } catch(e){} }
    const now = Date.now();
    for(const id of ORDER){
      if((s.wait[id] || 0) > now) continue;
      let d = null;
      try { d = await FIND[id](ctx); } catch(e){ d = null; }
      if(d) return { id, d };
    }
    return null;
  }
  let running = false;
  async function check(force){
    if(running) return;
    running = true;
    try {
      let uid = null;
      try { uid = SB() && SB().whoami ? await SB().whoami() : (B() && B().getUserId ? await B().getUserId() : null); } catch(e){ uid = null; }
      if(!uid) return;
      uidNow = uid;
      const s = readState(uid);
      const today = dayStr();
      if(!force){
        if(!s.first){ s.first = today; writeState(uid, s); return; }   /* primer día: nada */
        if(s.first === today || s.last === today) return;            /* nunca el primer día · uno por día */
      }
      const c = await pickCard(uid, s);
      if(!c) return;
      for(let i = 0; i < 12 && blocked(); i++) await new Promise(r => setTimeout(r, 5000));
      if(blocked()) return;
      const s2 = readState(uid);
      s2.last = today;
      writeState(uid, s2);
      show(c.id, c.d);
    } finally { running = false; }
  }
  function boot(){
    let n = 0;
    const wait = () => {
      if(document.body && document.body.dataset.authReady === '1'){ setTimeout(() => check(false), 3500); return; }
      if(++n < 40) setTimeout(wait, 500);
    };
    wait();
  }
  let viaLink = false;
  try { viaLink = new URLSearchParams(location.search).has('battle'); } catch(e){}
  /* si entró por un link a una batalla, no lo interrumpimos */
  if(!viaLink){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  /* para probar: check() respeta las reglas de días; preview(id) muestra ese cuadro si hay datos reales */
  async function preview(id){
    if(!FIND[id]) return false;
    const ctx = { adult: 'nouser' };
    if(SB() && SB().load){ try { await SB().load(); ctx.adult = await SB().adultState(); uidNow = SB().whoami ? await SB().whoami() : uidNow; } catch(e){} }
    const d = await FIND[id](ctx);
    if(!d) return false;
    show(id, d);
    return true;
  }
  window.SpotraCuadros = { check: () => check(false), preview, close: () => close('later') };
})();
