/* SPOTRA · Guía de bienvenida con SPOTRI (v3)
   - v3: en el iPhone instalado el botón seguía estirado: estilo con prioridad máxima + control que lo corrige al dibujar.
   - v2: botones con alto fijo (en el iPhone instalado se estiraban), contenido centrado en pantallas altas, logo sin tapar a SPOTRI.
   - La ven una sola vez las cuentas nuevas y las que ya existían (después de esta actualización).
   - "Guía vista" se guarda en la cuenta (Supabase Auth, user_metadata.spotri_guide) y en el teléfono,
     así no reaparece en otro dispositivo. No usa tablas ni SQL.
   - 8 pantallas deslizables; "Saltar" siempre visible; se vuelve a ver desde Configuración › Guía de SPOTRI.
   - El paso "Instalar" se salta solo si la app ya está instalada.
   - Avisos: usa SpotraPush.enable(). Ubicación: usa el permiso del navegador (spotra-geo.js muestra la ayuda si está bloqueado).
   - Responsive: celular a pantalla completa (respeta notch y barra de gestos); tablet y computadora: tarjeta centrada.
   - Textos en español, português e english según el idioma de la app. Sin datos de usuarios en el HTML. */
(function(){
  if(window.SpotraGuide) return;

  const IMG = 'assets/Spotri/'; // carpeta con S mayúscula en el repo
  const LOGO = 'assets/logo/spotra-brush.webp';
  const META_KEY = 'spotri_guide';
  const LS_PREFIX = 'spotra_guide_seen_';

  /* ---------- textos ---------- */
  const TX = {
    es: {
      dialog: 'Guía de SPOTRI', settings: 'Guía de SPOTRI',
      skip: 'Saltar', start: 'Empezar', next: 'Siguiente', back: 'Atrás', goMap: 'Ir al mapa', step: 'Paso {n} de {t}',
      hello: '¡Hola, rider!', welcomeKick: 'BIENVENIDO A SPOTRA', welcomeTitle: 'Soy <em>Spotri.</em>',
      welcomeText: 'Tu guía en SPOTRA. En un minuto te muestro cómo funciona la app y la dejamos lista para rodar.',
      whatKick: 'SPOTRI / TU GUÍA', whatTitle: 'El mapa de<br>los <em>riders.</em>',
      whatText: 'SPOTRA conecta a riders de toda Latinoamérica: spots, sesiones, eventos y comunidad en una sola app. Hecha por la comunidad, para la comunidad.',
      disc: ['SKATE', 'BMX', 'ROLLERS', 'SCOOTER'],
      mapKick: 'MAPA', mapTitle: 'Encuentra<br>tu <em>spot.</em>', addSpot: '+ AGREGAR SPOT',
      mapList: ['Spots, skateparks y tiendas cerca de ti, con fotos y cómo llegar.', 'Estado en vivo y clima: mojado, cerrado o listo para rodar.', '¿Falta tu spot? Agrégalo con el botón +.'],
      sesKick: 'SESIONES Y EVENTOS', sesTitle: 'Arma la<br><em>sesión.</em>',
      sesList: ['Publica cuándo y dónde vas a rodar; otros riders se suman.', 'Avisamos a tus seguidores y a los riders cerca.', 'Eventos y competencias con inscripción y ranking.'],
      cardSes: 'SESIÓN · HOY', cardDisc: 'Skate', cardSpot: 'Skatepark Salinas', cardTime: '18:00 a 20:00 · Bowl y street', cardJoin: '3 riders se suman', cardBtn: 'ME SUMO',
      cardEvKick: 'EVENTO · SÁBADO', cardEv: 'Jam de BMX y skate', cardEvSub: 'Inscripción abierta · Ranking', cardNotif: 'Agustín va a rodar hoy en Salinas',
      comKick: 'COMUNIDAD', comTitle: 'Tu crew.<br><em>Tu escena.</em>',
      com: [['Foro', 'Publica fotos y clips, da me gusta y comenta.'], ['Market', 'Compra y vende usados entre riders, por WhatsApp.'], ['Perfil', 'Tu disciplina, tus redes y tus seguidores.']],
      insKick: 'INSTALAR', insTitle: 'Lleva SPOTRA<br>en tu <em>inicio.</em>', insBubble: 'Ponme en tu pantalla de inicio y me abres como una app.',
      tabsLabel: 'Tu dispositivo', tabIos: 'iPhone', tabAnd: 'Android', tabPc: 'Computadora',
      ios: ['Abre SPOTRA en <b>Safari</b>.', 'Toca <b>Compartir</b> {share}', 'Elige <b>“Agregar a inicio”</b> y toca Agregar.'],
      and: ['Abre SPOTRA en <b>Chrome</b>.', 'Toca el menú <b>⋮</b> arriba a la derecha.', 'Elige <b>“Instalar app”</b> o <b>“Agregar a la pantalla principal”</b>.'],
      pc: ['Abre SPOTRA en <b>Chrome</b> o <b>Edge</b>.', 'Haz clic en el ícono de <b>instalar</b> de la barra de direcciones.', 'Confirma con <b>“Instalar”</b>. En Safari de Mac: <b>Archivo › Agregar al Dock</b>.'],
      installNow: 'Instalar ahora', insNote: 'Si ya la tienes instalada, este paso no aparece.',
      avKick: 'AVISOS Y UBICACIÓN', avTitle: 'Que no te<br>pierdas<br><em>nada.</em>',
      pushT: 'Avisos', pushD: 'Sesiones cerca, eventos, me gusta y comentarios.', pushBtn: 'Activar avisos', pushOn: 'Avisos activados', pushWait: 'Activando...',
      pushIos: 'En iPhone funcionan con SPOTRA instalada en el inicio.', pushIosBtn: 'Ver cómo instalar',
      pushDenied: 'Bloqueaste los avisos. Puedes habilitarlos desde los ajustes del navegador para SPOTRA.', pushNo: 'Este navegador no admite avisos.',
      geoT: 'Ubicación', geoD: 'El mapa arranca en tu zona y ves los spots más cerca.', geoBtn: 'Activar ubicación', geoOn: 'Ubicación activada', geoWait: 'Buscando...',
      geoFail: 'No pudimos activarla. Revisa los permisos de ubicación.', geoNo: 'Este dispositivo no permite ubicación.',
      youDecide: 'Tú decides. Puedes cambiarlo cuando quieras en Configuración.',
      byeBubble: '¡Nos vemos<br>en el spot!', byeKick: 'TODO LISTO', byeTitle: 'A <em>rodar.</em>',
      byeText: 'Puedes volver a ver esta guía cuando quieras en Configuración › Guía de SPOTRI.',
      altHello: 'SPOTRI saludando con su skate', altStand: 'SPOTRI parado sobre su skate', altRide: 'SPOTRI rodando', altMap: 'Mapa de SPOTRA con spots y skateparks', altForum: 'Foro de SPOTRA', altShare: 'ícono Compartir'
    },
    pt: {
      dialog: 'Guia do SPOTRI', settings: 'Guia do SPOTRI',
      skip: 'Pular', start: 'Começar', next: 'Próximo', back: 'Voltar', goMap: 'Ir para o mapa', step: 'Passo {n} de {t}',
      hello: 'Fala, rider!', welcomeKick: 'BEM-VINDO AO SPOTRA', welcomeTitle: 'Sou o <em>Spotri.</em>',
      welcomeText: 'Seu guia no SPOTRA. Em um minuto te mostro como o app funciona e deixamos tudo pronto pra andar.',
      whatKick: 'SPOTRI / SEU GUIA', whatTitle: 'O mapa dos<br><em>riders.</em>',
      whatText: 'O SPOTRA conecta riders de toda a América Latina: spots, sessões, eventos e comunidade em um só app. Feito pela comunidade, para a comunidade.',
      disc: ['SKATE', 'BMX', 'PATINS', 'PATINETE'],
      mapKick: 'MAPA', mapTitle: 'Encontre<br>seu <em>spot.</em>', addSpot: '+ ADICIONAR SPOT',
      mapList: ['Spots, pistas e lojas perto de você, com fotos e como chegar.', 'Status ao vivo e clima: molhado, fechado ou pronto pra andar.', 'Falta o seu spot? Adicione pelo botão +.'],
      sesKick: 'SESSÕES E EVENTOS', sesTitle: 'Marque a<br><em>sessão.</em>',
      sesList: ['Publique quando e onde você vai andar; outros riders se juntam.', 'Avisamos seus seguidores e os riders por perto.', 'Eventos e campeonatos com inscrição e ranking.'],
      cardSes: 'SESSÃO · HOJE', cardDisc: 'Skate', cardSpot: 'Skatepark Salinas', cardTime: '18:00 às 20:00 · Bowl e street', cardJoin: '3 riders vão', cardBtn: 'EU VOU',
      cardEvKick: 'EVENTO · SÁBADO', cardEv: 'Jam de BMX e skate', cardEvSub: 'Inscrições abertas · Ranking', cardNotif: 'Agustín vai andar hoje em Salinas',
      comKick: 'COMUNIDADE', comTitle: 'Seu crew.<br><em>Sua cena.</em>',
      com: [['Fórum', 'Poste fotos e clipes, curta e comente.'], ['Market', 'Compre e venda usados entre riders, pelo WhatsApp.'], ['Perfil', 'Sua modalidade, suas redes e seus seguidores.']],
      insKick: 'INSTALAR', insTitle: 'Leve o SPOTRA<br>pra sua <em>tela.</em>', insBubble: 'Me coloca na tela de início e me abre como um app.',
      tabsLabel: 'Seu dispositivo', tabIos: 'iPhone', tabAnd: 'Android', tabPc: 'Computador',
      ios: ['Abra o SPOTRA no <b>Safari</b>.', 'Toque em <b>Compartilhar</b> {share}', 'Escolha <b>“Adicionar à Tela de Início”</b> e toque em Adicionar.'],
      and: ['Abra o SPOTRA no <b>Chrome</b>.', 'Toque no menu <b>⋮</b> no canto superior direito.', 'Escolha <b>“Instalar app”</b> ou <b>“Adicionar à tela inicial”</b>.'],
      pc: ['Abra o SPOTRA no <b>Chrome</b> ou <b>Edge</b>.', 'Clique no ícone de <b>instalar</b> na barra de endereço.', 'Confirme em <b>“Instalar”</b>. No Safari do Mac: <b>Arquivo › Adicionar ao Dock</b>.'],
      installNow: 'Instalar agora', insNote: 'Se você já instalou, este passo não aparece.',
      avKick: 'AVISOS E LOCALIZAÇÃO', avTitle: 'Não perca<br><em>nada.</em>',
      pushT: 'Avisos', pushD: 'Sessões por perto, eventos, curtidas e comentários.', pushBtn: 'Ativar avisos', pushOn: 'Avisos ativados', pushWait: 'Ativando...',
      pushIos: 'No iPhone funcionam com o SPOTRA instalado na tela de início.', pushIosBtn: 'Ver como instalar',
      pushDenied: 'Você bloqueou os avisos. Dá pra liberar nas configurações do navegador para o SPOTRA.', pushNo: 'Este navegador não aceita avisos.',
      geoT: 'Localização', geoD: 'O mapa começa na sua região e você vê os spots mais perto.', geoBtn: 'Ativar localização', geoOn: 'Localização ativada', geoWait: 'Buscando...',
      geoFail: 'Não deu pra ativar. Confira as permissões de localização.', geoNo: 'Este dispositivo não permite localização.',
      youDecide: 'Você decide. Pode mudar quando quiser em Configurações.',
      byeBubble: 'Nos vemos<br>no spot!', byeKick: 'TUDO PRONTO', byeTitle: 'Bora <em>andar.</em>',
      byeText: 'Você pode rever este guia quando quiser em Configurações › Guia do SPOTRI.',
      altHello: 'SPOTRI acenando com o skate', altStand: 'SPOTRI em cima do skate', altRide: 'SPOTRI andando de skate', altMap: 'Mapa do SPOTRA com spots e pistas', altForum: 'Fórum do SPOTRA', altShare: 'ícone Compartilhar'
    },
    en: {
      dialog: 'SPOTRI guide', settings: 'SPOTRI guide',
      skip: 'Skip', start: 'Start', next: 'Next', back: 'Back', goMap: 'Go to the map', step: 'Step {n} of {t}',
      hello: 'Hey, rider!', welcomeKick: 'WELCOME TO SPOTRA', welcomeTitle: 'I’m <em>Spotri.</em>',
      welcomeText: 'Your guide in SPOTRA. In one minute I’ll show you how the app works and get it ready to ride.',
      whatKick: 'SPOTRI / YOUR GUIDE', whatTitle: 'The riders’<br><em>map.</em>',
      whatText: 'SPOTRA connects riders across Latin America: spots, sessions, events and community in one app. Made by the community, for the community.',
      disc: ['SKATE', 'BMX', 'ROLLERS', 'SCOOTER'],
      mapKick: 'MAP', mapTitle: 'Find<br>your <em>spot.</em>', addSpot: '+ ADD SPOT',
      mapList: ['Spots, skateparks and shops near you, with photos and directions.', 'Live status and weather: wet, closed or ready to ride.', 'Missing your spot? Add it with the + button.'],
      sesKick: 'SESSIONS AND EVENTS', sesTitle: 'Set up the<br><em>session.</em>',
      sesList: ['Post when and where you’ll ride; other riders join in.', 'We notify your followers and riders nearby.', 'Events and contests with sign-up and rankings.'],
      cardSes: 'SESSION · TODAY', cardDisc: 'Skate', cardSpot: 'Skatepark Salinas', cardTime: '6:00 to 8:00 pm · Bowl and street', cardJoin: '3 riders joining', cardBtn: 'I’M IN',
      cardEvKick: 'EVENT · SATURDAY', cardEv: 'BMX and skate jam', cardEvSub: 'Sign-up open · Rankings', cardNotif: 'Agustín is riding Salinas today',
      comKick: 'COMMUNITY', comTitle: 'Your crew.<br><em>Your scene.</em>',
      com: [['Forum', 'Post photos and clips, like and comment.'], ['Market', 'Buy and sell used gear between riders, via WhatsApp.'], ['Profile', 'Your discipline, your socials and your followers.']],
      insKick: 'INSTALL', insTitle: 'Put SPOTRA<br>on your <em>home.</em>', insBubble: 'Add me to your home screen and open me like an app.',
      tabsLabel: 'Your device', tabIos: 'iPhone', tabAnd: 'Android', tabPc: 'Computer',
      ios: ['Open SPOTRA in <b>Safari</b>.', 'Tap <b>Share</b> {share}', 'Choose <b>“Add to Home Screen”</b> and tap Add.'],
      and: ['Open SPOTRA in <b>Chrome</b>.', 'Tap the <b>⋮</b> menu at the top right.', 'Choose <b>“Install app”</b> or <b>“Add to Home screen”</b>.'],
      pc: ['Open SPOTRA in <b>Chrome</b> or <b>Edge</b>.', 'Click the <b>install</b> icon in the address bar.', 'Confirm with <b>“Install”</b>. In Safari on Mac: <b>File › Add to Dock</b>.'],
      installNow: 'Install now', insNote: 'If it’s already installed, this step is skipped.',
      avKick: 'ALERTS AND LOCATION', avTitle: 'Don’t miss<br><em>a thing.</em>',
      pushT: 'Alerts', pushD: 'Sessions nearby, events, likes and comments.', pushBtn: 'Turn on alerts', pushOn: 'Alerts on', pushWait: 'Turning on...',
      pushIos: 'On iPhone they work with SPOTRA installed on your home screen.', pushIosBtn: 'See how to install',
      pushDenied: 'You blocked alerts. You can allow them in your browser settings for SPOTRA.', pushNo: 'This browser doesn’t support alerts.',
      geoT: 'Location', geoD: 'The map starts in your area and shows the closest spots.', geoBtn: 'Turn on location', geoOn: 'Location on', geoWait: 'Locating...',
      geoFail: 'We couldn’t turn it on. Check your location permissions.', geoNo: 'This device doesn’t allow location.',
      youDecide: 'Your call. You can change it anytime in Settings.',
      byeBubble: 'See you<br>at the spot!', byeKick: 'ALL SET', byeTitle: 'Let’s <em>ride.</em>',
      byeText: 'You can see this guide again anytime in Settings › SPOTRI guide.',
      altHello: 'SPOTRI waving with his skateboard', altStand: 'SPOTRI standing on his skateboard', altRide: 'SPOTRI riding', altMap: 'SPOTRA map with spots and skateparks', altForum: 'SPOTRA forum', altShare: 'Share icon'
    }
  };
  function lang(){
    const l = window.SpotraI18n && window.SpotraI18n.lang ? window.SpotraI18n.lang() : 'es';
    return TX[l] ? l : 'es';
  }
  function T(){ return TX[lang()]; }

  /* ---------- entorno ---------- */
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  function isStandalone(){
    try { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
    catch(e){ return false; }
  }
  const reduceMotion = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; } })();

  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if(state.open && current().id === 'install') render(0); });

  /* ---------- íconos ---------- */
  const ICON = {
    check: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    forum: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 4V5Z"/></svg>',
    bag: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    user: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    bell: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    pin: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    share: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>',
    guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/></svg>'
  };

  /* ---------- estilos ---------- */
  const CSS = `
#spotriGuide{position:fixed;inset:0;z-index:9000;display:none;background:#070907;color:#f5f7f4;font-family:var(--body,'General Sans',sans-serif);-webkit-text-size-adjust:100%}
#spotriGuide.open{display:flex}
body.spotri-open{overflow:hidden}
body.spotri-open .toast-zone{z-index:9100}
body.spotri-open .geo-help{z-index:9200}
#spotriGuide *{box-sizing:border-box}
.sg-card{position:relative;display:flex;flex-direction:column;width:100%;height:100%;background:#070907;overflow:hidden;outline:none}
.sg-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;min-height:48px;padding:max(10px,env(safe-area-inset-top)) max(22px,env(safe-area-inset-right)) 0 max(22px,env(safe-area-inset-left))}
.sg-dots{display:flex;gap:6px;align-items:center}
.sg-dots span{width:6px;height:6px;border-radius:3px;background:#2a332b;transition:width .25s,background .25s}
.sg-dots span.done{background:#4a5a4b}
.sg-dots span.on{width:22px;background:#74ff3a}
.sg-skip{background:none;border:0;color:#9aa39a;font:600 15px var(--body,'General Sans',sans-serif);padding:12px 0 12px 16px;min-height:44px;cursor:pointer}
.sg-skip:hover{color:#f5f7f4}
.sg-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:6px max(22px,env(safe-area-inset-right)) 12px max(22px,env(safe-area-inset-left));touch-action:pan-y}
.sg-slide{display:flex;flex-direction:column;justify-content:center;min-height:100%}
.sg-slide.in-next{animation:sgInNext .32s ease both}
.sg-slide.in-prev{animation:sgInPrev .32s ease both}
@keyframes sgInNext{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes sgInPrev{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}
.sg-bottom{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:10px max(22px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(22px,env(safe-area-inset-left));background:linear-gradient(to bottom,rgba(7,9,7,0),#070907 18px)}
.sg-btn{box-sizing:border-box;height:56px;min-height:56px;max-height:56px;padding:0 16px;margin:0;display:flex;align-items:center;justify-content:center;line-height:1;-webkit-appearance:none;appearance:none;align-self:center;border-radius:16px;font:700 16px var(--body,'General Sans',sans-serif);cursor:pointer;-webkit-tap-highlight-color:transparent}
.sg-btn.back{width:96px;flex:0 0 96px;border:1px solid #2a332b;background:transparent;color:#f5f7f4}
.sg-btn.main{flex:1 1 auto;min-width:0;border:0;background:#74ff3a;color:#051006;font:600 17px var(--display,'Clash Display',sans-serif);letter-spacing:.05em;text-transform:uppercase;box-shadow:0 0 24px rgba(116,255,58,.25)}
.sg-btn:active{transform:scale(.98)}
.sg-btn:focus-visible,.sg-skip:focus-visible,.sg-tab:focus-visible,.sg-act:focus-visible{outline:2px solid #74ff3a;outline-offset:2px}
.sg-art{position:relative;flex-shrink:0;height:clamp(170px,44vh,420px);height:clamp(170px,44svh,420px);margin-top:4px}
.sg-text{display:flex;flex-direction:column;gap:10px;margin-top:20px}
.sg-kick{margin:0;font:600 12px var(--body,'General Sans',sans-serif);letter-spacing:.16em;color:#74ff3a;text-transform:uppercase}
.sg-h{margin:0;font:700 clamp(32px,10vw,42px)/.96 var(--display,'Clash Display',sans-serif);text-transform:uppercase;letter-spacing:-.005em;color:#f5f7f4}
.sg-h.big{font-size:clamp(40px,12.5vw,54px);line-height:.92}
.sg-h em,.sg-hl{font-style:normal;color:#74ff3a}
.sg-p{margin:4px 0 0;font:500 16px/1.45 var(--body,'General Sans',sans-serif);color:#c9d1c8}
.sg-bubble{position:absolute;z-index:2;background:#f5f7f4;color:#070907;font:600 16px/1.15 var(--display,'Clash Display',sans-serif);text-transform:uppercase;letter-spacing:.02em;padding:12px 16px;border-radius:18px 18px 18px 4px}
.sg-bubble.r{border-radius:18px 18px 4px 18px}
.sg-char{position:absolute;bottom:0;display:block;width:auto;max-width:none;user-select:none;-webkit-user-drag:none;pointer-events:none}
.sg-ring{position:absolute;left:50%;bottom:0;width:min(300px,70vw);aspect-ratio:1;transform:translateX(-50%);border-radius:50%;border:1px solid rgba(116,255,58,.18)}
.sg-list{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.sg-list li{display:flex;gap:10px;align-items:flex-start;font:500 15px/1.4 var(--body,'General Sans',sans-serif);color:#c9d1c8}
.sg-list li svg{width:18px;height:18px;flex-shrink:0;margin-top:2px;color:#74ff3a}
.sg-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.sg-chips span{border:1px solid #2a332b;border-radius:999px;padding:7px 12px;font:600 12px var(--body,'General Sans',sans-serif);letter-spacing:.1em}
.sg-phone{position:absolute;top:0;left:6px;height:96%;aspect-ratio:184/372;border-radius:28px;border:6px solid #1a201b;overflow:hidden;background:#0d110e}
.sg-phone img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.sg-pill{position:absolute;top:10%;right:0;z-index:2;background:#74ff3a;color:#051006;font:600 12px var(--body,'General Sans',sans-serif);letter-spacing:.05em;padding:8px 10px;border-radius:12px}
.sg-panel{background:#101612;border:1px solid #1f2720;border-radius:18px}
.sg-ses{display:flex;flex-direction:column;gap:10px}
.sg-ses .sg-panel{padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.sg-ses .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.sg-ses .k{font:600 11px var(--body,'General Sans',sans-serif);letter-spacing:.14em;color:#74ff3a}
.sg-ses .m{font:500 12px var(--body,'General Sans',sans-serif);color:#9aa39a}
.sg-ses .t{font:600 19px/1.1 var(--display,'Clash Display',sans-serif)}
.sg-ses .s{font:500 13px var(--body,'General Sans',sans-serif);color:#c9d1c8}
.sg-ses .b{background:#74ff3a;color:#051006;font:600 12px var(--body,'General Sans',sans-serif);letter-spacing:.06em;padding:8px 12px;border-radius:10px;white-space:nowrap}
.sg-ses .lower{display:flex;gap:10px;align-items:flex-end}
.sg-ses .lower img{height:clamp(130px,24vh,200px);width:auto;flex-shrink:0;margin-left:-6px}
.sg-ses .col{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.sg-notif{display:flex;align-items:center;gap:8px;background:#f5f7f4;color:#070907;border-radius:14px;padding:10px 12px;font:600 12px/1.3 var(--body,'General Sans',sans-serif)}
.sg-notif svg{width:18px;height:18px;flex-shrink:0}
.sg-rows{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.sg-rows .sg-panel{display:flex;gap:12px;align-items:center;padding:12px 14px}
.sg-rows svg{width:22px;height:22px;flex-shrink:0;color:#74ff3a}
.sg-rows b{display:block;font:600 15px var(--display,'Clash Display',sans-serif);letter-spacing:.02em}
.sg-rows small{display:block;font:500 13px/1.35 var(--body,'General Sans',sans-serif);color:#c9d1c8}
.sg-hello{display:flex;align-items:flex-end;gap:6px;height:clamp(140px,26vh,210px)}
.sg-hello img{height:100%;width:auto;flex-shrink:0}
.sg-hello .sg-bubble{position:relative;align-self:flex-start;margin-top:4%;min-width:0;text-transform:none;font:600 15px/1.3 var(--body,'General Sans',sans-serif)}
.sg-tabs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;background:#101612;border:1px solid #1f2720;border-radius:14px;padding:4px;margin-top:16px}
.sg-tab{min-height:40px;border:0;border-radius:10px;background:transparent;color:#9aa39a;font:600 14px var(--body,'General Sans',sans-serif);cursor:pointer}
.sg-tab[aria-selected="true"]{background:#f5f7f4;color:#070907}
.sg-steps{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.sg-steps li{display:flex;gap:12px;align-items:center;font:500 15px/1.35 var(--body,'General Sans',sans-serif);color:#c9d1c8}
.sg-steps li b{color:#f5f7f4;font-weight:600}
.sg-steps .n{width:30px;height:30px;border-radius:50%;background:#74ff3a;color:#051006;font:600 14px var(--display,'Clash Display',sans-serif);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sg-steps svg{width:20px;height:20px;vertical-align:-4px;color:#f5f7f4;margin-left:4px}
.sg-note{margin:12px 0 0;font:500 12px/1.4 var(--body,'General Sans',sans-serif);color:#9aa39a}
.sg-head{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;height:clamp(150px,26vh,210px)}
.sg-head .sg-text{margin:0;padding-bottom:8px;flex:1;min-width:0}
.sg-head .sg-h{font-size:clamp(30px,9vw,38px)}
.sg-head img{height:90%;width:auto;flex-shrink:0;margin-right:-10px}
.sg-perm{display:flex;flex-direction:column;gap:12px;margin-top:18px}
.sg-perm .sg-panel{padding:16px;display:flex;flex-direction:column;gap:10px;border-radius:20px}
.sg-perm .hd{display:flex;gap:12px;align-items:center}
.sg-perm .ic{width:40px;height:40px;border-radius:12px;background:rgba(116,255,58,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#74ff3a}
.sg-perm .ic svg{width:22px;height:22px}
.sg-perm b{display:block;font:600 16px var(--display,'Clash Display',sans-serif);letter-spacing:.02em}
.sg-perm small{display:block;font:500 13px/1.35 var(--body,'General Sans',sans-serif);color:#c9d1c8}
.sg-act{min-height:46px;border-radius:12px;font:600 14px var(--body,'General Sans',sans-serif);letter-spacing:.05em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;border:0;background:#74ff3a;color:#051006}
.sg-act.ghost{background:transparent;color:#74ff3a;border:1px solid #74ff3a}
.sg-act.ok{background:rgba(116,255,58,.12);color:#74ff3a;border:1px solid rgba(116,255,58,.35);cursor:default}
.sg-act.off{background:#1a201b;color:#9aa39a;border:1px solid #2a332b;cursor:default}
.sg-act svg{width:18px;height:18px}
.sg-act[disabled]{opacity:1}
.sg-line{position:absolute;left:0;right:0;bottom:7%;height:4px;border-radius:2px;background:#74ff3a}
.sg-logo{position:absolute;top:0;left:0;width:min(118px,30vw);height:auto;opacity:.95}
.sg-floor{position:absolute;left:0;right:0;bottom:0;height:1px;background:rgba(116,255,58,.25)}
.sg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#spotriGuide .sg-btn{box-sizing:border-box!important;height:56px!important;min-height:56px!important;max-height:56px!important;padding:0 16px!important;margin:0!important;display:block!important;line-height:56px!important;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
@media (max-height:700px){
  #spotriGuide .sg-btn{height:52px!important;min-height:52px!important;max-height:52px!important;line-height:52px!important}
  .sg-art{height:clamp(150px,36vh,300px);height:clamp(150px,36svh,300px)}
  .sg-text{margin-top:14px;gap:8px}
  .sg-p{font-size:15px}
  .sg-list li,.sg-steps li{font-size:14px}
  .sg-hide-short{display:none!important}
  .sg-art.sm{height:clamp(130px,26vh,200px)!important;height:clamp(130px,26svh,200px)!important}
  .sg-btn{height:52px;min-height:52px;max-height:52px}
}
@media (max-height:480px){
  .sg-art{height:150px}
  .sg-hello,.sg-head{height:130px}
}
@media (min-width:768px) and (min-height:620px){
  #spotriGuide{background:rgba(3,5,3,.78);align-items:center;justify-content:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .sg-card{width:440px;height:min(880px,calc(100vh - 48px));border-radius:28px;border:1px solid rgba(116,255,58,.25);box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .sg-top{padding:14px 26px 0}
  .sg-body{padding:6px 26px 12px}
  .sg-bottom{padding:10px 26px 22px}
  .sg-art{height:clamp(200px,40vh,400px)}
}
@media (prefers-reduced-motion:reduce){.sg-slide.in-next,.sg-slide.in-prev{animation:none}.sg-dots span{transition:none}}
`;

  /* ---------- pantallas ---------- */
  function img(src, alt, cls, style){ return `<img class="${cls || ''}" src="${IMG + src}" alt="${alt}" style="${style || ''}" draggable="false">`; }
  function list(items){ return `<ul class="sg-list">${items.map(s => `<li>${ICON.check}<span>${s}</span></li>`).join('')}</ul>`; }
  function kick(t, n){ return `<p class="sg-kick">${n ? String(n).padStart(2, '0') + ' / ' : ''}${t}</p>`; }

  const SLIDES = [
    { id: 'welcome', html: (t) => `
      <div class="sg-art">
        <div class="sg-ring" aria-hidden="true"></div>
        ${img('spotri-hola.webp', t.altHello, 'sg-char', 'left:50%;transform:translateX(-50%);height:100%')}
        <div class="sg-bubble" style="top:6%;left:0">${t.hello}</div>
      </div>
      <div class="sg-text">
        <p class="sg-kick">${t.welcomeKick}</p>
        <h1 class="sg-h big" id="sgTitle">${t.welcomeTitle}</h1>
        <p class="sg-p">${t.welcomeText}</p>
      </div>` },
    { id: 'what', html: (t) => `
      <div class="sg-art">
        <img class="sg-logo" src="${LOGO}" alt="SPOTRA" draggable="false">
        ${img('spotri-parado.webp', t.altStand, 'sg-char', 'left:50%;transform:translateX(-50%);height:90%')}
        <div class="sg-floor" aria-hidden="true"></div>
      </div>
      <div class="sg-text">
        <p class="sg-kick">${t.whatKick}</p>
        <h2 class="sg-h" id="sgTitle">${t.whatTitle}</h2>
        <p class="sg-p">${t.whatText}</p>
        <div class="sg-chips">${t.disc.map(d => `<span>${d}</span>`).join('')}</div>
      </div>` },
    { id: 'map', num: true, html: (t, n) => `
      <div class="sg-art">
        <div class="sg-phone">${img('captura-mapa.webp', t.altMap)}</div>
        <div class="sg-pill" aria-hidden="true">${t.addSpot}</div>
        ${img('spotri-rodando-1.webp', t.altRide, 'sg-char', 'right:-4px;height:56%')}
      </div>
      <div class="sg-text">
        ${kick(t.mapKick, n)}
        <h2 class="sg-h" id="sgTitle">${t.mapTitle}</h2>
        ${list(t.mapList)}
      </div>` },
    { id: 'sessions', num: true, html: (t, n) => `
      <div class="sg-ses" aria-hidden="true">
        <div class="sg-panel">
          <div class="row"><span class="k">${t.cardSes}</span><span class="m">${t.cardDisc}</span></div>
          <div class="t">${t.cardSpot}</div>
          <div class="s">${t.cardTime}</div>
          <div class="row" style="margin-top:4px"><span class="m">${t.cardJoin}</span><span class="b">${t.cardBtn}</span></div>
        </div>
        <div class="lower">
          ${img('spotri-rodando-2.webp', '', '')}
          <div class="col">
            <div class="sg-panel" style="padding:12px 14px;display:flex;flex-direction:column;gap:5px">
              <span class="k">${t.cardEvKick}</span>
              <div class="t" style="font-size:17px">${t.cardEv}</div>
              <div class="s" style="font-size:12px">${t.cardEvSub}</div>
            </div>
            <div class="sg-notif sg-hide-short">${ICON.bell}<span>${t.cardNotif}</span></div>
          </div>
        </div>
      </div>
      <div class="sg-text">
        ${kick(t.sesKick, n)}
        <h2 class="sg-h" id="sgTitle">${t.sesTitle}</h2>
        ${list(t.sesList)}
      </div>` },
    { id: 'community', num: true, html: (t, n) => `
      <div class="sg-art sm" style="height:clamp(160px,32vh,270px)">
        <div class="sg-phone" style="height:100%">${img('captura-foro.webp', t.altForum)}</div>
        ${img('spotri-rodando-3.webp', t.altRide, 'sg-char', 'right:0;height:82%')}
      </div>
      <div class="sg-text">
        ${kick(t.comKick, n)}
        <h2 class="sg-h" id="sgTitle">${t.comTitle}</h2>
        <div class="sg-rows">
          ${[ICON.forum, ICON.bag, ICON.user].map((ic, i) => `<div class="sg-panel">${ic}<div><b>${t.com[i][0]}</b><small>${t.com[i][1]}</small></div></div>`).join('')}
        </div>
      </div>` },
    { id: 'install', num: true, skipIf: isStandalone, html: (t, n) => {
      const steps = (state.tab === 'ios' ? t.ios : state.tab === 'and' ? t.and : t.pc)
        .map((s, i) => `<li><span class="n">${i + 1}</span><span>${s.replace('{share}', `<span role="img" aria-label="${t.altShare}">${ICON.share}</span>`)}</span></li>`).join('');
      const tab = (k, label) => `<button type="button" class="sg-tab" role="tab" data-sg-tab="${k}" aria-selected="${state.tab === k}">${label}</button>`;
      return `
      <div class="sg-hello">
        ${img('spotri-hola.webp', t.altHello, '')}
        <div class="sg-bubble">${t.insBubble}</div>
      </div>
      <div class="sg-text" style="margin-top:14px">
        ${kick(t.insKick, n)}
        <h2 class="sg-h" id="sgTitle">${t.insTitle}</h2>
      </div>
      <div class="sg-tabs" role="tablist" aria-label="${t.tabsLabel}">${tab('ios', t.tabIos)}${tab('and', t.tabAnd)}${tab('pc', t.tabPc)}</div>
      <ol class="sg-steps" role="tabpanel">${steps}</ol>
      ${installEvt && state.tab !== 'ios' ? `<button type="button" class="sg-act" data-sg-install style="margin-top:14px">${t.installNow}</button>` : ''}
      <p class="sg-note">${t.insNote}</p>`; } },
    { id: 'alerts', num: true, html: (t, n) => `
      <div class="sg-head">
        <div class="sg-text">
          ${kick(t.avKick, n)}
          <h2 class="sg-h" id="sgTitle">${t.avTitle}</h2>
        </div>
        ${img('spotri-parado.webp', t.altStand, '')}
      </div>
      <div class="sg-perm">
        <div class="sg-panel">
          <div class="hd"><span class="ic">${ICON.bell}</span><div><b>${t.pushT}</b><small>${t.pushD}</small></div></div>
          ${pushControl(t)}
        </div>
        <div class="sg-panel">
          <div class="hd"><span class="ic">${ICON.pin}</span><div><b>${t.geoT}</b><small>${t.geoD}</small></div></div>
          ${geoControl(t)}
        </div>
        <p class="sg-note" style="margin:0">${t.youDecide}</p>
      </div>` },
    { id: 'done', last: true, html: (t) => `
      <div class="sg-art">
        <div class="sg-line" aria-hidden="true"></div>
        ${img('spotri-rodando-1.webp', t.altRide, 'sg-char', 'left:50%;transform:translateX(-50%);height:96%')}
        <div class="sg-bubble r" style="top:6%;right:0">${t.byeBubble}</div>
      </div>
      <div class="sg-text">
        <p class="sg-kick">${t.byeKick}</p>
        <h2 class="sg-h big" id="sgTitle">${t.byeTitle}</h2>
        <p class="sg-p">${t.byeText}</p>
      </div>` }
  ];

  /* ---------- permisos (paso 7) ---------- */
  function pushSupported(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function pushControl(t){
    if(isIOS && !isStandalone()){
      return `<button type="button" class="sg-act ghost" data-sg-goto="install">${t.pushIosBtn}</button><p class="sg-note" style="margin:0">${t.pushIos}</p>`;
    }
    if(!pushSupported()) return `<button type="button" class="sg-act off" disabled>${t.pushNo}</button>`;
    if(state.push === 'on') return `<button type="button" class="sg-act ok" disabled>${ICON.check}${t.pushOn}</button>`;
    if(state.push === 'busy') return `<button type="button" class="sg-act" disabled>${t.pushWait}</button>`;
    if(Notification.permission === 'denied') return `<p class="sg-note" style="margin:0">${t.pushDenied}</p>`;
    return `<button type="button" class="sg-act" data-sg-push>${t.pushBtn}</button>`;
  }
  function geoControl(t){
    if(!navigator.geolocation) return `<button type="button" class="sg-act off" disabled>${t.geoNo}</button>`;
    if(state.geo === 'on') return `<button type="button" class="sg-act ok" disabled>${ICON.check}${t.geoOn}</button>`;
    if(state.geo === 'busy') return `<button type="button" class="sg-act ghost" disabled>${t.geoWait}</button>`;
    return `<button type="button" class="sg-act ghost" data-sg-geo>${t.geoBtn}</button>${state.geo === 'fail' ? `<p class="sg-note" style="margin:0">${t.geoFail}</p>` : ''}`;
  }
  async function checkPermissions(){
    try {
      if(pushSupported() && Notification.permission === 'granted' && (!isIOS || isStandalone())){
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 2500))]);
        const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
        if(sub) state.push = 'on';
      }
    } catch(e){}
    try {
      if(navigator.permissions && navigator.geolocation){
        const st = await navigator.permissions.query({ name: 'geolocation' });
        if(st.state === 'granted') state.geo = 'on';
      }
    } catch(e){}
    if(state.open && current().id === 'alerts') render(0);
  }
  async function doPush(){
    if(!window.SpotraPush || !window.SpotraPush.enable) return;
    state.push = 'busy'; render(0);
    try { await window.SpotraPush.enable(); } catch(e){}
    state.push = '';
    await checkPermissions();
    if(state.open && current().id === 'alerts') render(0);
  }
  function doGeo(){
    state.geo = 'busy'; render(0);
    navigator.geolocation.getCurrentPosition(() => {
      state.geo = 'on'; state.geoGranted = true;
      if(state.open && current().id === 'alerts') render(0);
    }, () => {
      state.geo = 'fail';
      if(state.open && current().id === 'alerts') render(0);
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  }

  /* ---------- estado y render ---------- */
  const state = { open: false, idx: 0, tab: isIOS ? 'ios' : isAndroid ? 'and' : 'pc', push: '', geo: '', geoGranted: false, slides: [] };
  let root = null, lastFocus = null;
  function current(){ return state.slides[state.idx] || SLIDES[0]; }
  function numbering(){
    const map = {}; let n = 0;
    state.slides.forEach(s => { if(s.num) map[s.id] = ++n; });
    return map;
  }

  function ensureDom(){
    if(root) return;
    const st = document.createElement('style');
    st.id = 'spotriGuideCss';
    st.textContent = CSS;
    document.head.appendChild(st);
    root = document.createElement('div');
    root.id = 'spotriGuide';
    root.setAttribute('translate', 'no');
    root.innerHTML = `<div class="sg-card" role="dialog" aria-modal="true" tabindex="-1">
      <div class="sg-top"><div class="sg-dots" role="img"></div><button type="button" class="sg-skip" data-sg-skip></button></div>
      <div class="sg-body"></div>
      <div class="sg-bottom"></div>
      <div class="sg-sr" aria-live="polite"></div>
    </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    const body = root.querySelector('.sg-body');
    let sx = 0, sy = 0, tracking = false;
    body.addEventListener('touchstart', e => {
      if(e.touches.length !== 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    body.addEventListener('touchend', e => {
      if(!tracking) return; tracking = false;
      const tch = e.changedTouches[0]; if(!tch) return;
      const dx = tch.clientX - sx, dy = tch.clientY - sy;
      if(Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4){ dx < 0 ? go(1) : go(-1); }
    }, { passive: true });
  }

  function render(dir){
    const t = T();
    const s = current();
    const total = state.slides.length;
    const nums = numbering();
    const card = root.querySelector('.sg-card');
    card.setAttribute('aria-label', t.dialog);
    const dots = root.querySelector('.sg-dots');
    dots.setAttribute('aria-label', t.step.replace('{n}', state.idx + 1).replace('{t}', total));
    dots.innerHTML = state.slides.map((_, i) => `<span class="${i === state.idx ? 'on' : i < state.idx ? 'done' : ''}"></span>`).join('');
    const skip = root.querySelector('.sg-skip');
    skip.textContent = t.skip;
    skip.style.visibility = s.last ? 'hidden' : '';
    const body = root.querySelector('.sg-body');
    body.innerHTML = `<div class="sg-slide${dir > 0 && !reduceMotion ? ' in-next' : dir < 0 && !reduceMotion ? ' in-prev' : ''}">${s.html(t, nums[s.id])}</div>`;
    if(dir) body.scrollTop = 0;
    card.setAttribute('aria-labelledby', 'sgTitle');
    const bottom = root.querySelector('.sg-bottom');
    const mainLabel = state.idx === 0 ? t.start : s.last ? t.goMap : t.next;
    bottom.innerHTML = (state.idx > 0 && !s.last ? `<button type="button" class="sg-btn back" data-sg-back>${t.back}</button>` : '')
      + `<button type="button" class="sg-btn main" data-sg-next>${mainLabel}</button>`;
    fixButtons(bottom);
    if(dir){
      const h = body.querySelector('#sgTitle');
      root.querySelector('.sg-sr').textContent = (h ? h.textContent : '') + ' · ' + t.step.replace('{n}', state.idx + 1).replace('{t}', total);
    }
  }

  // control: si algún estilo del sistema estira el botón, lo devolvemos a su alto
  function fixButtons(box){
    const check = () => box.querySelectorAll('.sg-btn').forEach(b => {
      const want = window.innerHeight <= 700 ? 52 : 56;
      if(Math.round(b.getBoundingClientRect().height) > want + 2){
        ['padding-top', 'padding-bottom', 'margin-top', 'margin-bottom'].forEach(p => b.style.setProperty(p, '0px', 'important'));
        ['height', 'min-height', 'max-height', 'line-height'].forEach(p => b.style.setProperty(p, want + 'px', 'important'));
      }
    });
    requestAnimationFrame(check);
    setTimeout(check, 300);
  }

  function go(step){
    const n = state.idx + step;
    if(n < 0) return;
    if(n >= state.slides.length){ finish(true); return; }
    state.idx = n;
    render(step);
    if(current().id === 'alerts') checkPermissions();
  }
  function goTo(id){
    const i = state.slides.findIndex(s => s.id === id);
    if(i >= 0){ const dir = i > state.idx ? 1 : -1; state.idx = i; render(dir); }
  }

  function onClick(e){
    const el = e.target.closest('button');
    if(!el || !root.contains(el)) return;
    if(el.hasAttribute('data-sg-skip')){ finish(false); return; }
    if(el.hasAttribute('data-sg-back')){ go(-1); return; }
    if(el.hasAttribute('data-sg-next')){ current().last ? finish(true) : go(1); return; }
    if(el.dataset.sgTab){ state.tab = el.dataset.sgTab; render(0); const b = root.querySelector(`[data-sg-tab="${state.tab}"]`); if(b) b.focus(); return; }
    if(el.dataset.sgGoto){ goTo(el.dataset.sgGoto); return; }
    if(el.hasAttribute('data-sg-push')){ doPush(); return; }
    if(el.hasAttribute('data-sg-geo')){ doGeo(); return; }
    if(el.hasAttribute('data-sg-install') && installEvt){
      const ev = installEvt; installEvt = null;
      try { ev.prompt(); ev.userChoice.then(() => render(0)).catch(() => {}); } catch(err){}
      render(0);
    }
  }

  function onKey(e){
    if(!state.open) return;
    if(e.key === 'ArrowRight'){ e.preventDefault(); current().last ? null : go(1); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); go(-1); }
    else if(e.key === 'Escape'){ e.preventDefault(); finish(false); }
    else if(e.key === 'Tab'){
      const f = Array.from(root.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent !== null && x.style.visibility !== 'hidden');
      if(!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }

  function open(){
    if(!document.body) return;
    ensureDom();
    state.slides = SLIDES.filter(s => !(s.skipIf && s.skipIf()));
    state.idx = 0;
    state.push = ''; state.geo = ''; state.geoGranted = false;
    state.open = true;
    lastFocus = document.activeElement;
    render(0);
    root.classList.add('open');
    document.body.classList.add('spotri-open');
    document.addEventListener('keydown', onKey, true);
    const card = root.querySelector('.sg-card');
    setTimeout(() => { try { card.focus({ preventScroll: true }); } catch(e){} }, 30);
    checkPermissions();
  }

  function close(){
    if(!root) return;
    state.open = false;
    root.classList.remove('open');
    document.body.classList.remove('spotri-open');
    document.removeEventListener('keydown', onKey, true);
    try { if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch(e){}
  }

  function finish(toMap){
    const locate = state.geoGranted;
    close();
    markSeen();
    if(toMap){
      try { if(typeof window.setRoute === 'function') window.setRoute('map'); } catch(e){}
      if(locate) setTimeout(() => { const b = document.getElementById('mapLocateBtn'); if(b) b.click(); }, 900);
    }
  }

  /* ---------- "guía vista" (cuenta + teléfono) ---------- */
  let uidSeen = null;
  async function sb(){
    try { return window.SpotraBackend && window.SpotraBackend.getClient ? await window.SpotraBackend.getClient() : null; }
    catch(e){ return null; }
  }
  function lsGet(uid){ try { return localStorage.getItem(LS_PREFIX + uid) === '1'; } catch(e){ return false; } }
  function lsSet(uid){ try { localStorage.setItem(LS_PREFIX + uid, '1'); } catch(e){} }

  async function markSeen(){
    const c = await sb(); if(!c) return;
    try {
      const { data } = await c.auth.getSession();
      const u = data && data.session ? data.session.user : null;
      if(!u) return;
      lsSet(u.id);
      if(u.user_metadata && u.user_metadata[META_KEY]) return;
      await c.auth.updateUser({ data: { [META_KEY]: 1 } });
    } catch(e){ console.warn('[SPOTRA] guía:', e); }
  }

  /* ---------- cuándo mostrarla sola ---------- */
  let suppressed = false, checking = false;
  const params = (() => { try { return new URLSearchParams(location.search); } catch(e){ return new URLSearchParams(''); } })();
  if(['listing', 'place', 'event', 'post', 'session', 'type'].some(k => params.has(k))) suppressed = true; // entró por un link compartido: la ve la próxima vez

  function screenFree(){
    const b = document.body;
    if(!b || b.classList.contains('auth-mode')) return false;
    const h = location.hash;
    if(h === '#login' || h === '#signup') return false;
    if(document.querySelector('.modal-bg.open, #geoHelp.open')) return false;
    if(document.hidden) return false;
    return true;
  }

  async function maybeShow(){
    if(suppressed || state.open || checking) return;
    checking = true;
    try {
      const c = await sb(); if(!c) return;
      const { data } = await c.auth.getSession();
      const s = data ? data.session : null;
      if(!s || !s.user) return;
      const uid = s.user.id;
      if(uidSeen === uid || lsGet(uid)) return;
      if(s.user.user_metadata && s.user.user_metadata[META_KEY]){ lsSet(uid); return; }
      // datos frescos del servidor (por si ya la vio en otro dispositivo)
      const fresh = await c.auth.getUser();
      const u = fresh && fresh.data ? fresh.data.user : null;
      if(!u) return;
      if(u.user_metadata && u.user_metadata[META_KEY]){ lsSet(uid); return; }
      // esperar a que no haya login, modales ni avisos abiertos (hasta ~1 minuto)
      for(let i = 0; i < 40 && !screenFree(); i++) await new Promise(r => setTimeout(r, 1500));
      if(!screenFree() || suppressed || state.open) return;
      uidSeen = uid;
      open();
    } catch(e){
      console.warn('[SPOTRA] guía:', e);
    } finally {
      checking = false;
    }
  }

  async function watchAuth(){
    const c = await sb();
    if(!c || !c.auth) return;
    if(c.auth.onAuthStateChange){
      c.auth.onAuthStateChange(evt => {
        if(evt === 'PASSWORD_RECOVERY'){ suppressed = true; return; }
        if(evt === 'SIGNED_OUT'){ uidSeen = null; if(state.open) close(); return; }
        if(evt === 'SIGNED_IN' || evt === 'INITIAL_SESSION') setTimeout(maybeShow, 1200);
      });
    }
    setTimeout(maybeShow, 1800);
  }

  /* ---------- botón en Configuración ---------- */
  function syncSettingsLabel(){
    const t = T();
    document.querySelectorAll('[data-spotri-label]').forEach(el => { el.textContent = t.settings; });
    if(state.open && root) render(0);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-open-guide]');
    if(!b) return;
    setTimeout(open, 180); // deja cerrar el modal de Configuración primero
  });
  window.addEventListener('spotra-lang', syncSettingsLabel);
  try {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', () => { if(state.open) render(0); });
  } catch(e){}

  function boot(){
    syncSettingsLabel();
    watchAuth();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SpotraGuide = { open, close, reset: () => { try { Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).forEach(k => localStorage.removeItem(k)); } catch(e){} } };
})();
