/* SPOTRA · Ubicación más confiable para toda la app
   - Si la ubicación precisa tarda o falla, reintenta con una menos precisa (sirve adentro de casa o con poca señal).
   - Si el permiso está bloqueado, muestra una guía con los pasos exactos para iPhone o Android.
   Se carga antes que el resto: todos los módulos que usan la ubicación se benefician solos. */
(function(){
  const geo = navigator.geolocation;
  if(!geo || geo.__spotra) return;
  const original = geo.getCurrentPosition.bind(geo);
  let lastHelp = 0;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);

  function helpSheet(){
    if(Date.now() - lastHelp < 10 * 60000 || document.hidden) return;
    lastHelp = Date.now();
    let el = document.getElementById('geoHelp');
    if(!el){
      el = document.createElement('div');
      el.id = 'geoHelp';
      el.className = 'geo-help';
      document.body.appendChild(el);
      el.addEventListener('click', e => { if(e.target === el || e.target.closest('[data-geo-close]')) el.classList.remove('open'); });
    }
    const steps = isIOS
      ? [ 'Abrí <b>Ajustes</b> del iPhone → <b>Privacidad y seguridad</b> → <b>Localización</b> y activala.',
          'En esa misma pantalla entrá a <b>Sitios web de Safari</b> y elegí <b>Al usar la app</b>.',
          'Volvé a <b>Ajustes</b> → <b>Apps</b> → <b>Safari</b> → <b>Ubicación</b> y elegí <b>Preguntar</b> o <b>Permitir</b>.',
          isStandalone ? 'Cerrá SPOTRA del todo (deslizá hacia arriba) y abrila de nuevo.' : 'Recargá la página de SPOTRA.' ]
      : [ 'Tocá el <b>candado</b> o el ícono a la izquierda de la dirección (arriba).',
          'Entrá a <b>Permisos</b> → <b>Ubicación</b> y elegí <b>Permitir</b>.',
          'Revisá que la <b>Ubicación</b> del celular esté activada (bajá la barra de arriba).',
          'Recargá SPOTRA.' ];
    el.innerHTML = `<div class="geo-card" role="dialog" aria-label="${t('Activá tu ubicación')}">
      <div class="geo-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.4"/></svg></div>
      <h3>${t('Activá tu ubicación')}</h3>
      <p>${t('Tu celular no le está dando la ubicación a SPOTRA. Así lo activás:')}</p>
      <ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <p class="geo-note">${t('SPOTRA solo usa tu ubicación para mostrarte lo que está cerca. Nunca la comparte exacta.')}</p>
      <button type="button" class="primary-btn" data-geo-close>${t('Entendido')}</button></div>`;
    el.classList.add('open');
  }

  geo.getCurrentPosition = function(success, error, options){
    const opts = Object.assign({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }, options || {});
    original(success, err => {
      if(err && err.code === 1){            // permiso bloqueado
        helpSheet();
        if(error) error(err);
        return;
      }
      // tardó o no hubo señal: reintento menos preciso, aceptando una ubicación de hasta 5 minutos
      original(success, err2 => {
        if(err2 && err2.code === 1) helpSheet();
        if(error) error(err2 || err);
      }, { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
    }, opts);
  };
  geo.__spotra = true;
  window.spotraGeoHelp = helpSheet;
})();
