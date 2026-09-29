/* SPOTRA · Foto de perfil y portada
   El rider elige una foto de su galería; se achica en el celular (perfil 480x480 cuadrada, portada 1600 máx.)
   y se sube a place-images/profiles/<su id>/. Se muestra en el Perfil y en la barra inferior. */
(function(){
  const B = () => window.SpotraBackend;
  let me = null;   // { id, avatar_url, cover_url, name }
  const t = s => (window.SpotraI18n ? window.SpotraI18n.t(s) : s);
  const say = m => { if(window.toast) window.toast(t(m)); };
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }

  function paint(){
    const av = document.querySelector('.profile-avatar');
    const cv = document.querySelector('.profile-cover');
    const initial = ((me && me.name) || 'R').trim().charAt(0).toUpperCase();
    if(av){
      av.classList.toggle('has-img', !!(me && me.avatar_url));
      av.style.backgroundImage = me && me.avatar_url ? `url("${me.avatar_url}")` : '';
      const i = av.querySelector('.pa-initial');
      if(i) i.textContent = initial;
    }
    if(cv){
      cv.classList.toggle('has-img', !!(me && me.cover_url));
      cv.style.backgroundImage = me && me.cover_url ? `linear-gradient(180deg,transparent,rgba(0,0,0,.55)),url("${me.cover_url}")` : '';
    }
    document.querySelectorAll('.nav-avatar').forEach(n => {
      n.classList.toggle('has-img', !!(me && me.avatar_url));
      n.style.backgroundImage = me && me.avatar_url ? `url("${me.avatar_url}")` : '';
    });
  }

  async function load(){
    const c = await db();
    if(!c) return;
    let uid = null;
    try { uid = await B().getUserId(); } catch(e){}
    if(!uid){ me = null; paint(); return; }
    const { data } = await c.from('profiles').select('id, full_name, username, avatar_url, cover_url').eq('id', uid).maybeSingle();
    if(!data) return;
    me = { id: data.id, avatar_url: data.avatar_url, cover_url: data.cover_url, name: data.full_name || data.username || 'Rider' };
    paint();
  }

  // achica la imagen: 'avatar' = cuadrada 480 px (recorte al centro), 'cover' = lado mayor 1600 px
  function shrink(file, kind){
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if(kind === 'avatar'){
          const s = Math.min(img.width, img.height);
          canvas.width = canvas.height = 480;
          ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 480, 480);
        } else {
          let w = img.width, h = img.height;
          const k = Math.min(1, 1600 / Math.max(w, h));
          canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        canvas.toBlob(b => {
          if(b && b.type === 'image/webp') resolve({ blob: b, ext: 'webp' });
          else canvas.toBlob(b2 => b2 ? resolve({ blob: b2, ext: 'jpg' }) : reject(new Error('imagen')), 'image/jpeg', 0.85);
        }, 'image/webp', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen')); };
      img.src = url;
    });
  }

  async function upload(file, kind){
    if(!me){ say('Iniciá sesión.'); return; }
    if(!/^image\//.test(file.type)){ say('Solo se pueden subir imágenes.'); return; }
    if(file.size > 20 * 1024 * 1024){ say('La imagen es muy pesada (máx. 20 MB).'); return; }
    say('Procesando imagen...');
    try {
      const c = await db();
      const { blob, ext } = await shrink(file, kind);
      const path = `profiles/${me.id}/${kind}-${Date.now()}.${ext}`;
      const up = await c.storage.from('place-images').upload(path, blob, { contentType: blob.type, upsert: false });
      if(up.error){ say(up.error.message); return; }
      const url = c.storage.from('place-images').getPublicUrl(path).data.publicUrl;
      const col = kind === 'avatar' ? 'avatar_url' : 'cover_url';
      const old = me[col];
      const { error } = await c.from('profiles').update({ [col]: url }).eq('id', me.id);
      if(error){ say(error.message); return; }
      me[col] = url;
      paint();
      say(kind === 'avatar' ? 'Foto de perfil actualizada.' : 'Portada actualizada.');
      // borrar la anterior para no acumular archivos
      const prefix = '/object/public/place-images/';
      if(old && old.includes(prefix + 'profiles/' + me.id + '/')){
        c.storage.from('place-images').remove([old.split(prefix)[1]]).catch(() => {});
      }
    } catch(e){ say('No se pudo procesar la imagen.'); }
  }

  function pick(kind){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => { if(input.files && input.files[0]) upload(input.files[0], kind); };
    input.click();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pick-photo]');
    if(!b) return;
    e.preventDefault();
    pick(b.dataset.pickPhoto);
  });

  setTimeout(load, 1500);
  window.addEventListener('spotra-lang', paint);
  window.SpotraAvatar = { load };
})();
