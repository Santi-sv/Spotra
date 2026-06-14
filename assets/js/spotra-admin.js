/* SPOTRA · Panel de aprobaciones (admin)
   - Lee envíos reales de place_submissions (solo admin, por RLS)
   - Aprobar/Rechazar llaman a las funciones SQL approve_submission / reject_submission
   El control real de quién es admin está en la base (app_metadata.role + funciones SECURITY DEFINER). */
(function(){
  const PIN  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z"/></svg>';
  const USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
  const OK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 12l5 5L20 6"/></svg>';
  const NO   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function notify(msg){ (window.toast || function(m){ console.log('[SPOTRA]', m); })(msg); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function db(){
    if(window.SpotraBackend && window.SpotraBackend.getClient) return await window.SpotraBackend.getClient();
    return null;
  }

  async function isAdmin(){
    const client = await db(); if(!client) return false;
    const { data } = await client.auth.getSession();
    const session = data ? data.session : null;
    return !!(session && session.user && session.user.app_metadata && session.user.app_metadata.role === 'admin');
  }

  function view(){ return document.querySelector('[data-view="admin-approvals"]'); }

  function clearRows(v){
    v.querySelectorAll('.approve-row, .admin-note').forEach(el => el.remove());
  }

  function rowHTML(s){
    return `<div class="approve-row" data-sub-id="${esc(s.id)}">
      <div class="thumb" style="background-image:url('${esc(s.imageUrl)}')"></div>
      <div><div class="kind">${esc(s.label)}</div><div class="name">${esc(s.name)}</div>
        <div class="ln">${PIN}${esc(s.address)}</div>
        <div class="ln">${USER}comunidad</div></div>
      <div class="col"><button class="ok-btn">${OK}Aprobar</button><button class="no-btn">${NO}Rechazar</button></div>
    </div>`;
  }

  function photoRowHTML(p){
    return `<div class="approve-row" data-photo-id="${esc(p.id)}">
      <div class="thumb" style="background-image:url('${esc(p.url)}')"></div>
      <div><div class="kind">Foto</div><div class="name">${esc(p.placeName)}</div>
        <div class="ln">${PIN}Imagen enviada para este lugar</div>
        <div class="ln">${USER}comunidad</div></div>
      <div class="col"><button class="ok-btn">${OK}Aprobar</button><button class="no-btn">${NO}Rechazar</button></div>
    </div>`;
  }

  function noteHTML(text){
    return `<div class="admin-note panel" style="margin-top:14px;color:var(--muted)">${esc(text)}</div>`;
  }

  function setCount(v, n){
    const chip = v.querySelector('.count-chip');
    if(chip) chip.textContent = n;
    const kpis = v.querySelectorAll('.kpi .num');
    if(kpis[1]) kpis[1].textContent = n;
  }

  let loading = false;
  async function loadApprovals(){
    const v = view();
    if(!v || loading) return;
    loading = true;
    try {
      const subTabs = v.querySelector('.sub-tabs');
      clearRows(v);

      if(!(await isAdmin())){
        if(subTabs) subTabs.insertAdjacentHTML('afterend', noteHTML('Este panel es solo para administradores. Iniciá sesión con una cuenta admin.'));
        setCount(v, 0);
        return;
      }

      const subs = (window.SpotraBackend ? await window.SpotraBackend.listSubmissions() : []) || [];
      const photos = (window.SpotraBackend ? await window.SpotraBackend.listPendingPhotos() : []) || [];
      const total = subs.length + photos.length;
      if(!total){
        if(subTabs) subTabs.insertAdjacentHTML('afterend', noteHTML('No hay envíos pendientes por ahora.'));
        setCount(v, 0);
        return;
      }
      if(subTabs) subTabs.insertAdjacentHTML('afterend', subs.map(rowHTML).join('') + photos.map(photoRowHTML).join(''));
      setCount(v, total);
    } finally {
      loading = false;
    }
  }

  async function handleReview(row, decision){
    const photoId = row.dataset.photoId;
    const subId = row.dataset.subId;
    const name = (row.querySelector('.name') || {}).textContent || 'Elemento';
    row.querySelectorAll('button').forEach(b => b.disabled = true);

    let result = { ok: false };
    if(window.SpotraBackend){
      result = photoId
        ? await window.SpotraBackend.reviewPhoto(photoId, decision)
        : await window.SpotraBackend.reviewSubmission(subId, decision);
    }

    if(!result.ok){
      row.querySelectorAll('button').forEach(b => b.disabled = false);
      notify('No se pudo procesar. ' + (result.error || 'Probá de nuevo.'));
      return;
    }

    row.style.maxHeight = row.offsetHeight + 'px';
    requestAnimationFrame(() => row.classList.add('row-leave'));
    setTimeout(() => row.remove(), 420);

    const v = view();
    if(v){
      const chip = v.querySelector('.count-chip');
      const n = Math.max(0, (parseInt((chip && chip.textContent) || '0', 10) || 0) - 1);
      setCount(v, n);
    }
    const what = photoId ? 'Foto' : 'Lugar';
    notify(decision === 'approved'
      ? `${what} de "${name.trim()}" aprobado.`
      : `${what} de "${name.trim()}" rechazado.`);
  }

  /* Intercepta Aprobar/Rechazar de filas reales ANTES del handler legacy */
  document.addEventListener('click', function(e){
    const row = e.target.closest('.approve-row[data-sub-id], .approve-row[data-photo-id]');
    if(!row) return;
    const ok = e.target.closest('.ok-btn');
    const no = e.target.closest('.no-btn');
    if(!ok && !no) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    handleReview(row, ok ? 'approved' : 'rejected');
  }, true);

  /* Carga cuando la vista admin se vuelve activa (por click, login o back/forward) */
  function watchView(){
    const v = view();
    if(!v) return;
    if(v.classList.contains('active')) loadApprovals();
    new MutationObserver(() => {
      if(v.classList.contains('active')) loadApprovals();
    }).observe(v, { attributes: true, attributeFilter: ['class'] });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchView);
  else watchView();

  window.SpotraAdmin = { loadApprovals };
})();
