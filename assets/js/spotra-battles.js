/* SPOTRA · Batallas de riders (v1, 16/11/2026)
   Pestaña "Batallas" dentro de Eventos. 1 contra 1, reto abierto:
   - Un rider crea (disciplina + consigna + video de hasta 20 s) y cualquier otro acepta subiendo su video.
   - Votación de 48 h: un voto por cuenta; los participantes no votan la suya; el conteo se ve después de votar.
   - Ganar 3 puntos · empate 1 · perder 0 (con menos de 5 votos no suma). Ranking de Batallas aparte.
   - Solo mayores de 18 crean y aceptan. Al terminar, los videos se borran solos (queda el resultado).
   Todo pasa por funciones de la base (battle_create, battle_accept, battle_vote, battle_cancel,
   battles_list, battle_ranking). Videos en el bucket "battle-videos".
   En la lista no se cargan videos (ahorra datos): se ven recién al abrir la batalla. */
(function(){
  const BUCKET = 'battle-videos';
  const MAX_SEC = 20;
  const MAX_BYTES = 25 * 1024 * 1024;
  const TYPES = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
  const DISCS = ['skate', 'bmx', 'rollers', 'scooter'];
  const DISC_LABEL = { skate: 'Skate', bmx: 'BMX', rollers: 'Rollers', scooter: 'Scooter' };
  const MY_DISC = { skate: 'skate', bmx: 'bmx', roller: 'rollers', rollers: 'rollers', scooter: 'scooter' };

  let uid = null;
  let sb = null;
  let rows = [];
  let activeDisc = 'all';
  let wrapEl = null;
  let current = null;        /* batalla abierta en el detalle */
  let view = '';             /* 'detail' | 'ranking' */
  let rankDisc = 'all';
  let form = null;           /* { mode:'create'|'accept', battle, disc, file, url, busy } */
  let adultCache = null;     /* { uid, state:'adult'|'minor'|'nodate' } */
  let deep = null;
  try { deep = new URLSearchParams(location.search).get('battle'); } catch(e){}

  const T = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const L = () => (window.SpotraI18n ? window.SpotraI18n.lang() : 'es');
  const pick = o => o[L()] || o.es;
  function toast(m){ (window.toast || function(x){ console.log('[SPOTRA]', x); })(m); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function B(){ return window.SpotraBackend || null; }
  async function db(){
    if(sb) return sb;
    try { sb = B() && B().getClient ? await B().getClient() : null; } catch(e){ sb = null; }
    return sb;
  }
  async function loadUid(){
    try { uid = B() && B().getUserId ? await B().getUserId() : null; } catch(e){ uid = null; }
    return uid;
  }
  async function rpc(name, args){
    const c = await db();
    if(!c) return { data: null, error: { message: '' } };
    try { return await c.rpc(name, args || {}); }
    catch(e){ return { data: null, error: { message: '' } }; }
  }
  /* Los mensajes de la base están escritos para el rider; los errores técnicos se cambian por uno genérico. */
  function errText(error, fallback){
    const m = error && error.message ? String(error.message) : '';
    const technical = !m || /permission|policy|violates|jwt|fetch|schema|function|column|relation|syntax|timeout|network/i.test(m);
    return T(technical ? fallback : m);
  }
  function videoUrl(path){
    if(!sb || !path) return '';
    try { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || ''; } catch(e){ return ''; }
  }

  /* ---------- textos con datos ---------- */
  function leftText(iso){
    const ms = new Date(iso).getTime() - Date.now();
    if(!(ms > 0)) return T('Cerrando la votación');
    const h = Math.floor(ms / 3600000);
    const x = h >= 1 ? h + ' h' : Math.max(1, Math.round(ms / 60000)) + ' min';
    return pick({ es: `Quedan ${x}`, pt: `Faltam ${x}`, en: `${x} left` });
  }
  function agoText(iso){
    const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    const x = m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d';
    return pick({ es: `Publicada hace ${x}`, pt: `Publicada há ${x}`, en: `Posted ${x} ago` });
  }
  function votesText(n){
    n = Number(n) || 0;
    return pick({ es: `${n} voto${n === 1 ? '' : 's'}`, pt: `${n} voto${n === 1 ? '' : 's'}`, en: `${n} vote${n === 1 ? '' : 's'}` });
  }
  function dateText(iso){
    const d = new Date(iso);
    if(isNaN(d)) return '';
    try { return d.toLocaleDateString(L() === 'pt' ? 'pt-BR' : L() === 'en' ? 'en-GB' : 'es-UY', { day: 'numeric', month: 'short' }); }
    catch(e){ return d.getDate() + '/' + (d.getMonth() + 1); }
  }
  const nameOf = (b, side) => '@' + (b[side + '_name'] || 'rider');
  const mine = b => !!uid && (b.creator_id === uid || b.opponent_id === uid);

  /* ---------- íconos ---------- */
  const I = {
    play: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>',
    back: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    close: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    share: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
    flag: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>',
    video: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>',
    videoOff: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3M3 3l18 18"/></svg>',
    trophy: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
    vs: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4l9 9M14 4l-3 3M4 14l6 6M19 4 8 15M16 14l4 4M14 20l6-6"/></svg>'
  };

  /* ---------- estilos (van acá para no tocar index.html) ---------- */
  function css(){
    if(document.getElementById('btCss')) return;
    const s = document.createElement('style');
    s.id = 'btCss';
    s.textContent = `
.bt-sub{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:20px 0 10px}
.bt-bar{display:flex;align-items:center;gap:8px;margin-top:12px}
.bt-bar .filter-row{flex:1;min-width:0;margin-top:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
.bt-bar .filter-row::-webkit-scrollbar{display:none}
.bt-bar .filter-row button{flex-shrink:0;height:36px;min-height:36px;padding:0 14px;font-size:13.5px}
.bt-rankbtn{flex-shrink:0;width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.045);color:var(--text);display:grid;place-items:center;padding:0}
.bt-rankbtn svg{width:20px;height:20px}
.bt-card{display:block;width:100%;text-align:left;color:var(--text);border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);padding:10px;margin-bottom:10px;font-family:inherit}
.bt-duo{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.bt-ph{position:relative;height:150px;border-radius:10px;background:#141814;border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;overflow:hidden}
.bt-ph b{font-size:12.5px;font-weight:700;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-av{width:44px;height:44px;border-radius:50%;background:#1b201b;border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;font-weight:700;font-size:16px;color:#c9cfca;overflow:hidden;flex-shrink:0}
.bt-av img{width:100%;height:100%;object-fit:cover;display:block}
.bt-av.sm{width:28px;height:28px;font-size:11px}
.bt-av.lg{width:60px;height:60px;font-size:22px}
.bt-vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:var(--bg);border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;font-family:var(--display);font-size:13px;font-weight:700}
.bt-info{display:flex;align-items:center;gap:12px;padding:12px 4px 2px}
.bt-info>div{flex:1;min-width:0}
.bt-title{display:block;font-size:16px;font-weight:700;overflow-wrap:anywhere}
.bt-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-top:6px}
.bt-chip{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;font-weight:700;font-size:12.5px;letter-spacing:.02em;background:rgba(255,255,255,.07);color:#c9cfca;white-space:nowrap}
.bt-chip.live{background:rgba(255,154,61,.14);color:#ffab5c}
.bt-chip.disc{background:rgba(116,255,58,.12);color:var(--green-hot);text-transform:uppercase;letter-spacing:.04em}
.bt-go{flex-shrink:0;display:inline-flex;align-items:center;height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.045);color:var(--text);font-weight:700;font-size:14px}
.bt-row{display:flex;gap:12px;align-items:center}
.bt-row .bt-go{margin-top:8px}
.bt-row>div:last-child{flex:1;min-width:0}
.bt-line{font-size:13px;color:var(--muted);margin-top:3px;overflow-wrap:anywhere}
.bt-empty .es-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px}
.bt-ov{position:fixed;inset:0;z-index:120;background:var(--bg);display:none;flex-direction:column;color:var(--text)}
.bt-ov.open{display:flex}
.bt-ov.bt-formov{z-index:125}
.bt-hd{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:4px;height:56px;box-sizing:content-box;padding:env(safe-area-inset-top) 8px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.bt-hd b{flex:1;min-width:0;text-align:center;font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-hd h2{flex:1;min-width:0;margin:0 0 0 12px;font-family:var(--display);font-size:22px;line-height:1;text-transform:uppercase}
.bt-ic{width:44px;height:44px;flex-shrink:0;border:0;background:transparent;color:var(--text);display:grid;place-items:center;padding:0}
.bt-ic svg{width:22px;height:22px}
.bt-ic[hidden]{display:grid!important;visibility:hidden}
.bt-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.bt-in{max-width:560px;margin:0 auto;padding:16px 20px calc(28px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px}
.bt-chips{display:flex;flex-wrap:wrap;gap:8px}
.bt-h{margin:0;font-family:var(--display);font-size:28px;line-height:1.08;text-transform:uppercase;overflow-wrap:anywhere}
.bt-vids{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.bt-vids.one{grid-template-columns:minmax(0,260px);justify-content:center}
.bt-side{display:flex;flex-direction:column;gap:10px;min-width:0}
.bt-video{width:100%;aspect-ratio:9/16;border-radius:14px;background:#000;border:1px solid rgba(255,255,255,.1);object-fit:contain;display:block}
.bt-who{display:flex;align-items:center;gap:8px;min-width:0;border:0;background:transparent;color:var(--text);padding:0;font-family:inherit;text-align:left;min-height:28px}
.bt-who b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-btn{height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.045);color:var(--text);font-weight:700;font-size:14px;font-family:inherit;padding:0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-btn.voted{border-color:var(--green-hot);color:var(--green-hot);background:rgba(116,255,58,.08)}
.bt-btn.danger{color:#ff8f8f;border-color:rgba(255,120,120,.35)}
.bt-btn:disabled{opacity:.55}
.bt-main{height:48px;border-radius:12px;border:0;background:var(--green-hot);color:#051006;font-family:var(--display);font-weight:700;font-size:15px;letter-spacing:.05em;text-transform:uppercase;padding:0 16px}
.bt-main:disabled{opacity:.6}
.bt-box{padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);display:flex;flex-direction:column;gap:6px;font-size:13.5px;line-height:1.45;color:var(--muted)}
.bt-box>b{font-size:14.5px;color:var(--text)}
.bt-box.dash{flex-direction:row;align-items:center;gap:12px;border-style:dashed;background:none}
.bt-box.dash svg{width:22px;height:22px;flex-shrink:0}
.bt-note{font-size:12.5px;color:var(--muted);text-align:center;line-height:1.45}
.bt-res{display:flex;flex-direction:column;gap:6px}
.bt-res-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:14px;color:var(--muted)}
.bt-res-top b{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-track{height:10px;border-radius:999px;background:#1b201b;overflow:hidden}
.bt-fill{height:100%;border-radius:999px;background:#5d665e}
.bt-fill.win{background:var(--green-hot)}
.bt-win{display:flex;align-items:center;gap:14px;padding:14px;border-radius:16px;border:1px solid var(--green-hot);background:rgba(116,255,58,.06)}
.bt-win.flat{border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.03)}
.bt-win>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.bt-win>div b{font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-lbl{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.bt-pts{flex:none!important;align-items:flex-end;gap:0!important}
.bt-pts span{font-family:var(--display);font-weight:700;font-size:30px;line-height:1;color:var(--green-hot)}
.bt-pts small{font-size:12px;color:var(--muted)}
.bt-f{display:flex;flex-direction:column;gap:8px}
.bt-f label,.bt-f .bt-lbl{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.bt-f input[type=text]{height:48px;box-sizing:border-box;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:var(--text);padding:0 14px;font:500 16px var(--body)}
.bt-f small{font-size:12.5px;color:var(--muted)}
.bt-discs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.bt-discs button{height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.045);color:var(--text);font-weight:700;font-size:13.5px;font-family:inherit;padding:0}
.bt-discs button.on{border-color:var(--green-hot);background:var(--green-hot);color:#051006}
.bt-drop{min-height:148px;border-radius:14px;border:1px dashed rgba(255,255,255,.28);background:rgba(255,255,255,.03);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-family:inherit;padding:14px}
.bt-drop svg{width:28px;height:28px;color:#c9cfca}
.bt-drop b{font-size:15px}
.bt-drop span{font-size:12.5px;color:var(--muted)}
.bt-prev{display:flex;gap:12px;align-items:center}
.bt-prev video{width:96px;aspect-ratio:9/16;border-radius:10px;background:#000;object-fit:contain;flex-shrink:0}
.bt-prev>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.bt-rules{margin:0;padding:14px;list-style:none;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);display:flex;flex-direction:column;gap:8px}
.bt-rules li{display:flex;gap:10px;font-size:13.5px;line-height:1.45;color:#c9cfca}
.bt-rules li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--muted);margin-top:7px;flex-shrink:0}
.bt-rk{width:100%;text-align:left;color:var(--text);font-family:inherit}
@media (max-width:360px){.bt-in{padding-left:14px;padding-right:14px}.bt-h{font-size:24px}.bt-discs button{font-size:12.5px}}
`;
    document.head.appendChild(s);
  }

  /* ---------- piezas ---------- */
  function avatar(b, side, cls){
    const url = b[side + '_avatar'];
    const name = b[side + '_name'] || 'R';
    return `<span class="bt-av ${cls || ''}" aria-hidden="true">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : esc(String(name).charAt(0).toUpperCase())}</span>`;
  }
  function discChip(b){ return `<span class="bt-chip disc">${esc(DISC_LABEL[b.discipline] || b.discipline)}</span>`; }

  function cardVoting(b){
    const tag = mine(b) ? T('Tu batalla') : b.my_vote ? T('Ya votaste') : T('Votar');
    return `<button type="button" class="bt-card" data-bt-open="${esc(b.id)}">
      <div class="bt-duo">
        <div class="bt-ph">${avatar(b, 'creator')}<b>${esc(nameOf(b, 'creator'))}</b></div>
        <div class="bt-ph">${avatar(b, 'opponent')}<b>${esc(nameOf(b, 'opponent'))}</b></div>
        <span class="bt-vs" aria-hidden="true">VS</span>
      </div>
      <div class="bt-info">
        <div>
          <span class="bt-title">${esc(b.prompt)}</span>
          <div class="bt-meta"><span class="bt-chip live">${esc(leftText(b.voting_ends_at))}</span><span>${esc(DISC_LABEL[b.discipline] || '')} · ${esc(votesText(b.total_votes))}</span></div>
        </div>
        <span class="bt-go">${esc(tag)}</span>
      </div>
    </button>`;
  }
  function cardOpen(b){
    const own = uid && b.creator_id === uid;
    return `<button type="button" class="bt-card" data-bt-open="${esc(b.id)}">
      <div class="bt-row">
        ${avatar(b, 'creator', 'lg')}
        <div>
          <span class="bt-title">${esc(b.prompt)}</span>
          <div class="bt-line">${esc(nameOf(b, 'creator'))} · ${esc(DISC_LABEL[b.discipline] || '')}</div>
          <div class="bt-line">${esc(agoText(b.created_at))}</div>
          <span class="bt-go">${esc(own ? T('Tu batalla · esperando rival') : T('Aceptar batalla'))}</span>
        </div>
      </div>
    </button>`;
  }
  function resultLine(b){
    if(b.result === 'creator' || b.result === 'opponent'){
      const w = nameOf(b, b.result);
      const hi = Math.max(b.creator_votes || 0, b.opponent_votes || 0), lo = Math.min(b.creator_votes || 0, b.opponent_votes || 0);
      return pick({ es: `Ganó ${w} · ${hi} a ${lo}`, pt: `${w} venceu · ${hi} a ${lo}`, en: `${w} won · ${hi}–${lo}` });
    }
    if(b.result === 'draw') return T('Empate') + ' · ' + votesText(b.total_votes);
    return T('Sin puntos: menos de 5 votos');
  }
  function cardDone(b){
    return `<button type="button" class="bt-card" data-bt-open="${esc(b.id)}">
      <span class="bt-title">${esc(b.prompt)}</span>
      <div class="bt-line">${esc(nameOf(b, 'creator'))} vs ${esc(nameOf(b, 'opponent'))} · ${esc(DISC_LABEL[b.discipline] || '')}</div>
      <div class="bt-meta"><span class="bt-chip">${esc(resultLine(b))}</span></div>
    </button>`;
  }
  function emptyHTML(any){
    return `<div class="empty-state bt-empty"><span class="es-ic">${I.vs}</span><b>${esc(T(any ? 'No hay batallas de esta disciplina' : 'Todavía no hay batallas'))}</b>
      <p>${esc(T('Subí un video corto, poné la consigna y desafiá a otro rider. El público vota.'))}</p>
      <div class="es-acts"><button type="button" class="primary-btn" data-bt-create>${esc(T('Crear batalla'))}</button>${any ? `<button type="button" class="ghost-btn" data-bt-disc="all">${esc(T('Ver todas'))}</button>` : ''}</div></div>`;
  }

  /* ---------- lista (dentro de Eventos › Batallas) ---------- */
  function barHTML(){
    const opts = ['all'].concat(DISCS);
    return `<div class="bt-bar"><div class="filter-row">${opts.map(d =>
      `<button type="button" class="${d === activeDisc ? 'active' : ''}" data-bt-disc="${d}">${esc(d === 'all' ? T('Todas') : DISC_LABEL[d])}</button>`).join('')}</div>
      <button type="button" class="bt-rankbtn" data-bt-ranking aria-label="${esc(T('Ranking de Batallas'))}">${I.trophy}</button></div>`;
  }
  function paint(){
    if(!wrapEl) return;
    const list = rows.filter(b => activeDisc === 'all' || b.discipline === activeDisc);
    const voting = list.filter(b => b.status === 'voting');
    const open = list.filter(b => b.status === 'open');
    const done = list.filter(b => b.status === 'finished');
    let html = barHTML();
    if(!list.length) html += emptyHTML(activeDisc !== 'all' && rows.length > 0);
    if(voting.length) html += `<div class="bt-sub">${esc(T('En votación'))}</div>` + voting.map(cardVoting).join('');
    if(open.length) html += `<div class="bt-sub">${esc(T('Buscan rival'))}</div>` + open.map(cardOpen).join('');
    if(done.length) html += `<div class="bt-sub">${esc(T('Terminadas'))}</div>` + done.map(cardDone).join('');
    wrapEl.innerHTML = html;
  }
  async function load(){
    const { data, error } = await rpc('battles_list', {});
    if(error) return false;
    rows = Array.isArray(data) ? data : [];
    return true;
  }
  async function render(wrap){
    css();
    wrapEl = wrap || document.getElementById('eventsList');
    if(!wrapEl) return;
    wrapEl.innerHTML = `<div class="meta" style="margin-top:14px">${esc(T('Cargando batallas...'))}</div>`;
    await loadUid();
    const ok = await load();
    if(!wrapEl.isConnected) return;
    if(!ok){
      wrapEl.innerHTML = `<div class="empty-state bt-empty"><span class="es-ic">${I.vs}</span><b>${esc(T('No pudimos cargar las batallas'))}</b><div class="es-acts"><button type="button" class="ghost-btn" data-bt-reload>${esc(T('Reintentar'))}</button></div></div>`;
      return;
    }
    paint();
    if(deep){ const id = deep; deep = null; try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){} openById(id, true); }
  }
  async function refresh(){
    const ok = await load();
    if(ok && wrapEl && wrapEl.isConnected && battlesTabActive()) paint();
  }

  /* ---------- hojas a pantalla completa ---------- */
  function ov(id, extra){
    let el = document.getElementById(id);
    if(!el){
      el = document.createElement('div');
      el.id = id;
      el.className = 'bt-ov' + (extra ? ' ' + extra : '');
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
    }
    return el;
  }
  function lockScroll(){
    const any = document.querySelector('.bt-ov.open');
    document.documentElement.style.overflow = any ? 'hidden' : '';
  }
  function stopVideos(root){
    (root || document).querySelectorAll('.bt-ov video').forEach(v => { try { v.pause(); } catch(e){} });
  }
  function closeMain(){
    const el = document.getElementById('btOv');
    if(el){ stopVideos(el); el.classList.remove('open'); el.innerHTML = ''; }
    current = null; view = '';
    lockScroll();
  }
  function closeForm(){
    const el = document.getElementById('btForm');
    if(el){ el.classList.remove('open'); el.innerHTML = ''; }
    if(form && form.url){ try { URL.revokeObjectURL(form.url); } catch(e){} }
    form = null;
    lockScroll();
  }

  /* ---------- detalle ---------- */
  function sideHTML(b, side){
    const path = b[side + '_video'];
    const url = videoUrl(path);
    const name = nameOf(b, side);
    let btn = '';
    if(b.status === 'voting'){
      if(mine(b)) btn = '';
      else if(b.my_vote) btn = b.my_vote === side ? `<button type="button" class="bt-btn voted" disabled>${esc(T('Tu voto'))}</button>` : '';
      else btn = `<button type="button" class="bt-btn" data-bt-vote="${side}">${esc(pick({ es: `Votar a ${name}`, pt: `Votar em ${name}`, en: `Vote ${name}` }))}</button>`;
    }
    return `<div class="bt-side">
      ${url ? `<video class="bt-video" controls playsinline preload="metadata" src="${esc(url)}#t=0.1" aria-label="${esc(pick({ es: `Video de ${name}`, pt: `Vídeo de ${name}`, en: `Video by ${name}` }))}"></video>` : ''}
      <button type="button" class="bt-who" data-bt-rider="${esc(b[side + '_id'] || '')}">${avatar(b, side, 'sm')}<b>${esc(name)}</b></button>
      ${btn}
    </div>`;
  }
  function barsHTML(b){
    const c = Number(b.creator_votes) || 0, o = Number(b.opponent_votes) || 0, tot = c + o;
    const pc = tot ? Math.round(c * 100 / tot) : 0, po = tot ? 100 - pc : 0;
    const one = (side, n, p, win) => `<div class="bt-res"><div class="bt-res-top"><b>${esc(nameOf(b, side))}</b><span>${esc(votesText(n))} · ${p}%</span></div><div class="bt-track"><div class="bt-fill ${win ? 'win' : ''}" style="width:${p}%"></div></div></div>`;
    return `<div class="bt-box"><span class="bt-lbl">${esc(T('Votos del público'))}</span>${one('creator', c, pc, c >= o && tot > 0)}${one('opponent', o, po, o >= c && tot > 0)}</div>`;
  }
  function detailBody(b){
    let h = `<div class="bt-chips">${discChip(b)}`;
    if(b.status === 'voting') h += `<span class="bt-chip live">${esc(T('En votación'))} · ${esc(leftText(b.voting_ends_at))}</span>`;
    else if(b.status === 'open') h += `<span class="bt-chip">${esc(T('Buscando rival'))}</span>`;
    else h += `<span class="bt-chip">${esc(T('Terminada'))} · ${esc(dateText(b.finished_at))}</span>`;
    h += `</div><h2 class="bt-h">${esc(b.prompt)}</h2>`;

    if(b.status === 'voting'){
      h += `<div class="bt-vids">${sideHTML(b, 'creator')}${sideHTML(b, 'opponent')}</div>`;
      if(b.creator_votes != null && b.opponent_votes != null) h += barsHTML(b);
      else h += `<div class="bt-box"><b>${esc(pick({ es: `${votesText(b.total_votes)} hasta ahora`, pt: `${votesText(b.total_votes)} até agora`, en: `${votesText(b.total_votes)} so far` }))}</b><span>${esc(T('Votás una sola vez. El resultado se ve después de votar.'))}</span></div>`;
      if(mine(b)) h += `<div class="bt-note">${esc(T('Es tu batalla: no podés votar. Compartila para que te voten.'))}</div>`;
      h += `<div class="bt-note">${esc(T('Los videos se borran solos cuando termina la batalla.'))}</div>`;
    } else if(b.status === 'open'){
      h += `<div class="bt-vids one">${sideHTML(b, 'creator')}</div>`;
      if(uid && b.creator_id === uid){
        h += `<div class="bt-box"><b>${esc(T('Esperando rival'))}</b><span>${esc(T('Cualquier rider puede aceptarla subiendo su video. Si nadie acepta en 7 días, la batalla se borra.'))}</span></div>`;
        h += `<button type="button" class="bt-btn danger" data-bt-cancel>${esc(T('Borrar batalla'))}</button>`;
      } else {
        h += `<button type="button" class="bt-main" data-bt-accept>${esc(T('Aceptar batalla'))}</button>`;
        h += `<div class="bt-note">${esc(T('Subís tu video (hasta 20 segundos) y arranca la votación de 48 horas.'))}</div>`;
      }
    } else {
      if(b.result === 'creator' || b.result === 'opponent'){
        h += `<div class="bt-win">${avatar(b, b.result, 'lg')}<div><span class="bt-lbl">${esc(T('Ganó la batalla'))}</span><b>${esc(nameOf(b, b.result))}</b></div><div class="bt-pts"><span>+3</span><small>${esc(T('puntos'))}</small></div></div>`;
      } else if(b.result === 'draw'){
        h += `<div class="bt-win flat"><div><span class="bt-lbl">${esc(T('Empate'))}</span><b>${esc(nameOf(b, 'creator'))} · ${esc(nameOf(b, 'opponent'))}</b></div><div class="bt-pts"><span>+1</span><small>${esc(T('punto cada uno'))}</small></div></div>`;
      } else {
        h += `<div class="bt-win flat"><div><span class="bt-lbl">${esc(T('Sin puntos'))}</span><b>${esc(T('Menos de 5 votos'))}</b></div></div>`;
      }
      h += barsHTML(b);
      h += `<div class="bt-box dash">${I.videoOff}<span>${esc(T('Los videos de esta batalla se borraron al terminar. Queda el resultado.'))}</span></div>`;
      h += `<button type="button" class="bt-main" data-bt-ranking>${esc(T('Ver ranking de Batallas'))}</button>`;
    }
    return h;
  }
  function paintDetail(){
    const b = current;
    if(!b) return;
    const el = ov('btOv');
    const canReport = !!uid && !mine(b);
    el.setAttribute('aria-label', T('Batalla'));
    el.innerHTML = `<div class="bt-hd">
        <button type="button" class="bt-ic" data-bt-close aria-label="${esc(T('Volver'))}">${I.back}</button>
        <b>${esc(T('Batalla'))}</b>
        <button type="button" class="bt-ic" data-bt-share aria-label="${esc(T('Compartir'))}">${I.share}</button>
        <button type="button" class="bt-ic" ${canReport ? '' : 'hidden'} data-report="battle" data-report-id="${esc(b.id)}" data-report-user="${esc(b.creator_id || '')}" data-report-name="${esc(b.creator_name || '')}" aria-label="${esc(T('Reportar'))}">${I.flag}</button>
      </div>
      <div class="bt-body"><div class="bt-in">${detailBody(b)}</div></div>`;
    el.classList.add('open');
    view = 'detail';
    lockScroll();
  }
  function openDetail(b){ css(); current = b; paintDetail(); }

  async function openById(id, quiet){
    css();
    await loadUid();
    let b = rows.find(x => x.id === id) || null;
    if(!b){
      const { data } = await rpc('battles_list', { p_id: id });
      b = Array.isArray(data) && data[0] ? data[0] : null;
    }
    if(!b){ if(!quiet) toast(T('Esa batalla ya no existe.')); else toast(T('Esa batalla ya no existe.')); return; }
    openDetail(b);
  }
  async function reloadCurrent(){
    if(!current) return;
    const id = current.id;
    const { data, error } = await rpc('battles_list', { p_id: id });
    if(error) return;
    const b = Array.isArray(data) && data[0] ? data[0] : null;
    if(!current || current.id !== id) return;
    if(!b){ closeMain(); toast(T('Esa batalla ya no existe.')); return; }
    current = b;
    paintDetail();
  }

  /* ---------- votar / borrar / compartir ---------- */
  async function vote(side, btn){
    const b = current;
    if(!b) return;
    if(!uid){ toast(T('Iniciá sesión para votar.')); return; }
    const name = nameOf(b, side);
    if(!window.confirm(pick({ es: `¿Votar a ${name}? El voto no se puede cambiar.`, pt: `Votar em ${name}? O voto não pode ser alterado.`, en: `Vote for ${name}? You can't change your vote.` }))) return;
    if(btn) btn.disabled = true;
    const { data, error } = await rpc('battle_vote', { p_id: b.id, p_choice: side });
    if(error){
      if(btn) btn.disabled = false;
      toast(errText(error, 'No se pudo votar. Probá de nuevo.'));
      reloadCurrent();
      return;
    }
    if(current && current.id === b.id){
      current.my_vote = side;
      current.creator_votes = data && data.creator_votes != null ? Number(data.creator_votes) : null;
      current.opponent_votes = data && data.opponent_votes != null ? Number(data.opponent_votes) : null;
      if(current.creator_votes != null) current.total_votes = current.creator_votes + current.opponent_votes;
      /* se repinta solo el pie para no cortar el video que está mirando */
      paintDetailKeepVideos();
    }
    toast(T('Voto enviado.'));
    refresh();
  }
  function paintDetailKeepVideos(){
    const el = document.getElementById('btOv');
    if(!el || !current){ return; }
    const times = Array.from(el.querySelectorAll('video')).map(v => ({ t: v.currentTime, playing: !v.paused }));
    paintDetail();
    el.querySelectorAll('video').forEach((v, i) => {
      const s = times[i];
      if(!s || !s.t) return;
      v.addEventListener('loadedmetadata', () => { try { v.currentTime = s.t; if(s.playing) v.play().catch(() => {}); } catch(e){} }, { once: true });
    });
  }
  async function cancelBattle(btn){
    const b = current;
    if(!b) return;
    if(!window.confirm(T('¿Borrar esta batalla? No se puede deshacer.'))) return;
    if(btn) btn.disabled = true;
    const { error } = await rpc('battle_cancel', { p_id: b.id });
    if(error){ if(btn) btn.disabled = false; toast(errText(error, 'No se pudo borrar. Probá de nuevo.')); return; }
    closeMain();
    toast(T('Batalla borrada.'));
    refresh();
  }
  function share(){
    const b = current;
    if(!b) return;
    const url = location.origin + '/?battle=' + encodeURIComponent(b.id) + '#events';
    const text = b.status === 'open'
      ? pick({ es: `Batalla en SPOTRA: "${b.prompt}". ¿La aceptás?`, pt: `Batalha no SPOTRA: "${b.prompt}". Você aceita?`, en: `Battle on SPOTRA: "${b.prompt}". Will you take it?` })
      : pick({ es: `Batalla en SPOTRA: "${b.prompt}". Entrá y votá.`, pt: `Batalha no SPOTRA: "${b.prompt}". Entre e vote.`, en: `Battle on SPOTRA: "${b.prompt}". Come and vote.` });
    if(typeof window.spotraShare === 'function'){ window.spotraShare({ title: 'SPOTRA', text, url }); return; }
    if(navigator.share){ navigator.share({ title: 'SPOTRA', text, url }).catch(() => {}); return; }
    try { navigator.clipboard.writeText(text + ' ' + url); toast(T('Link copiado.')); } catch(e){}
  }

  /* ---------- ranking de Batallas ---------- */
  async function openRanking(){
    css();
    stopVideos();
    current = null;
    view = 'ranking';
    const el = ov('btOv');
    el.setAttribute('aria-label', T('Ranking de Batallas'));
    const opts = ['all'].concat(DISCS);
    el.innerHTML = `<div class="bt-hd">
        <button type="button" class="bt-ic" data-bt-close aria-label="${esc(T('Volver'))}">${I.back}</button>
        <b>${esc(T('Ranking de Batallas'))}</b>
        <span class="bt-ic" aria-hidden="true"></span>
      </div>
      <div class="bt-body"><div class="bt-in">
        <div class="bt-bar" style="margin-top:0"><div class="filter-row">${opts.map(d =>
          `<button type="button" class="${d === rankDisc ? 'active' : ''}" data-bt-rank="${d}">${esc(d === 'all' ? T('Todas') : DISC_LABEL[d])}</button>`).join('')}</div></div>
        <div id="btRankList"><div class="meta">${esc(T('Cargando ranking...'))}</div></div>
        <div class="bt-note">${esc(T('Ganar una batalla da 3 puntos y empatar 1. Con menos de 5 votos no suma.'))}</div>
      </div></div>`;
    el.classList.add('open');
    lockScroll();
    const { data, error } = await rpc('battle_ranking', rankDisc === 'all' ? {} : { p_discipline: rankDisc });
    const box = document.getElementById('btRankList');
    if(!box || view !== 'ranking') return;
    const list = !error && Array.isArray(data) ? data : [];
    if(error){ box.innerHTML = `<div class="meta">${esc(T('No pudimos cargar el ranking.'))}</div>`; return; }
    if(!list.length){
      box.innerHTML = `<div class="empty-state bt-empty"><span class="es-ic">${I.trophy}</span><b>${esc(T('Todavía no hay puntos de Batallas'))}</b><p>${esc(T('Ganá una batalla y aparecé acá.'))}</p></div>`;
      return;
    }
    box.innerHTML = list.map((r, i) => {
      const line = pick({
        es: `${r.wins} ganada${r.wins === 1 ? '' : 's'} · ${r.draws} empate${r.draws === 1 ? '' : 's'} · ${r.losses} perdida${r.losses === 1 ? '' : 's'}`,
        pt: `${r.wins} vitória${r.wins === 1 ? '' : 's'} · ${r.draws} empate${r.draws === 1 ? '' : 's'} · ${r.losses} derrota${r.losses === 1 ? '' : 's'}`,
        en: `${r.wins} won · ${r.draws} drawn · ${r.losses} lost`
      });
      return `<button type="button" class="rk-row bt-rk top${i + 1}" data-bt-rider="${esc(r.rider_id)}">
        <div class="rk-pos">${i + 1}</div>
        <div class="rk-name">@${esc(r.name || 'rider')}<div class="meta">${esc(line)}</div></div>
        <div class="rk-pts">${Number(r.points) || 0}<span>pts</span></div>
      </button>`;
    }).join('');
  }

  /* ---------- crear / aceptar ---------- */
  async function adultState(){
    if(!uid) return 'anon';
    if(adultCache && adultCache.uid === uid) return adultCache.state;
    let state = 'unknown';
    try {
      const c = await db();
      const { data, error } = await c.from('profiles').select('birth_date').eq('id', uid).maybeSingle();
      if(!error){
        if(!data || !data.birth_date) state = 'nodate';
        else {
          const d = new Date(data.birth_date + 'T00:00:00');
          const lim = new Date(); lim.setFullYear(lim.getFullYear() - 18); lim.setHours(0, 0, 0, 0);
          state = d <= lim ? 'adult' : 'minor';
        }
      }
    } catch(e){}
    if(state !== 'unknown') adultCache = { uid, state };
    return state;
  }
  async function canPlay(){
    await loadUid();
    if(!uid){ toast(T('Iniciá sesión para participar en batallas.')); return false; }
    const st = await adultState();
    if(st === 'minor'){ toast(T('Las batallas son para mayores de 18. Podés mirar y votar.')); return false; }
    if(st === 'nodate'){ toast(T('Cargá tu fecha de nacimiento para participar en batallas.')); return false; }
    return true;   /* 'unknown': decide el servidor */
  }
  function myDisc(){ return MY_DISC[window.SpotraDiscipline && window.SpotraDiscipline.get && window.SpotraDiscipline.get()] || ''; }

  function paintForm(){
    if(!form) return;
    const el = ov('btForm', 'bt-formov');
    const acc = form.mode === 'accept';
    const title = T(acc ? 'Aceptar batalla' : 'Crear batalla');
    const keep = el.querySelector('#btPrompt');
    const promptVal = keep ? keep.value : (form.prompt || '');
    let h = '';
    if(acc){
      h += `<div class="bt-chips">${discChip(form.battle)}</div><h2 class="bt-h">${esc(form.battle.prompt)}</h2>
        <div class="bt-note" style="text-align:left">${esc(pick({ es: `Desafío de ${nameOf(form.battle, 'creator')}`, pt: `Desafio de ${nameOf(form.battle, 'creator')}`, en: `Challenge by ${nameOf(form.battle, 'creator')}` }))}</div>`;
    } else {
      h += `<div class="bt-f"><span class="bt-lbl">${esc(T('Disciplina'))}</span><div class="bt-discs">${DISCS.map(d =>
        `<button type="button" class="${d === form.disc ? 'on' : ''}" aria-pressed="${d === form.disc}" data-bt-fdisc="${d}">${DISC_LABEL[d]}</button>`).join('')}</div></div>
        <div class="bt-f"><label for="btPrompt">${esc(T('Consigna'))}</label>
          <input id="btPrompt" type="text" maxlength="60" autocomplete="off" placeholder="${esc(T('Ej.: Mejor kickflip'))}" value="${esc(promptVal)}">
          <small>${esc(T('Qué hay que hacer para ganar. Hasta 60 letras.'))}</small></div>`;
    }
    h += `<div class="bt-f"><span class="bt-lbl">${esc(T('Tu video'))}</span>`;
    if(form.file){
      h += `<div class="bt-prev"><video src="${esc(form.url)}" controls playsinline muted preload="metadata"></video>
        <div><b style="font-size:14px;overflow-wrap:anywhere">${esc(form.file.name || 'video')}</b>
        <small>${esc((form.file.size / 1048576).toFixed(1))} MB · ${esc(String(Math.round(form.dur || 0)))} s</small>
        <button type="button" class="bt-btn" data-bt-pick ${form.busy ? 'disabled' : ''}>${esc(T('Cambiar video'))}</button></div></div>`;
    } else {
      h += `<button type="button" class="bt-drop" data-bt-pick>${I.video}<b>${esc(T('Elegir video'))}</b><span>${esc(T('Hasta 20 segundos · máximo 25 MB'))}</span></button>`;
    }
    h += `<input type="file" id="btFile" accept="video/mp4,video/quicktime,video/webm,video/*" hidden></div>`;
    h += `<ul class="bt-rules">${(acc
      ? ['Al aceptar arranca la votación de 48 horas.', 'Un voto por cuenta. Vos y tu rival no votan.', 'Al terminar, los videos se borran solos.']
      : ['Cualquier rider puede aceptarla subiendo su video.', 'La votación dura 48 horas desde que alguien acepta.', 'Al terminar, los videos se borran solos.', 'Si nadie acepta en 7 días, la batalla se borra.']
    ).map(r => `<li>${esc(T(r))}</li>`).join('')}</ul>`;
    h += `<button type="button" class="bt-main" data-bt-submit ${form.busy ? 'disabled' : ''}>${esc(form.busy ? T(form.busy) : T(acc ? 'Aceptar y subir video' : 'Publicar batalla'))}</button>`;

    el.setAttribute('aria-label', title);
    el.innerHTML = `<div class="bt-hd"><h2>${esc(title)}</h2><button type="button" class="bt-ic" data-bt-fclose aria-label="${esc(T('Cerrar'))}">${I.close}</button></div>
      <div class="bt-body"><div class="bt-in" style="gap:20px">${h}</div></div>`;
    el.classList.add('open');
    lockScroll();
  }
  async function openCreate(){
    css();
    if(!(await canPlay())) return;
    form = { mode: 'create', battle: null, disc: myDisc() || (activeDisc !== 'all' ? activeDisc : 'skate'), file: null, url: '', dur: 0, busy: '', prompt: '' };
    paintForm();
  }
  async function openAccept(){
    const b = current;
    if(!b) return;
    if(!(await canPlay())) return;
    stopVideos();
    form = { mode: 'accept', battle: b, disc: b.discipline, file: null, url: '', dur: 0, busy: '', prompt: '' };
    paintForm();
  }
  function readDuration(url){
    return new Promise(resolve => {
      const v = document.createElement('video');
      let done = false;
      const end = x => { if(done) return; done = true; try { v.removeAttribute('src'); v.load(); } catch(e){} resolve(x); };
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.onloadedmetadata = () => end(isFinite(v.duration) ? v.duration : 0);
      v.onerror = () => end(-1);
      setTimeout(() => end(-1), 8000);
      v.src = url;
    });
  }
  async function onFile(file){
    if(!form || !file) return;
    if(!TYPES[file.type]){ toast(T('Ese archivo no sirve. Elegí un video MP4 o MOV.')); return; }
    if(file.size > MAX_BYTES){ toast(T('El video pesa más de 25 MB. Elegí uno más corto.')); return; }
    const url = URL.createObjectURL(file);
    const dur = await readDuration(url);
    if(!form){ try { URL.revokeObjectURL(url); } catch(e){} return; }
    if(dur < 0 || dur === 0){ try { URL.revokeObjectURL(url); } catch(e){} toast(T('No pudimos leer el video. Probá con otro.')); return; }
    if(dur > MAX_SEC + 0.6){ try { URL.revokeObjectURL(url); } catch(e){} toast(T('El video dura más de 20 segundos. Recortalo y probá de nuevo.')); return; }
    if(form.url){ try { URL.revokeObjectURL(form.url); } catch(e){} }
    form.file = file; form.url = url; form.dur = dur;
    paintForm();
  }
  async function submit(){
    if(!form || form.busy) return;
    const f = form;
    const acc = f.mode === 'accept';
    let prompt = '';
    if(!acc){
      const inp = document.getElementById('btPrompt');
      prompt = (inp ? inp.value : '').replace(/\s+/g, ' ').trim();
      f.prompt = prompt;
      if(prompt.length < 3){ toast(T('Escribí la consigna (3 letras o más).')); if(inp) inp.focus(); return; }
    }
    if(!f.file){ toast(T('Elegí tu video.')); return; }
    const c = await db();
    await loadUid();
    if(!c || !uid){ toast(T('Iniciá sesión para participar en batallas.')); return; }

    f.busy = 'Subiendo video...';
    paintForm();
    const fail = msg => { if(form === f){ f.busy = ''; paintForm(); } toast(msg); };

    const path = uid + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + TYPES[f.file.type];
    let up;
    try { up = await c.storage.from(BUCKET).upload(path, f.file, { contentType: f.file.type, cacheControl: '3600', upsert: false }); }
    catch(e){ up = { error: { message: '' } }; }
    if(up.error){ fail(T('No se pudo subir el video. Revisá tu conexión y probá de nuevo.')); return; }

    if(form === f){ f.busy = 'Publicando...'; paintForm(); }
    const res = acc
      ? await rpc('battle_accept', { p_id: f.battle.id, p_video: path })
      : await rpc('battle_create', { p_discipline: f.disc, p_prompt: prompt, p_video: path });
    if(res.error){ fail(errText(res.error, acc ? 'No se pudo aceptar la batalla. Probá de nuevo.' : 'No se pudo publicar la batalla. Probá de nuevo.')); if(acc) reloadCurrent(); return; }

    const newId = acc ? f.battle.id : res.data;
    closeForm();
    toast(T(acc ? 'Batalla aceptada. Ya se puede votar.' : 'Batalla publicada. Falta que alguien la acepte.'));
    await refresh();
    if(acc) reloadCurrent();
    else if(newId) openById(newId, true);
  }

  /* ---------- dónde estoy ---------- */
  function battlesTabActive(){
    const v = document.querySelector('.view.active[data-view="events"]');
    const tabs = document.getElementById('eventsTabs');
    if(!v || !tabs || tabs.style.display === 'none') return false;
    return !!tabs.querySelector('button.active[data-ev-tab="battles"]');
  }
  function goToTab(){
    if(window.setRoute) window.setRoute('events');
    const tab = document.querySelector('#eventsTabs [data-ev-tab="battles"]');
    if(tab && !tab.classList.contains('active')) tab.click();
  }

  /* ---------- clicks ---------- */
  /* El "+" de la pantalla crea una batalla cuando la pestaña Batallas está abierta. */
  document.addEventListener('click', e => {
    const plus = e.target.closest && e.target.closest('[data-open-modal="menu"]');
    if(!plus || !battlesTabActive()) return;
    e.preventDefault();
    e.stopPropagation();
    openCreate();
  }, true);

  document.addEventListener('click', e => {
    const t = e.target;
    if(!t || !t.closest) return;
    let el;
    if((el = t.closest('[data-bt-disc]'))){ activeDisc = el.dataset.btDisc; paint(); return; }
    if(t.closest('[data-bt-reload]')){ render(wrapEl); return; }
    if(t.closest('[data-bt-create]')){ openCreate(); return; }
    if(t.closest('[data-bt-ranking]')){ openRanking(); return; }
    if((el = t.closest('[data-bt-rank]'))){ rankDisc = el.dataset.btRank; openRanking(); return; }
    if((el = t.closest('[data-bt-open]'))){ openById(el.dataset.btOpen); return; }
    if(t.closest('[data-bt-close]')){ closeMain(); return; }
    if(t.closest('[data-bt-fclose]')){ if(form && form.busy) return; closeForm(); return; }
    if(t.closest('[data-bt-share]')){ share(); return; }
    if((el = t.closest('[data-bt-vote]'))){ vote(el.dataset.btVote, el); return; }
    if((el = t.closest('[data-bt-cancel]'))){ cancelBattle(el); return; }
    if(t.closest('[data-bt-accept]')){ openAccept(); return; }
    if((el = t.closest('[data-bt-fdisc]'))){ if(form && !form.busy){ const inp = document.getElementById('btPrompt'); if(inp) form.prompt = inp.value; form.disc = el.dataset.btFdisc; paintForm(); } return; }
    if(t.closest('[data-bt-pick]')){ const inp = document.getElementById('btFile'); if(inp && form && !form.busy){ inp.value = ''; inp.click(); } return; }
    if(t.closest('[data-bt-submit]')){ submit(); return; }
    if((el = t.closest('[data-bt-rider]'))){
      const id = el.dataset.btRider;
      if(id && window.SpotraRiders && window.SpotraRiders.open){ closeMain(); window.SpotraRiders.open(id); }
      return;
    }
  });
  document.addEventListener('change', e => {
    const inp = e.target;
    if(inp && inp.id === 'btFile' && inp.files && inp.files[0]){
      const keep = document.getElementById('btPrompt');
      if(form && keep) form.prompt = keep.value;
      onFile(inp.files[0]);
    }
  });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(document.querySelector('.modal-bg.open')) return;
    if(form){ if(!form.busy) closeForm(); return; }
    if(view) closeMain();
  });
  window.addEventListener('spotra-lang', () => {
    if(wrapEl && wrapEl.isConnected && battlesTabActive()) paint();
    if(view === 'detail' && current) paintDetailKeepVideos();
  });

  /* Link compartido: /?battle=ID#events */
  function boot(){
    if(!deep) return;
    setTimeout(() => {
      if(!deep) return;
      goToTab();
      setTimeout(() => { if(deep){ const id = deep; deep = null; try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){} openById(id, true); } }, 1500);
    }, 900);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.SpotraBattles = {
    render,
    openById: id => { goToTab(); return openById(id); },
    openCreate,
    openRanking
  };
})();
