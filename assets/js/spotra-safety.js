/* SPOTRA · Seguridad de la comunidad
   - Fecha de nacimiento: se pide una vez a cada rider (privada, no se puede cambiar después).
   - Reportar: posts, comentarios, productos y sesiones. El admin los ve en su panel.
   - Bloquear: oculta todo lo que publica esa persona, solo para quien bloquea.
   Reglas en seguridad.sql. */
(function(){
  const B = () => window.SpotraBackend;
  const REASONS = [
    ['spam', 'Spam o publicidad'], ['acoso', 'Acoso o insultos'], ['inapropiado', 'Contenido inapropiado'],
    ['estafa', 'Estafa o engaño'], ['peligroso', 'Algo peligroso'], ['otro', 'Otro motivo']
  ];
  const TYPE_LABEL = { post: 'Publicación del foro', comment: 'Comentario', listing: 'Producto del market', session: 'Sesión', user: 'Usuario' };
  const TABLE = { post: 'posts', comment: 'post_comments', listing: 'listings', session: 'sessions' };
  let uid = null;
  let blocked = new Map();
  let target = null;
  let reason = 'spam';

  const $ = id => document.getElementById(id);
  const say = m => { if(window.toast) window.toast(m); };
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function db(){ return B() && B().getClient ? await B().getClient() : null; }
  const isAdmin = () => document.body.dataset.isAdmin === '1';

  /* ---------- ocultar lo bloqueado y los botones propios (con CSS) ---------- */
  function paintStyle(){
    let st = $('spotraSafetyStyle');
    if(!st){ st = document.createElement('style'); st.id = 'spotraSafetyStyle'; document.head.appendChild(st); }
    const rules = [];
    blocked.forEach((_, id) => rules.push(`[data-author="${CSS.escape(id)}"]`));
    let css = rules.length ? rules.join(',') + '{display:none!important}' : '';
    if(uid) css += `[data-report-user="${CSS.escape(uid)}"]{display:none!important}`;
    st.textContent = css;
  }

  function isBlocked(id){ return !!id && blocked.has(id); }

  async function load(){
    const c = await db();
    if(!c) return;
    try { uid = await B().getUserId(); } catch(e){ uid = null; }
    if(!uid){ blocked = new Map(); paintStyle(); return; }
    const { data } = await c.from('blocks').select('blocked_id, blocked_name');
    blocked = new Map((data || []).map(r => [r.blocked_id, r.blocked_name || 'rider']));
    paintStyle();
    window.dispatchEvent(new Event('spotra-blocks'));
    checkBirth(c);
    if(isAdmin()) renderAdminReports();
  }

  /* ---------- fecha de nacimiento ---------- */
  async function checkBirth(c){
    if(document.body.classList.contains('auth-mode')) return;
    if(document.body.dataset.role === 'admin' || isAdmin()) return;
    const { data, error } = await c.from('profiles').select('birth_date').eq('id', uid).maybeSingle();
    if(error || !data || data.birth_date) return;
    const input = $('birthDate');
    if(input){
      const max = new Date(); max.setFullYear(max.getFullYear() - 8);
      input.max = max.toISOString().slice(0, 10);
      input.min = '1920-01-01';
    }
    if(window.openModal) window.openModal('birth');
  }

  async function saveBirth(){
    const input = $('birthDate');
    const err = $('birthError');
    const v = input ? input.value : '';
    err.textContent = '';
    if(!v){ err.textContent = 'Elegí tu fecha de nacimiento.'; return; }
    const d = new Date(v + 'T12:00:00');
    const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
    if(!(age >= 8 && age <= 106)){ err.textContent = 'Revisá la fecha de nacimiento.'; return; }
    const c = await db();
    if(!c || !uid){ err.textContent = 'Iniciá sesión.'; return; }
    const { error } = await c.from('profiles').update({ birth_date: v }).eq('id', uid);
    if(error){ err.textContent = error.message || 'No se pudo guardar. Probá de nuevo.'; return; }
    if(window.closeModal) window.closeModal();
    say('Listo, gracias.');
  }

  /* ---------- reportar ---------- */
  function openReport(el){
    if(!uid){ say('Iniciá sesión para reportar.'); return; }
    target = {
      type: el.dataset.report,
      id: el.dataset.reportId,
      user: el.dataset.reportUser || null,
      name: el.dataset.reportName || ''
    };
    reason = 'spam';
    $('reportWhat').textContent = (TYPE_LABEL[target.type] || '') + (target.name ? ' · @' + target.name : '');
    $('reportReasons').innerHTML = REASONS.map(([k, t], i) =>
      `<button type="button" class="${i === 0 ? 'active' : ''}" data-report-reason="${k}">${esc(t)}</button>`).join('');
    $('reportDetails').value = '';
    $('reportError').textContent = '';
    const blockRow = $('reportBlockRow');
    const canBlock = target.user && target.user !== uid;
    blockRow.style.display = canBlock ? '' : 'none';
    $('reportBlock').checked = false;
    $('reportBlockName').textContent = target.name ? '@' + target.name : '';
    if(window.openModal) window.openModal('report');
  }

  async function sendReport(){
    if(!target) return;
    const c = await db();
    const err = $('reportError');
    const btn = $('reportSend');
    err.textContent = '';
    btn.disabled = true;
    const { error } = await c.from('reports').insert({
      target_type: target.type,
      target_id: String(target.id),
      target_user: target.user,
      target_name: target.name || null,
      reason,
      details: $('reportDetails').value.trim().slice(0, 500) || null
    });
    btn.disabled = false;
    if(error && error.code !== '23505'){ err.textContent = error.message || 'No se pudo enviar. Probá de nuevo.'; return; }
    let blockedNow = false;
    if($('reportBlock').checked && target.user) blockedNow = await block(target.user, target.name, true);
    if(window.closeModal) window.closeModal();
    say(error && error.code === '23505' ? 'Ya lo habías reportado.'
      : blockedNow ? 'Reporte enviado y usuario bloqueado.' : 'Gracias. El admin lo va a revisar.');
  }

  /* ---------- bloquear ---------- */
  async function block(id, name, quiet){
    const c = await db();
    if(!c || !uid || id === uid) return false;
    const { error } = await c.from('blocks').insert({ blocked_id: id, blocked_name: name || null });
    if(error && error.code !== '23505'){ if(!quiet) say(error.message); return false; }
    blocked.set(id, name || 'rider');
    paintStyle();
    window.dispatchEvent(new Event('spotra-blocks'));
    if(!quiet) say('Usuario bloqueado.');
    return true;
  }

  async function unblock(id){
    const c = await db();
    if(!c) return;
    const { error } = await c.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', id);
    if(error){ say('No se pudo desbloquear.'); return; }
    blocked.delete(id);
    paintStyle();
    window.dispatchEvent(new Event('spotra-blocks'));
    renderBlockedList();
    say('Usuario desbloqueado.');
  }

  function renderBlockedList(){
    const box = $('blockedList');
    if(!box) return;
    if(!blocked.size){ box.innerHTML = '<div class="meta">No bloqueaste a nadie.</div>'; return; }
    box.innerHTML = [...blocked].map(([id, name]) =>
      `<div class="blk-row"><b>@${esc(name)}</b><button type="button" class="ghost-btn" data-unblock="${esc(id)}">Desbloquear</button></div>`).join('');
  }

  /* ---------- panel del admin ---------- */
  async function renderAdminReports(){
    const box = $('adminReports');
    if(!box || !isAdmin()) return;
    const c = await db();
    if(!c) return;
    const { data, error } = await c.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
    if(error){ box.innerHTML = ''; return; }
    const rows = data || [];
    const REASON = Object.fromEntries(REASONS);
    box.innerHTML = `<div class="section-head" style="margin-top:4px"><h3>Reportes abiertos <span class="count-chip">${rows.length}</span></h3></div>`
      + (rows.length ? rows.map(r => `<div class="rep-row">
          <div class="rep-tx"><b>${esc(TYPE_LABEL[r.target_type] || r.target_type)}${r.target_name ? ' · @' + esc(r.target_name) : ''}</b>
          <small>${esc(REASON[r.reason] || r.reason)} · ${new Date(r.created_at).toLocaleString('es')}</small>
          ${r.details ? `<p>${esc(r.details)}</p>` : ''}</div>
          <div class="rep-actions">
            ${TABLE[r.target_type] ? `<button type="button" class="no-btn" data-rep-delete="${esc(r.id)}" data-rep-type="${esc(r.target_type)}" data-rep-target="${esc(r.target_id)}">Eliminar contenido</button>` : ''}
            <button type="button" class="ghost-btn" data-rep-dismiss="${esc(r.id)}">Descartar</button>
          </div></div>`).join('')
        : '<div class="meta" style="margin-bottom:14px">No hay reportes abiertos.</div>');
  }

  async function adminResolve(id, status, type, targetId){
    const c = await db();
    if(!c) return;
    if(status === 'resolved'){
      if(!confirm('¿Eliminar el contenido reportado? No se puede deshacer.')) return;
      const { error } = await c.from(TABLE[type]).delete().eq('id', targetId);
      if(error){ say('No se pudo eliminar: ' + error.message); return; }
    }
    const { error } = await c.from('reports').update({ status }).eq('id', id);
    if(error){ say('No se pudo actualizar el reporte.'); return; }
    say(status === 'resolved' ? 'Contenido eliminado.' : 'Reporte descartado.');
    renderAdminReports();
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', e => {
    const t = e.target;
    let el;
    if((el = t.closest('[data-report]'))){ e.preventDefault(); e.stopPropagation(); openReport(el); return; }
    if((el = t.closest('[data-report-reason]'))){
      reason = el.dataset.reportReason;
      document.querySelectorAll('#reportReasons button').forEach(b => b.classList.toggle('active', b === el));
      return;
    }
    if(t.closest('#reportSend')){ e.preventDefault(); sendReport(); return; }
    if(t.closest('#birthSave')){ e.preventDefault(); saveBirth(); return; }
    if(t.closest('[data-open-modal="blocked"]')){ setTimeout(renderBlockedList, 0); return; }
    if((el = t.closest('[data-unblock]'))){ e.preventDefault(); unblock(el.dataset.unblock); return; }
    if((el = t.closest('[data-rep-delete]'))){ e.preventDefault(); adminResolve(el.dataset.repDelete, 'resolved', el.dataset.repType, el.dataset.repTarget); return; }
    if((el = t.closest('[data-rep-dismiss]'))){ e.preventDefault(); adminResolve(el.dataset.repDismiss, 'dismissed'); return; }
    if(t.closest('[data-route="admin-approvals"]')) setTimeout(renderAdminReports, 300);
  }, true);

  setTimeout(load, 1800);
  document.addEventListener('visibilitychange', () => { if(!document.hidden && !uid) load(); });

  window.SpotraSafety = { load, isBlocked, block, reload: load };
})();
