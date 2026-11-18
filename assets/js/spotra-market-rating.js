/* SPOTRA · Market: perfil del vendedor, ventas confirmadas y calificaciones (v1, 18/11/2026)
   - Perfil de Market: promedio de estrellas (desde 3 calificaciones), cantidad por estrella, etiquetas,
     ventas / a la venta / compras y sus productos. Se abre con "Ver perfil" en un producto.
   - Marcar vendido: "¿A quién se lo vendiste?" (quienes lo guardaron, quienes te siguen o buscar @usuario;
     o "fuera de SPOTRA"). El comprador recibe un aviso y confirma.
   - Confirmar compra y calificar (estrellas + etiquetas, anónimo), desde la campana o desde el aviso del Market.
   Base: spotra-backups/supabase/market-calificaciones.sql (market_profile, market_buyer_options, market_sell,
   market_confirm, market_rate, market_pending). Textos en es / pt / en dentro del archivo. */
(function(){
  'use strict';

  const B = () => window.SpotraBackend;
  const L = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  const pick = o => o[L()] || o.es;
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  let sb = null;
  async function db(){ if(sb) return sb; try { sb = B() && B().getClient ? await B().getClient() : null; } catch(e){ sb = null; } return sb; }
  async function myId(){
    try {
      const c = await db();
      if(c && c.auth && c.auth.getSession){ const { data } = await c.auth.getSession(); if(data && data.session && data.session.user) return data.session.user.id; }
    } catch(e){}
    try { return B() && B().getUserId ? await B().getUserId() : null; } catch(e){ return null; }
  }
  async function rpc(name, args){
    const c = await db();
    if(!c) return { data: null, error: { message: '' } };
    try { return await c.rpc(name, args || {}); } catch(e){ return { data: null, error: { message: '' } }; }
  }
  /* los mensajes de la base están escritos para el rider; los técnicos se cambian por uno genérico */
  function errText(error, fallback){
    const m = error && error.message ? String(error.message) : '';
    const technical = !m || /permission|policy|violates|jwt|fetch|schema|function|column|relation|syntax|timeout|network|uuid/i.test(m);
    return technical ? fallback : m;
  }

  /* ---------- colores e íconos ---------- */
  const C = { pink: '#ff5fa8', gold: '#ffc53d', cyan: '#3fd6ff', vio: '#a78bfa', ora: '#ff9a3d', green: '#74ff3a' };
  const P = {
    clock: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8"/>',
    cam: '<path d="M4 8h3l2-2h6l2 2h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
    chat: '<path d="M5 5h14v10H9l-4 4Z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8Z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    smile: '<circle cx="12" cy="12" r="8"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0M9 10h.01M15 10h.01"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    bag: '<path d="M5 8h14l-1 12H6Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4Z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    board: '<rect x="9" y="2" width="6" height="20" rx="3"/><path d="M7 6h10M7 18h10"/>',
    wheel: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>',
    shake: '<path d="M3 11l4-4 4 2 3-2 4 1 3 3-6 6-3-2-3 2-6-6Z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    star: '<path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8Z"/>'
  };
  const ic = (k, color, size, w) => `<svg aria-hidden="true" width="${size || 20}" height="${size || 20}" viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round">${P[k]}</svg>`;
  const starSvg = (fill, size, line) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}"${line ? ` stroke="${line}" stroke-width="1.6" stroke-linejoin="round"` : ''}>${P.star}</svg>`;
  /* etiquetas: al vendedor (lo califica el comprador) y al comprador (lo califica el vendedor) */
  const TAGS = {
    puntual:  { icon: 'clock', color: C.cyan, label: { es: 'Puntual', pt: 'Pontual', en: 'On time' } },
    foto:     { icon: 'cam', color: C.vio, label: { es: 'Como en la foto', pt: 'Igual à foto', en: 'As pictured' } },
    responde: { icon: 'chat', color: C.ora, label: { es: 'Responde rápido', pt: 'Responde rápido', en: 'Quick replies' } },
    precio:   { icon: 'tag', color: C.pink, label: { es: 'Precio justo', pt: 'Preço justo', en: 'Fair price' } },
    amable:   { icon: 'smile', color: C.gold, label: { es: 'Amable', pt: 'Gente boa', en: 'Friendly' } },
    pago:     { icon: 'cash', color: C.green, label: { es: 'Pagó lo acordado', pt: 'Pagou o combinado', en: 'Paid as agreed' } }
  };
  const FOR_SELLER = ['puntual', 'foto', 'responde', 'precio', 'amable'];
  const FOR_BUYER = ['puntual', 'responde', 'pago', 'amable'];
  const TILE_BG = [['#2a2140', C.vio, 'board'], ['#13303a', C.cyan, 'wheel'], ['#3a2a13', C.ora, 'box'], ['#3a1a2c', C.pink, 'bag']];
  const AV_BG = [['#2c2440', C.vio], ['#13303a', C.cyan], ['#3a2a13', C.ora], ['#3a1a2c', C.pink]];
  function hashIdx(s, n){ let h = 0; String(s || '').split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) | 0; }); return Math.abs(h) % n; }
  function avatar(url, name, size, cls){
    const [bg, fg] = AV_BG[hashIdx(name, AV_BG.length)];
    const ini = esc(String(name || 'R').replace(/^@/, '').charAt(0).toUpperCase());
    return `<span class="mp-av${cls ? ' ' + cls : ''}" style="width:${size}px;height:${size}px;background:${bg};color:${fg};font-size:${Math.round(size * 0.4)}px">${url ? `<img src="${esc(url)}" alt="">` : ini}</span>`;
  }
  function money(price, cur){
    const n = Number(price);
    const sym = { UYU: '$U', USD: 'US$', ARS: 'AR$', BRL: 'R$' }[cur] || '$';
    return Number.isFinite(n) ? `${sym} ${n.toLocaleString(L() === 'en' ? 'en-US' : 'es-UY', { maximumFractionDigits: 0 })}` : '';
  }
  function productArt(photo, seed, size){
    if(photo) return `<img src="${esc(photo)}" alt="">`;
    const [bg, fg, icon] = TILE_BG[hashIdx(seed, TILE_BG.length)];
    return `<span class="mp-art" style="background:${bg};color:${fg}">${ic(icon, fg, size || 48, 1.6)}</span>`;
  }

  function css(){
    if(document.getElementById('mpCss')) return;
    const s = document.createElement('style');
    s.id = 'mpCss';
    s.textContent = `
.mp-ov{position:fixed;inset:0;z-index:130;background:#070907;color:#f5f7f4;overflow-y:auto;overscroll-behavior:contain;font-family:var(--body)}
.mp-ov:focus{outline:none}
.mp-wrap{max-width:560px;margin:0 auto;padding-bottom:40px}
.mp-cover{position:relative;height:150px;background:${C.pink};overflow:hidden}
.mp-cover>img{width:100%;height:100%;object-fit:cover;display:block}
.mp-cover svg.mp-stripes{position:absolute;inset:0;width:100%;height:100%}
.mp-back{position:absolute;left:8px;top:calc(8px + env(safe-area-inset-top));width:44px;height:44px;border-radius:22px;border:0;background:rgba(7,9,7,.6);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.mp-kind{position:absolute;right:16px;top:calc(18px + env(safe-area-inset-top));display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#070907;background:rgba(255,255,255,.55);padding:4px 10px;border-radius:999px}
.mp-who{position:relative;padding:0 16px;display:flex;align-items:flex-start;gap:12px}
.mp-who>.mp-av.big{margin-top:-40px}
.mp-av{border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden;flex-shrink:0}
.mp-av img{width:100%;height:100%;object-fit:cover;display:block}
.mp-av.big{border:4px solid #070907}
.mp-who>div{padding-top:10px;min-width:0}
.mp-name{font-family:var(--display);font-size:24px;line-height:1;text-transform:uppercase;overflow-wrap:anywhere}
.mp-sub{font-size:14px;color:#aab2ab;margin-top:3px}
.mp-body{padding:14px 16px 0}
.mp-rate{display:flex;gap:14px;align-items:center;border-radius:18px;background:#14130d;border:1px solid #3a3215;padding:14px}
.mp-rate .big{text-align:center;flex-shrink:0;width:92px}
.mp-rate .big b{display:block;font-family:var(--display);font-size:44px;line-height:.9;color:${C.gold}}
.mp-rate .big span{display:flex;justify-content:center;margin-top:6px}
.mp-rate .big small{display:block;font-size:12px;color:#aab2ab;margin-top:4px}
.mp-dist{flex:1;display:flex;flex-direction:column;gap:5px}
.mp-dist div{display:flex;align-items:center;gap:6px;font-size:12px;color:#aab2ab}
.mp-dist div>span:first-child{width:8px}
.mp-dist i{flex:1;height:6px;border-radius:3px;background:#252b25;overflow:hidden;display:block}
.mp-dist i b{display:block;height:100%;background:${C.gold}}
.mp-new{display:flex;gap:12px;align-items:center;border-radius:18px;background:#14130d;border:1px solid #3a3215;padding:14px}
.mp-new b{display:block;font-size:16px}
.mp-new small{font-size:13px;color:#aab2ab}
.mp-tags{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}
.mp-tag{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px 0 6px;border-radius:18px;font-size:13.5px;font-weight:700;color:#f5f7f4}
.mp-tag>span{width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center}
.mp-stats{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mp-stats div{display:flex;align-items:center;gap:8px;border-radius:14px;background:#121712;padding:10px;min-width:0}
.mp-stats b{display:block;font-size:18px;line-height:1}
.mp-stats small{font-size:12px;color:#aab2ab}
.mp-sec{margin:16px 0 0;display:flex;justify-content:space-between;align-items:center;gap:8px}
.mp-sec b{font-size:16px}
.mp-link{height:40px;border:0;background:transparent;color:var(--green-hot,#74ff3a);font:700 14px var(--body);cursor:pointer;padding:0}
.mp-grid{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mp-tile{border:0;background:transparent;color:#f5f7f4;padding:0;text-align:left;font:inherit;cursor:pointer;min-width:0}
.mp-tile>span:first-child{position:relative;display:block;height:132px;border-radius:14px;overflow:hidden;background:#141814}
.mp-tile img,.mp-art{width:100%;height:100%;object-fit:cover;display:flex;align-items:center;justify-content:center}
.mp-tile .pr{position:absolute;left:8px;bottom:8px;font-size:13px;font-weight:800;background:#070907;color:#f5f7f4;padding:4px 8px;border-radius:8px}
.mp-tile .nm{display:block;margin-top:6px;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-empty{margin-top:10px;font-size:14px;color:#8d968e}
.mp-load{padding:40px 16px;text-align:center;color:#aab2ab}

.mp-sh-ov{position:fixed;inset:0;z-index:140;display:flex;align-items:flex-end;justify-content:center}
.mp-sh-ov .mp-bg{position:absolute;inset:0;border:0;padding:0;background:rgba(0,0,0,.7);cursor:pointer}
.mp-sh{position:relative;width:100%;max-width:520px;box-sizing:border-box;max-height:calc(100% - 140px);background:#0f130f;color:#f5f7f4;border-top:1px solid #252b25;border-radius:26px 26px 0 0;padding:24px 20px max(18px,calc(env(safe-area-inset-bottom) + 10px));display:flex;flex-direction:column;font-family:var(--body);animation:mpUp .28s ease-out}
.mp-sh:focus{outline:none}
.mp-sh .pose{position:absolute;right:64px;top:-140px;height:170px;width:auto;max-width:none;pointer-events:none}
.mp-sh .handle{position:absolute;top:9px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:2px;background:#2f372f}
.mp-sh .mp-x{position:absolute;top:14px;right:12px;width:44px;height:44px;border-radius:22px;border:0;background:#1a1f1a;color:#c9cfca;display:flex;align-items:center;justify-content:center;z-index:2;cursor:pointer}
.mp-scroll{overflow-y:auto;min-height:0;display:flex;flex-direction:column}
.mp-h{margin:14px 0 0;max-width:78%;font-family:var(--display);font-size:28px;line-height:.95;text-transform:uppercase;overflow-wrap:anywhere}
.mp-chip{display:inline-flex;align-self:flex-start;align-items:center;gap:10px;padding:6px 12px 6px 6px;border-radius:14px;background:#161b16;border:1px solid #252b25;max-width:calc(100% - 60px)}
.mp-chip>span:first-child{width:40px;height:40px;border-radius:10px;overflow:hidden;flex-shrink:0}
.mp-chip b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-chip small{font-size:13px;color:${C.pink};font-weight:700}
.mp-search{margin-top:14px;height:48px;border-radius:14px;border:1px solid #2a312a;background:#0a0d0a;display:flex;align-items:center;gap:8px;padding:0 14px;color:#8d968e}
.mp-search input{flex:1;min-width:0;height:100%;border:0;background:transparent;color:#f5f7f4;font:600 16px var(--body);outline:none}
.mp-list{margin-top:10px;display:flex;flex-direction:column;gap:8px}
.mp-opt{display:flex;align-items:center;gap:12px;width:100%;min-height:62px;padding:8px 12px;border-radius:16px;border:2px solid #232923;background:#121712;color:#f5f7f4;text-align:left;font:inherit;cursor:pointer}
.mp-opt[aria-pressed="true"]{border-color:var(--green-hot,#74ff3a);background:#132010}
.mp-opt>span:nth-child(2){flex:1;min-width:0}
.mp-opt b{display:block;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mp-opt small{font-size:12.5px;font-weight:700;color:#aab2ab}
.mp-opt small.sv{color:${C.pink}}
.mp-opt .ok{width:26px;height:26px;border-radius:50%;background:var(--green-hot,#74ff3a);display:none;align-items:center;justify-content:center;flex-shrink:0}
.mp-opt[aria-pressed="true"] .ok{display:flex}
.mp-out{margin-top:6px;align-self:center;min-height:44px;border:0;background:transparent;color:#aab2ab;font:600 14px var(--body);cursor:pointer;padding:0 12px}
.mp-out[aria-pressed="true"]{color:var(--green-hot,#74ff3a);text-decoration:underline}
.mp-hint{margin:6px 0 0;font-size:13px;color:#8d968e}
.mp-acts{margin-top:16px;display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.mp-go{height:52px;border-radius:14px;border:0;background:var(--green-hot,#74ff3a);color:#071006;font:800 16px var(--body);cursor:pointer}
.mp-go:disabled{opacity:.45;cursor:default}
.mp-two{margin-top:16px;display:grid;grid-template-columns:1fr 1.4fr;gap:8px;flex-shrink:0}
.mp-no{height:52px;border-radius:14px;border:1px solid #2a312a;background:transparent;color:#f5f7f4;font:700 15px var(--body);cursor:pointer}
.mp-prod{position:relative;margin-top:8px;height:150px;border-radius:18px;overflow:hidden;background:#141814;flex-shrink:0}
.mp-prod>img,.mp-prod>.mp-art{width:100%;height:100%;object-fit:cover}
.mp-prod .stamp{position:absolute;right:14px;top:16px;transform:rotate(8deg);font-family:var(--display);font-size:18px;color:${C.pink};border:3px solid ${C.pink};border-radius:8px;padding:3px 10px 1px;text-transform:uppercase;background:rgba(7,9,7,.55)}
.mp-prod .pr{position:absolute;left:12px;bottom:12px;font-size:13px;font-weight:800;background:#070907;padding:4px 9px;border-radius:8px}
.mp-deal{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:10px;color:${C.gold}}
.mp-deal+.mp-h{text-align:center;max-width:none}
.mp-rater{display:flex;align-items:center;gap:10px;max-width:calc(100% - 60px)}
.mp-rater b{display:block;font-size:15px}
.mp-rater small{font-size:13px;color:#aab2ab}
.mp-stars{margin-top:14px;display:flex;gap:4px}
.mp-stars button{width:48px;height:48px;border:0;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s}
.mp-stars button:active{transform:scale(.9)}
.mp-tagsel[hidden]{display:none}
.mp-tagsel{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mp-tagsel button{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:76px;padding:10px 12px;border-radius:16px;border:2px solid #232923;background:#121712;color:#f5f7f4;text-align:left;font:700 14px var(--body);cursor:pointer}
.mp-tagsel button>span{width:30px;height:30px;border-radius:15px;background:#232923;display:flex;align-items:center;justify-content:center}
.mp-note{margin:8px 0 0;text-align:center;font-size:12.5px;color:#8d968e}
#mpPend{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;display:none;align-items:center;gap:8px;max-width:calc(100% - 32px);min-height:44px;padding:0 16px 0 10px;border-radius:22px;border:0;background:${C.pink};color:#170511;font:800 14px var(--body);box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer}
#mpPend.on{display:inline-flex}
#mpPend span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes mpUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@media (min-width:700px){.mp-sh-ov{align-items:center}.mp-sh{border-radius:26px;border:1px solid #252b25;margin-top:140px}}
@media (max-width:360px){.mp-h{font-size:24px}.mp-name{font-size:21px}.mp-stars button{width:42px;height:42px}.mp-sh{padding-left:16px;padding-right:16px}.mp-sh .pose{height:146px;top:-118px;right:56px}}
@media (prefers-reduced-motion:reduce){.mp-sh{animation:none}.mp-stars button{transition:none}}
`;
    document.head.appendChild(s);
  }

  /* ---------- ventanas: una a la vez, con foco atrapado y Escape ---------- */
  const stack = [];
  function trapKey(e){
    const top = stack[stack.length - 1];
    if(!top) return;
    if(e.key === 'Escape'){ e.preventDefault(); top.close(); return; }
    if(e.key === 'Tab'){
      const f = [...top.el.querySelectorAll('button:not([disabled]), input, a[href]')].filter(x => x.offsetParent !== null && !x.classList.contains('mp-bg'));
      if(!f.length) return;
      const i = f.indexOf(document.activeElement);
      if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }
  }
  function openLayer(el, focusEl){
    css();
    const prev = document.activeElement;
    document.body.appendChild(el);
    const layer = { el, close: () => closeLayer(layer), prev };
    stack.push(layer);
    if(stack.length === 1){ document.documentElement.style.overflow = 'hidden'; document.addEventListener('keydown', trapKey, true); }
    try { (focusEl || el).focus({ preventScroll: true }); } catch(e){}
    pendPill();
    return layer;
  }
  function closeLayer(layer){
    const i = stack.indexOf(layer);
    if(i === -1) return;
    stack.splice(i, 1);
    layer.el.remove();
    if(!stack.length){ document.documentElement.style.overflow = ''; document.removeEventListener('keydown', trapKey, true); }
    try { if(layer.prev && layer.prev.focus && document.body.contains(layer.prev)) layer.prev.focus({ preventScroll: true }); } catch(e){}
    pendPill();
  }
  function sheet(id, inner, pose){
    const ov = document.createElement('div');
    ov.className = 'mp-sh-ov';
    ov.innerHTML = `<button type="button" class="mp-bg" tabindex="-1" aria-label="${esc(pick({ es: 'Cerrar', pt: 'Fechar', en: 'Close' }))}"></button>
      <section class="mp-sh" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}T" tabindex="-1">
        ${pose ? `<img class="pose" src="assets/Spotri/${pose}" alt="">` : ''}
        <span class="handle" aria-hidden="true"></span>
        <button type="button" class="mp-x" aria-label="${esc(pick({ es: 'Cerrar', pt: 'Fechar', en: 'Close' }))}">${ic('x', 'currentColor', 20, 2.2)}</button>
        ${inner}
      </section>`;
    const layer = openLayer(ov, ov.querySelector('.mp-sh'));
    ov.querySelector('.mp-bg').addEventListener('click', layer.close);
    ov.querySelector('.mp-x').addEventListener('click', layer.close);
    return layer;
  }

  /* ================= Perfil de Market ================= */
  async function openProfile(id){
    if(!id) return;
    css();
    const ov = document.createElement('div');
    ov.className = 'mp-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', pick({ es: 'Perfil de Market', pt: 'Perfil do Market', en: 'Market profile' }));
    ov.tabIndex = -1;
    ov.innerHTML = `<div class="mp-load">${esc(pick({ es: 'Cargando perfil...', pt: 'Carregando perfil...', en: 'Loading profile...' }))}</div>`;
    const layer = openLayer(ov);
    const c = await db();
    const [{ data: p, error }, list] = await Promise.all([
      rpc('market_profile', { p_id: id }),
      c ? c.from('listings').select('id, title, price, currency, photos, category').eq('seller_id', id).eq('status', 'approved').eq('sold', false).order('created_at', { ascending: false }).limit(12).then(r => r.data || [], () => []) : Promise.resolve([])
    ]);
    if(!document.body.contains(ov)) return;
    if(error || !p){
      ov.innerHTML = `<div class="mp-wrap"><div class="mp-cover"><button type="button" class="mp-back" data-mp-close aria-label="${esc(pick({ es: 'Volver', pt: 'Voltar', en: 'Back' }))}">${ic('back', '#fff', 22, 2.4)}</button></div><div class="mp-load">${esc(pick({ es: 'Este perfil no está disponible.', pt: 'Este perfil não está disponível.', en: 'This profile is not available.' }))}</div></div>`;
      ov.querySelector('[data-mp-close]').addEventListener('click', layer.close);
      return;
    }
    ov.innerHTML = profileHTML(p, list);
    ov.querySelector('[data-mp-close]').addEventListener('click', layer.close);
    ov.querySelectorAll('[data-mp-item]').forEach(b => b.addEventListener('click', () => {
      layer.close();
      if(window.SpotraMarket && window.SpotraMarket.openById) window.SpotraMarket.openById(b.dataset.mpItem);
    }));
    const full = ov.querySelector('[data-mp-full]');
    if(full) full.addEventListener('click', () => {
      layer.close();
      if(window.SpotraRiders && window.SpotraRiders.open) window.SpotraRiders.open(id);
    });
    try { ov.querySelector('[data-mp-close]').focus({ preventScroll: true }); } catch(e){}
  }
  function profileHTML(p, list){
    const name = p.name || p.username || 'Rider';
    const sub = ['@' + (p.username || 'rider'), p.city].filter(Boolean).join(' · ');
    const since = p.since ? new Date(p.since).toLocaleDateString(L() === 'en' ? 'en-US' : (L() === 'pt' ? 'pt-BR' : 'es-UY'), { month: 'long', year: 'numeric' }) : '';
    const n = Number(p.ratings) || 0;
    let rate;
    if(p.avg != null){
      const avg = Number(p.avg), full = Math.round(avg);
      const dist = Array.isArray(p.dist) ? p.dist : [0, 0, 0, 0, 0];
      const max = Math.max(1, ...dist);
      rate = `<div class="mp-rate"><div class="big"><b>${esc(avg.toLocaleString(L() === 'en' ? 'en-US' : 'es-UY', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))}</b>
          <span role="img" aria-label="${esc(pick({ es: `${avg} de 5 estrellas`, pt: `${avg} de 5 estrelas`, en: `${avg} out of 5 stars` }))}">${[1, 2, 3, 4, 5].map(i => starSvg(i <= full ? C.gold : '#5a4a17', 16)).join('')}</span>
          <small>${esc(pick({ es: `${n} calificaciones`, pt: `${n} avaliações`, en: `${n} ratings` }))}</small></div>
        <div class="mp-dist" aria-hidden="true">${dist.map((v, i) => `<div><span>${5 - i}</span><i><b style="width:${Math.round(v * 100 / max)}%"></b></i></div>`).join('')}</div></div>`;
    } else {
      rate = `<div class="mp-new">${starSvg(C.gold, 34)}<span><b>${esc(pick({ es: 'Nuevo en el Market', pt: 'Novo no Market', en: 'New on Market' }))}</b>
        <small>${esc(n ? pick({ es: `${n} de 3 calificaciones para mostrar el promedio`, pt: `${n} de 3 avaliações para mostrar a média`, en: `${n} of 3 ratings to show the average` }) : pick({ es: 'Todavía sin calificaciones', pt: 'Ainda sem avaliações', en: 'No ratings yet' }))}</small></span></div>`;
    }
    const tags = p.tags && typeof p.tags === 'object' ? Object.entries(p.tags).filter(([k]) => TAGS[k]).sort((a, b) => b[1] - a[1]) : [];
    const tagsHTML = tags.length ? `<div class="mp-tags">${tags.map(([k, v]) => { const t = TAGS[k]; return `<span class="mp-tag" style="background:${t.color}22;border:1.5px solid ${t.color}66"><span style="background:${t.color}">${ic(t.icon, '#0b0d0b', 14, 2.4)}</span>${esc(pick(t.label))}<b style="color:${t.color}">${Number(v)}</b></span>`; }).join('')}</div>` : '';
    const stat = (icon, color, v, label) => `<div>${ic(icon, color, 22)}<span><b>${Number(v) || 0}</b><small>${esc(label)}</small></span></div>`;
    const stats = `<div class="mp-stats">${stat('box', C.green, p.sales, pick({ es: 'ventas', pt: 'vendas', en: 'sold' }))}${stat('tag', C.pink, p.on_sale, pick({ es: 'a la venta', pt: 'à venda', en: 'for sale' }))}${stat('bag', C.cyan, p.purchases, pick({ es: 'compras', pt: 'compras', en: 'bought' }))}</div>`;
    const grid = list.length ? `<div class="mp-grid">${list.map(l => `<button type="button" class="mp-tile" data-mp-item="${esc(l.id)}"><span>${productArt(Array.isArray(l.photos) ? l.photos[0] : '', l.id, 52)}<span class="pr">${esc(money(l.price, l.currency))}</span></span><span class="nm">${esc(l.title)}</span></button>`).join('')}</div>`
      : `<p class="mp-empty">${esc(pick({ es: 'No tiene productos a la venta ahora.', pt: 'Não tem produtos à venda agora.', en: 'Nothing for sale right now.' }))}</p>`;
    const cover = p.cover_url ? `<img src="${esc(p.cover_url)}" alt="">` : '<svg class="mp-stripes" aria-hidden="true" viewBox="0 0 390 150" preserveAspectRatio="none"><path d="M-20 120 L120 -10 M60 170 L260 -20 M200 170 L420 -10" stroke="#070907" stroke-opacity=".12" stroke-width="28"/></svg>';
    return `<div class="mp-wrap">
      <div class="mp-cover">${cover}
        <button type="button" class="mp-back" data-mp-close aria-label="${esc(pick({ es: 'Volver', pt: 'Voltar', en: 'Back' }))}">${ic('back', '#fff', 22, 2.4)}</button>
        <span class="mp-kind">${ic('bag', '#070907', 16, 2.4)}Market</span></div>
      <div class="mp-who">${avatar(p.avatar_url, p.username || name, 80, 'big')}<div><h1 class="mp-name">${esc(name)}</h1><div class="mp-sub">${esc(sub)}</div>${since ? `<div class="mp-sub" style="font-size:13px">${esc(pick({ es: `Vende desde ${since}`, pt: `Vende desde ${since}`, en: `Selling since ${since}` }))}</div>` : ''}</div></div>
      <div class="mp-body">${rate}${tagsHTML}${stats}
        <div class="mp-sec"><b>${esc(pick({ es: 'A la venta', pt: 'À venda', en: 'For sale' }))}</b>${p.is_me ? '' : `<button type="button" class="mp-link" data-mp-full>${esc(pick({ es: 'Ver perfil completo', pt: 'Ver perfil completo', en: 'See full profile' }))}</button>`}</div>
        ${grid}</div></div>`;
  }

  /* ================= Marcar vendido: ¿a quién? ================= */
  function sell(l, done){
    if(!l || !l.id) return;
    const photo = Array.isArray(l.photos) ? l.photos[0] : '';
    const inner = `<div class="mp-scroll">
        <div class="mp-chip"><span>${productArt(photo, l.id, 24)}</span><span style="min-width:0"><b>${esc(l.title)}</b><small>${esc(money(l.price, l.currency))}</small></span></div>
        <h2 class="mp-h" id="mpSellT" style="max-width:62%">${esc(pick({ es: '¿A quién se lo vendiste?', pt: 'Para quem você vendeu?', en: 'Who did you sell it to?' }))}</h2>
        <label class="mp-search">${ic('search', 'currentColor', 18, 2.2)}<input type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(pick({ es: 'Buscar @usuario', pt: 'Buscar @usuário', en: 'Search @username' }))}" aria-label="${esc(pick({ es: 'Buscar comprador por usuario', pt: 'Buscar comprador por usuário', en: 'Search buyer by username' }))}"></label>
        <div class="mp-list" aria-live="polite"></div>
        <button type="button" class="mp-out" aria-pressed="false">${esc(pick({ es: 'Fue a alguien fuera de SPOTRA', pt: 'Foi para alguém fora do SPOTRA', en: 'Sold to someone outside SPOTRA' }))}</button>
      </div>
      <div class="mp-acts"><button type="button" class="mp-go" disabled>${esc(pick({ es: 'Marcar como vendido', pt: 'Marcar como vendido', en: 'Mark as sold' }))}</button></div>`;
    const layer = sheet('mpSell', inner, 'spotri-senalando.webp');
    const el = layer.el;
    const listEl = el.querySelector('.mp-list'), input = el.querySelector('input'), out = el.querySelector('.mp-out'), go = el.querySelector('.mp-go');
    let chosen = null, outside = false, timer = null, seq = 0;
    const refresh = () => {
      el.querySelectorAll('.mp-opt').forEach(b => b.setAttribute('aria-pressed', String(!outside && b.dataset.id === (chosen && chosen.id))));
      out.setAttribute('aria-pressed', String(outside));
      go.disabled = !(outside || chosen);
    };
    const load = async q => {
      const my = ++seq;
      const { data } = await rpc('market_buyer_options', { p_listing: l.id, p_q: q });
      if(my !== seq || !document.body.contains(el)) return;
      const rows = Array.isArray(data) ? data : [];
      if(chosen && !rows.some(r => r.id === chosen.id)) rows.unshift(chosen);
      listEl.innerHTML = rows.length ? rows.map(r => `<button type="button" class="mp-opt" data-id="${esc(r.id)}" data-name="${esc(r.username)}" aria-pressed="false">${avatar(r.avatar_url, r.username, 44)}
          <span><b>@${esc(r.username)}</b>${r.reason === 'saved' ? `<small class="sv">${esc(pick({ es: 'Guardó tu producto', pt: 'Salvou seu produto', en: 'Saved your item' }))}</small>` : r.reason === 'follows' ? `<small>${esc(pick({ es: 'Te sigue', pt: 'Te segue', en: 'Follows you' }))}</small>` : ''}</span>
          <span class="ok">${ic('check', '#071006', 15, 3)}</span></button>`).join('')
        : `<p class="mp-hint">${esc(q ? pick({ es: 'No encontramos ese usuario.', pt: 'Não encontramos esse usuário.', en: 'No user found.' }) : pick({ es: 'Buscá al comprador por su @usuario.', pt: 'Busque o comprador pelo @usuário.', en: 'Search the buyer by @username.' }))}</p>`;
      listEl.querySelectorAll('.mp-opt').forEach(b => b.addEventListener('click', () => {
        outside = false;
        chosen = chosen && chosen.id === b.dataset.id ? null : { id: b.dataset.id, username: b.dataset.name, avatar_url: (b.querySelector('img') || {}).src || null };
        refresh();
      }));
      refresh();
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(input.value.replace(/^@/, '').trim()), 250); });
    out.addEventListener('click', () => { outside = !outside; if(outside) chosen = null; refresh(); });
    go.addEventListener('click', async () => {
      if(go.disabled) return;
      go.disabled = true;
      const buyer = outside ? null : chosen;
      const { error } = await rpc('market_sell', { p_listing: l.id, p_buyer: buyer ? buyer.id : null });
      if(error){ go.disabled = false; toast(errText(error, pick({ es: 'No se pudo marcar como vendido. Probá de nuevo.', pt: 'Não foi possível marcar como vendido. Tente de novo.', en: 'Could not mark as sold. Try again.' }))); return; }
      layer.close();
      toast(buyer ? pick({ es: `Listo. Le avisamos a @${buyer.username} para que confirme.`, pt: `Pronto. Avisamos @${buyer.username} para confirmar.`, en: `Done. We asked @${buyer.username} to confirm.` })
                  : pick({ es: 'Marcado como vendido.', pt: 'Marcado como vendido.', en: 'Marked as sold.' }));
      if(typeof done === 'function') done();
    });
    load('');
  }

  /* ================= Confirmar compra y calificar ================= */
  let pending = [];
  async function loadPending(){
    if(!(await myId())){ pending = []; return pending; }
    const { data, error } = await rpc('market_pending', {});
    pending = !error && Array.isArray(data) ? data : [];
    return pending;
  }
  async function openSale(saleId){
    await loadPending();
    const s = pending.find(x => x.sale_id === saleId) || (!saleId ? pending[0] : null);
    if(!s){ toast(pick({ es: 'No tenés nada pendiente de esa venta.', pt: 'Não há nada pendente dessa venda.', en: 'Nothing pending for that sale.' })); pendPill(); return; }
    if(s.action === 'confirm') confirmSheet(s); else rateSheet(s, false);
  }
  function confirmSheet(s){
    const inner = `<div class="mp-scroll">
        <div class="mp-prod">${productArt(s.photo, s.listing_id || s.sale_id, 96)}<span class="stamp">${esc(pick({ es: 'Vendido', pt: 'Vendido', en: 'Sold' }))}</span><span class="pr">${esc(money(s.price, s.currency))}</span></div>
        <div class="mp-deal" aria-hidden="true">${avatar(s.other_avatar, s.other_name, 48)}${ic('shake', C.gold, 28, 1.8)}<span class="mp-av" style="width:48px;height:48px;background:#13303a;color:${C.cyan};font-size:15px">${esc(pick({ es: 'Vos', pt: 'Você', en: 'You' }))}</span></div>
        <h2 class="mp-h" id="mpConfT">${esc(pick({ es: `¿Le compraste esto a @${s.other_name}?`, pt: `Você comprou isso de @${s.other_name}?`, en: `Did you buy this from @${s.other_name}?` }))}</h2>
        <p class="mp-hint" style="text-align:center">${esc(s.title)}</p>
      </div>
      <div class="mp-two"><button type="button" class="mp-no">${esc(pick({ es: 'No fui yo', pt: 'Não fui eu', en: 'Not me' }))}</button><button type="button" class="mp-go">${esc(pick({ es: 'Sí, lo compré', pt: 'Sim, comprei', en: 'Yes, I bought it' }))}</button></div>`;
    const layer = sheet('mpConf', inner);
    const el = layer.el;
    const answer = async yes => {
      el.querySelectorAll('.mp-two button').forEach(b => { b.disabled = true; });
      const { error } = await rpc('market_confirm', { p_sale: s.sale_id, p_yes: yes });
      if(error){ el.querySelectorAll('.mp-two button').forEach(b => { b.disabled = false; }); toast(errText(error, pick({ es: 'No se pudo responder. Probá de nuevo.', pt: 'Não foi possível responder. Tente de novo.', en: 'Could not answer. Try again.' }))); return; }
      layer.close();
      await loadPending();
      if(yes) rateSheet(Object.assign({}, s, { action: 'rate' }), true);
      else { toast(pick({ es: 'Listo. No se va a contar como compra tuya.', pt: 'Pronto. Não vai contar como compra sua.', en: 'Done. It will not count as your purchase.' })); pendPill(); }
    };
    el.querySelector('.mp-no').addEventListener('click', () => answer(false));
    el.querySelector('.mp-go').addEventListener('click', () => answer(true));
  }
  function rateSheet(s, iAmBuyer){
    /* si me vendieron a mí, califico al vendedor; si vendí yo, califico al comprador */
    const buyerSide = iAmBuyer || (s.role === 'buyer');
    const keys = buyerSide ? FOR_SELLER : FOR_BUYER;
    const title = buyerSide ? pick({ es: '¿Cómo te fue con la compra?', pt: 'Como foi a compra?', en: 'How did the purchase go?' })
                            : pick({ es: '¿Cómo te fue con la venta?', pt: 'Como foi a venda?', en: 'How did the sale go?' });
    const words = { 1: pick({ es: 'Mal', pt: 'Ruim', en: 'Bad' }), 2: pick({ es: 'Regular', pt: 'Regular', en: 'Not great' }), 3: pick({ es: 'Bien', pt: 'Ok', en: 'Okay' }), 4: pick({ es: 'Muy bien', pt: 'Muito bom', en: 'Very good' }), 5: pick({ es: 'Excelente', pt: 'Excelente', en: 'Excellent' }) };
    const inner = `<div class="mp-scroll">
        <div class="mp-rater">${avatar(s.other_avatar, s.other_name, 40)}<span style="min-width:0"><b>@${esc(s.other_name)}</b><small>${esc(s.title)}</small></span></div>
        <h2 class="mp-h" id="mpRateT" style="max-width:62%">${esc(title)}</h2>
        <div class="mp-stars" role="radiogroup" aria-label="${esc(pick({ es: 'Estrellas', pt: 'Estrelas', en: 'Stars' }))}">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="false" data-star="${i}" aria-label="${esc(pick({ es: `${i} de 5`, pt: `${i} de 5`, en: `${i} of 5` }))}">${starSvg('none', 44, '#4a4a3a')}</button>`).join('')}</div>
        <p class="mp-hint" data-mp-word style="min-height:18px;font-weight:700;color:#e9d9a6"></p>
        <div class="mp-tagsel" hidden>${keys.map(k => { const t = TAGS[k]; return `<button type="button" aria-pressed="false" data-tag="${k}" data-color="${t.color}" data-icon="${t.icon}"><span style="color:${t.color}">${ic(t.icon, t.color, 16, 2.6)}</span>${esc(pick(t.label))}</button>`; }).join('')}</div>
      </div>
      <div class="mp-acts"><button type="button" class="mp-go" disabled>${esc(pick({ es: 'Enviar', pt: 'Enviar', en: 'Send' }))}</button>
        <p class="mp-note">${esc(pick({ es: 'Es anónima: solo se ve el promedio.', pt: 'É anônima: só aparece a média.', en: 'Anonymous: only the average is shown.' }))}</p></div>`;
    const layer = sheet('mpRate', inner, 'spotri-trofeo.webp');
    const el = layer.el;
    let stars = 0;
    const tags = new Set();
    const tagBox = el.querySelector('.mp-tagsel'), go = el.querySelector('.mp-go'), word = el.querySelector('[data-mp-word]');
    const paint = () => {
      el.querySelectorAll('[data-star]').forEach(b => {
        const i = Number(b.dataset.star), on = i <= stars;
        b.setAttribute('aria-checked', String(i === stars));
        b.innerHTML = on ? starSvg(C.gold, 44) : starSvg('none', 44, '#4a4a3a');
      });
      word.textContent = stars ? words[stars] : '';
      tagBox.hidden = stars < 4;
      el.querySelectorAll('[data-tag]').forEach(b => {
        const on = tags.has(b.dataset.tag), c = b.dataset.color;
        b.setAttribute('aria-pressed', String(on));
        b.style.borderColor = on ? c : '#232923';
        b.style.background = on ? c + '26' : '#121712';
        const dot = b.querySelector('span');
        dot.style.background = on ? c : '#232923';
        dot.innerHTML = on ? ic('check', '#0b0d0b', 16, 2.8) : ic(b.dataset.icon, c, 16, 2.6);
      });
      go.disabled = !stars;
    };
    el.querySelectorAll('[data-star]').forEach(b => b.addEventListener('click', () => { stars = Number(b.dataset.star); paint(); }));
    el.querySelector('.mp-stars').addEventListener('keydown', e => {
      if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      stars = Math.min(5, Math.max(1, (stars || 0) + (e.key === 'ArrowRight' ? 1 : -1)));
      paint();
      el.querySelector(`[data-star="${stars}"]`).focus();
    });
    el.querySelectorAll('[data-tag]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.tag; if(tags.has(k)) tags.delete(k); else tags.add(k); paint(); }));
    go.addEventListener('click', async () => {
      if(!stars) return;
      go.disabled = true;
      const { error } = await rpc('market_rate', { p_sale: s.sale_id, p_stars: stars, p_tags: stars >= 4 ? [...tags] : [] });
      if(error){ go.disabled = false; toast(errText(error, pick({ es: 'No se pudo enviar. Probá de nuevo.', pt: 'Não foi possível enviar. Tente de novo.', en: 'Could not send. Try again.' }))); return; }
      layer.close();
      toast(pick({ es: '¡Gracias! Calificación enviada.', pt: 'Valeu! Avaliação enviada.', en: 'Thanks! Rating sent.' }));
      await loadPending();
      pendPill();
    });
  }

  /* ---------- aviso en el Market: "Confirmá tu compra" / "Calificá" ---------- */
  function pendPill(){
    let b = document.getElementById('mpPend');
    const marketOn = !!document.querySelector('.view.active[data-view="market"]');
    const s = pending[0];
    if(!marketOn || !s || stack.length){ if(b) b.classList.remove('on'); return; }
    css();
    if(!b){
      b = document.createElement('button');
      b.type = 'button';
      b.id = 'mpPend';
      b.addEventListener('click', () => { const x = pending[0]; if(x) openSale(x.sale_id); });
      document.body.appendChild(b);
    }
    const txt = s.action === 'confirm'
      ? pick({ es: `¿Le compraste a @${s.other_name}? Confirmalo`, pt: `Comprou de @${s.other_name}? Confirme`, en: `Bought from @${s.other_name}? Confirm it` })
      : pick({ es: `Calificá a @${s.other_name}`, pt: `Avalie @${s.other_name}`, en: `Rate @${s.other_name}` });
    b.innerHTML = `${starSvg('#170511', 18)}<span>${esc(txt)}${pending.length > 1 ? ` (+${pending.length - 1})` : ''}</span>`;
    b.classList.add('on');
  }
  /* al entrar al Market se revisa si hay algo pendiente (como mucho una vez por minuto) */
  let lastCheck = 0;
  function watchMarket(){
    const v = document.querySelector('[data-view="market"]');
    if(!v) return;
    const check = async () => {
      if(!v.classList.contains('active')){ pendPill(); return; }
      if(Date.now() - lastCheck > 60000){ lastCheck = Date.now(); await loadPending(); }
      pendPill();
    };
    new MutationObserver(check).observe(v, { attributes: true, attributeFilter: ['class'] });
    check();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchMarket); else watchMarket();

  /* "Ver perfil" del vendedor en un producto */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mp-open]');
    if(!b) return;
    e.preventDefault();
    openProfile(b.dataset.mpOpen);
  });

  window.SpotraMarketRating = { openProfile, sell, openSale, loadPending: async () => { lastCheck = Date.now(); await loadPending(); pendPill(); return pending; } };
})();
