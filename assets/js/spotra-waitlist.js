/* SPOTRA — Panel de lista de espera (admin)
   Muestra la gente anotada en la landing y abre WhatsApp con un mensaje precargado.
   Las plantillas se editan desde el mismo panel y se guardan en Supabase. */
(function(){
  'use strict';

  var API = window.SpotraBackend;
  var VIEW = '[data-view="admin-waitlist"]';

  var DEFAULT_TEMPLATES = [
    { nombre: 'Bienvenida',
      texto: 'Hola {nombre}! Soy Santi, de SPOTRA. Te anotaste en la lista de espera, asi que sos de los primeros en enterarte cuando abramos. Cualquier cosa que quieras ver en la app, decime.' },
    { nombre: 'Aviso de lanzamiento',
      texto: 'Hola {nombre}! Ya abrimos SPOTRA. Entra desde spotra.onrender.com y carga tu primer spot. Cualquier problema, escribime por aca.' },
    { nombre: 'Invitacion a probar',
      texto: 'Hola {nombre}! Te comparto un acceso anticipado a SPOTRA para que lo pruebes antes que nadie. Me sirve mucho que me digas que te parece.' }
  ];

  var state = { rows: [], templates: null, filter: '', country: '', tipo: '' };

  var PAISES = {
    UY:'Uruguay', AR:'Argentina', BR:'Brasil', CL:'Chile', PY:'Paraguay', BO:'Bolivia',
    PE:'Peru', CO:'Colombia', EC:'Ecuador', VE:'Venezuela', MX:'Mexico', CR:'Costa Rica',
    PA:'Panama', GT:'Guatemala', DO:'Rep. Dominicana', US:'Estados Unidos', ES:'España'
  };
  var IDIOMAS = { 'es-uy':'Español (UY)', 'es':'Español (LatAm)', 'pt-br':'Português (BR)', 'en':'English' };

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function fecha(iso){
    if(!iso) return '';
    var d = new Date(iso);
    if(isNaN(d)) return '';
    return d.toLocaleDateString('es-UY', { day:'2-digit', month:'2-digit', year:'2-digit' })
      + ' ' + d.toLocaleTimeString('es-UY', { hour:'2-digit', minute:'2-digit' });
  }

  function waNumber(tel){
    return String(tel || '').replace(/\D/g, '');
  }

  function fill(texto, row){
    return String(texto || '')
      .replace(/\{nombre\}/g, row.nombre || '')
      .replace(/\{pais\}/g, PAISES[row.pais] || row.pais || '')
      .replace(/\{disciplina\}/g, row.disciplina || '')
      .replace(/\{marca\}/g, row.marca || '');
  }

  function view(){ return document.querySelector(VIEW); }

  function templateOptions(sel){
    return (state.templates || []).map(function(t, i){
      return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + esc(t.nombre) + '</option>';
    }).join('');
  }

  function rowHTML(r){
    var tel = esc(r.telefono || '');
    return '<div class="approve-row" style="grid-template-columns:1fr auto" data-wl-row="' + esc(r.id) + '">'
      + '<div>'
      +   '<div class="kind"' + ((r.tipo === 'marca') ? ' style="color:#ffd24a"' : '') + '>'
      +     ((r.tipo === 'marca') ? 'MARCA · ' : 'RIDER · ')
      +     esc(PAISES[r.pais] || r.pais || 'Sin pais') + ' · ' + esc(IDIOMAS[r.idioma] || r.idioma || '') + '</div>'
      +   '<div class="name" style="font-size:18px">' + esc(r.nombre || 'Sin nombre') + '</div>'
      +   '<div class="ln">' + tel + ' · ' + esc(r.disciplina || '') + ' · ' + esc(fecha(r.created_at)) + '</div>'
      + '</div>'
      + '<div class="col">'
      +   '<button class="ok-btn" data-wl-wa="' + esc(r.id) + '">WhatsApp</button>'
      +   '<button class="no-btn" data-wl-del="' + esc(r.id) + '">Borrar</button>'
      + '</div>'
      + '</div>';
  }

  function filtered(){
    var q = state.filter.toLowerCase();
    return state.rows.filter(function(r){
      if(state.tipo && (r.tipo || 'rider') !== state.tipo) return false;
      if(state.country && r.pais !== state.country) return false;
      if(!q) return true;
      return (String(r.nombre || '') + ' ' + String(r.telefono || '')).toLowerCase().indexOf(q) !== -1;
    });
  }

  function paises(){
    var set = {};
    state.rows.forEach(function(r){ if(r.pais) set[r.pais] = true; });
    return Object.keys(set).sort();
  }

  function render(){
    var box = view();
    if(!box) return;
    var list = filtered();
    var porPais = {};
    state.rows.forEach(function(r){ porPais[r.pais || '--'] = (porPais[r.pais || '--'] || 0) + 1; });
    var resumen = Object.keys(porPais).sort().map(function(k){
      return esc(PAISES[k] || k) + ': ' + porPais[k];
    }).join(' · ');

    box.innerHTML = ''
    + '<div class="section-head" style="margin-top:0"><h2 style="font-family:var(--display);font-size:28px;letter-spacing:0;text-transform:none">Lista de espera</h2>'
    +   '<button class="ghost-btn" id="wlReload">Actualizar</button></div>'
    + '<div class="meta" style="margin-bottom:10px">' + state.rows.length + ' anotados' + (resumen ? ' · ' + resumen : '') + '</div>'
    + '<div class="sub-tabs" style="margin-bottom:10px">'
    +   '<button' + (state.tipo === '' ? ' class="active"' : '') + ' data-wl-tipo="">Todos</button>'
    +   '<button' + (state.tipo === 'rider' ? ' class="active"' : '') + ' data-wl-tipo="rider">Riders</button>'
    +   '<button' + (state.tipo === 'marca' ? ' class="active"' : '') + ' data-wl-tipo="marca">Marcas</button>'
    + '</div>'
    + '<div class="form-grid" style="grid-template-columns:1fr 160px;gap:8px;margin-bottom:12px">'
    +   '<input id="wlSearch" placeholder="Buscar por nombre o numero" value="' + esc(state.filter) + '">'
    +   '<select id="wlCountry"><option value="">Todos los paises</option>'
    +     paises().map(function(c){
            return '<option value="' + esc(c) + '"' + (state.country === c ? ' selected' : '') + '>' + esc(PAISES[c] || c) + '</option>';
          }).join('')
    +   '</select>'
    + '</div>'
    + '<div class="form-grid" style="grid-template-columns:1fr;gap:6px;margin-bottom:14px">'
    +   '<label class="meta" for="wlTemplate">Mensaje que se abre en WhatsApp</label>'
    +   '<select id="wlTemplate">' + templateOptions(0) + '</select>'
    + '</div>'
    + (list.length ? list.map(rowHTML).join('')
                   : '<div class="meta">Todavia no hay nadie anotado con ese filtro.</div>')
    + '<div class="section-head" style="margin-top:26px"><h3>Plantillas de mensaje</h3></div>'
    + '<div class="meta" style="margin-bottom:10px">Podes usar {nombre}, {pais} y {disciplina}. Se reemplazan solos al abrir el chat.</div>'
    + (state.templates || []).map(function(t, i){
        return '<div class="sg-tpl" style="margin-bottom:10px">'
          + '<input data-tpl-name="' + i + '" value="' + esc(t.nombre) + '" style="margin-bottom:6px">'
          + '<textarea data-tpl-text="' + i + '" rows="3">' + esc(t.texto) + '</textarea>'
          + '</div>';
      }).join('')
    + '<button class="primary-btn" id="wlSaveTpl">Guardar plantillas</button>'
    + '<div class="meta" id="wlTplMsg" style="margin-top:8px"></div>';

    wire();
  }

  function wire(){
    var box = view();
    if(!box) return;

    var search = box.querySelector('#wlSearch');
    if(search){
      search.addEventListener('input', function(){
        state.filter = search.value;
        var pos = search.selectionStart;
        render();
        var s2 = view().querySelector('#wlSearch');
        if(s2){ s2.focus(); s2.setSelectionRange(pos, pos); }
      });
    }
    var country = box.querySelector('#wlCountry');
    if(country){
      country.addEventListener('change', function(){ state.country = country.value; render(); });
    }
    var reload = box.querySelector('#wlReload');
    if(reload){ reload.addEventListener('click', load); }

    box.addEventListener('click', function(ev){
      var tipoBtn = ev.target.closest('[data-wl-tipo]');
      if(tipoBtn){ state.tipo = tipoBtn.getAttribute('data-wl-tipo'); render(); return; }

      var wa = ev.target.closest('[data-wl-wa]');
      if(wa){
        var id = wa.getAttribute('data-wl-wa');
        var row = null;
        state.rows.forEach(function(r){ if(String(r.id) === String(id)) row = r; });
        if(!row) return;
        var sel = box.querySelector('#wlTemplate');
        var tpl = (state.templates || [])[sel ? parseInt(sel.value, 10) : 0];
        var texto = tpl ? fill(tpl.texto, row) : '';
        var url = 'https://wa.me/' + waNumber(row.telefono) + (texto ? '?text=' + encodeURIComponent(texto) : '');
        window.open(url, '_blank', 'noopener');
        return;
      }
      var del = ev.target.closest('[data-wl-del]');
      if(del){
        var delId = del.getAttribute('data-wl-del');
        if(!window.confirm('Borrar este contacto de la lista?')) return;
        API.deleteWaitlistEntry(delId).then(function(res){
          if(res && res.ok){
            state.rows = state.rows.filter(function(r){ return String(r.id) !== String(delId); });
            render();
          } else {
            window.alert('No se pudo borrar.');
          }
        });
      }
    });

    var save = box.querySelector('#wlSaveTpl');
    if(save){
      save.addEventListener('click', function(){
        var out = [];
        box.querySelectorAll('[data-tpl-text]').forEach(function(ta){
          var i = ta.getAttribute('data-tpl-text');
          var nameEl = box.querySelector('[data-tpl-name="' + i + '"]');
          out.push({ nombre: nameEl ? nameEl.value.trim() : ('Plantilla ' + (Number(i) + 1)), texto: ta.value });
        });
        state.templates = out;
        save.disabled = true;
        save.textContent = 'Guardando...';
        API.saveWaitlistTemplates(out).then(function(res){
          save.disabled = false;
          save.textContent = 'Guardar plantillas';
          var msg = box.querySelector('#wlTplMsg');
          if(msg) msg.textContent = (res && res.ok) ? 'Plantillas guardadas.' : 'No se pudieron guardar.';
        });
      });
    }
  }

  function load(){
    var box = view();
    if(!box) return;
    box.innerHTML = '<div class="meta">Cargando lista de espera...</div>';
    Promise.all([API.listWaitlist(), API.getWaitlistTemplates()]).then(function(res){
      state.rows = res[0] || [];
      state.templates = (res[1] && res[1].length) ? res[1] : DEFAULT_TEMPLATES;
      render();
    }).catch(function(err){
      console.warn('[SPOTRA] waitlist panel:', err);
      box.innerHTML = '<div class="meta">No se pudo cargar la lista. Revisá la conexión con Supabase.</div>';
    });
  }

  var loaded = false;
  function maybeLoad(){
    if(location.hash.indexOf('admin-waitlist') === -1) return;
    if(loaded) return;
    loaded = true;
    load();
  }

  window.addEventListener('hashchange', maybeLoad);
  document.addEventListener('click', function(ev){
    var b = ev.target.closest('[data-route="admin-waitlist"]');
    if(b) setTimeout(function(){ if(!loaded){ loaded = true; load(); } }, 60);
  });
  if(document.readyState !== 'loading') maybeLoad();
  else document.addEventListener('DOMContentLoaded', maybeLoad);

  window.SpotraWaitlist = { load: load };
})();
