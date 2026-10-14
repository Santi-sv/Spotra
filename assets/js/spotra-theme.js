/* SPOTRA · modo app instalada y tema oscuro
   (13/10/2026: antes estaba escrito dentro de index.html; se pasó a archivo para poder activar la protección CSP, que bloquea todo código escrito dentro del HTML) */
(function(){try{if((window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone)document.documentElement.classList.add('pwa');}catch(e){}})();
/* Tema: automático (día 06:00–21:00, noche 21:00–06:00) o fijo, según Configuración */
(function(){var d=document.documentElement,last=null;
function pref(){try{return localStorage.getItem('spotra_theme')||'auto';}catch(e){return 'auto';}}
function night(){var h=new Date().getHours();return h>=21||h<6;}
function apply(){var p=pref(),dark=true;/* 13/10/2026: la app es siempre oscura; el mapa se ve claro aparte */
d.classList.toggle('theme-dark',dark);d.classList.toggle('theme-light',!dark);
var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute('content',dark?'#070907':'#ffffff');
var bs=document.querySelectorAll('#themeSeg button');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].getAttribute('data-theme-set')===p);
if(last!==dark){last=dark;try{window.dispatchEvent(new Event('spotra-theme'));}catch(e){}}}
window.spotraSetTheme=function(v){try{localStorage.setItem('spotra_theme',v);}catch(e){}apply();};
apply();setInterval(apply,60000);
document.addEventListener('DOMContentLoaded',apply);
document.addEventListener('visibilitychange',function(){if(!document.hidden)apply();});
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-theme-set]');if(b)window.spotraSetTheme(b.getAttribute('data-theme-set'));});
})();
